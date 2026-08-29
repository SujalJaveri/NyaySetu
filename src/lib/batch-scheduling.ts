/**
 * Batch Cause List Optimizer for NyayaSetu.
 *
 * Implements "Predict-then-Optimize" Daily Board Generation:
 * 1. Takes multiple pending / unscheduled cases for a target court date.
 * 2. Checks court holiday & non-sitting day constraints.
 * 3. Applies Procedural Staging:
 *    - Morning Board (10:30 AM - 11:30 AM): Fresh mentions, bail applications, directions
 *    - Contested Board (11:30 AM - 3:30 PM): Part-heard trials, evidence, final arguments
 *    - Afternoon Board (3:30 PM - 4:30 PM): Pronouncement of orders, miscellaneous
 * 4. Optimizes allocation across available benches and courtrooms while respecting
 *    workload thresholds, specialisations, and duration predictions.
 */

import type { CaseRow } from "@/lib/cases";
import type { Judge, Courtroom } from "@/lib/registry";
import type { EngineData, Slot, SoftFactor } from "@/lib/scheduling";
import { formatSlotLabel, slotMinutes, specialisationMatch } from "@/lib/scheduling";
import { checkCourtHoliday } from "@/lib/holidays";
import { predictHearingDuration, computeAdjournmentRisk } from "@/lib/predictions";

export type ProceduralStage = "morning_mentions" | "contested_trials" | "afternoon_orders";

export const STAGE_LABELS: Record<ProceduralStage, { title: string; window: string }> = {
  morning_mentions: {
    title: "Urgent Mentions & Admissions",
    window: "10:30 AM – 11:30 AM",
  },
  contested_trials: {
    title: "Contested Arguments & Evidence",
    window: "11:30 AM – 03:30 PM",
  },
  afternoon_orders: {
    title: "Orders & Miscellaneous Disposals",
    window: "03:30 PM – 04:30 PM",
  },
};

export type BatchProposedListing = {
  caseId: string;
  caseNumber: string;
  cnrNumber?: string | null;
  parties: string;
  categoryName: string;
  priorityScore: number;
  priorityTier: string;
  stage: ProceduralStage;
  sequenceNumber: number;
  judge: Judge;
  courtroom: Courtroom;
  slot: Slot;
  predictedDurationMinutes: number;
  adjournmentRiskPercentage: number;
  fitScore: number;
  reasoning: string;
};

export type BatchUnassignedCase = {
  caseId: string;
  caseNumber: string;
  reason: string;
};

export type BatchOptimizationResult = {
  targetDate: string;
  isHoliday: boolean;
  holidayName?: string | undefined;
  totalCandidateCases: number;
  scheduledCount: number;
  unassignedCount: number;
  listings: BatchProposedListing[];
  unassigned: BatchUnassignedCase[];
  benchUtilisation: {
    judgeId: string;
    judgeName: string;
    casesCount: number;
    totalMinutes: number;
  }[];
  stagedCounts: Record<ProceduralStage, number>;
};

function classifyCaseStage(c: CaseRow): ProceduralStage {
  const cat = (c.case_categories?.name || "").toLowerCase();
  const dur = c.estimated_duration_minutes || 60;

  // 1. Bail, urgent mentions, interim directions -> Morning
  if (
    cat.includes("bail") ||
    c.legal_priority_flag ||
    (c.priority_score && c.priority_score >= 85) ||
    dur <= 30
  ) {
    return "morning_mentions";
  }

  // 2. Heavy trials, evidence, long arguments -> Contested trials
  if (dur >= 60 || cat.includes("trial") || cat.includes("dispute") || c.is_ftsc_pocso) {
    return "contested_trials";
  }

  // 3. Miscellaneous disposals, review -> Afternoon
  return "afternoon_orders";
}

/**
 * Runs the batch optimization algorithm to generate a complete daily cause list.
 */
export function runBatchCauseListOptimizer(
  cases: CaseRow[],
  targetDate: string,
  data: EngineData,
): BatchOptimizationResult {
  // 1. Validate date against Court Holidays & Closures
  const holidayCheck = checkCourtHoliday(targetDate, data.courtHolidays);
  if (holidayCheck.isHoliday) {
    return {
      targetDate,
      isHoliday: true,
      holidayName: holidayCheck.holidayName,
      totalCandidateCases: cases.length,
      scheduledCount: 0,
      unassignedCount: cases.length,
      listings: [],
      unassigned: cases.map((c) => ({
        caseId: c.id,
        caseNumber: c.case_number,
        reason: `Court is closed on ${targetDate} (${holidayCheck.holidayName || "Gazetted Holiday"})`,
      })),
      benchUtilisation: [],
      stagedCounts: {
        morning_mentions: 0,
        contested_trials: 0,
        afternoon_orders: 0,
      },
    };
  }

  // 2. Filter slots strictly for the targetDate and sort by start_time
  const daySlots = data.slots
    .filter((s) => s.date === targetDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (daySlots.length === 0) {
    return {
      targetDate,
      isHoliday: false,
      totalCandidateCases: cases.length,
      scheduledCount: 0,
      unassignedCount: cases.length,
      listings: [],
      unassigned: cases.map((c) => ({
        caseId: c.id,
        caseNumber: c.case_number,
        reason: `No publishing hearing slots found in the registry for ${targetDate}`,
      })),
      benchUtilisation: [],
      stagedCounts: { morning_mentions: 0, contested_trials: 0, afternoon_orders: 0 },
    };
  }

  // 3. Sort candidate cases by Priority Score descending (Tier 1 matters get optimal slots first)
  const sortedCases = [...cases].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

  // 4. Track occupancy across the simulation
  const occupiedJudgeSlots = new Set<string>();
  const occupiedRoomSlots = new Set<string>();
  const judgeLoads = new Map<string, number>();
  const judgeMinutes = new Map<string, number>();

  // Pre-seed with already existing schedules in the database
  for (const s of data.schedules) {
    if (s.status === "cancelled" || !s.hearing_slots || s.hearing_slots.date !== targetDate)
      continue;
    if (s.judge_id && s.slot_id) occupiedJudgeSlots.add(`${s.judge_id}:${s.slot_id}`);
    if (s.courtroom_id && s.slot_id) occupiedRoomSlots.add(`${s.courtroom_id}:${s.slot_id}`);
    if (s.judge_id) judgeLoads.set(s.judge_id, (judgeLoads.get(s.judge_id) ?? 0) + 1);
  }

  const listings: BatchProposedListing[] = [];
  const unassigned: BatchUnassignedCase[] = [];
  const stagedCounts: Record<ProceduralStage, number> = {
    morning_mentions: 0,
    contested_trials: 0,
    afternoon_orders: 0,
  };

  let sequenceCounter = 1;

  for (const c of sortedCases) {
    const stage = classifyCaseStage(c);
    const prediction = predictHearingDuration({
      categoryName: c.case_categories?.name ?? null,
      baseDuration: c.estimated_duration_minutes,
      pendingDays: c.pending_duration_days,
      previousAdjournments: c.previous_adjournments,
      isFtscPocso: c.is_ftsc_pocso,
      isSeniorCitizen: c.senior_citizen_litigant,
      isPropertyDispute5yr: c.property_dispute_5yr_plus,
    });
    const risk = computeAdjournmentRisk({
      categoryName: c.case_categories?.name ?? null,
      baseDuration: c.estimated_duration_minutes,
      pendingDays: c.pending_duration_days,
      previousAdjournments: c.previous_adjournments,
      isFtscPocso: c.is_ftsc_pocso,
    });

    let bestFit: {
      judge: Judge;
      courtroom: Courtroom;
      slot: Slot;
      score: number;
    } | null = null;

    // Search for feasible (Judge x Courtroom x Slot) combinations
    for (const slot of daySlots) {
      if (prediction.predictedMinutes > slotMinutes(slot)) continue;

      for (const judge of data.judges) {
        const currentLoad = (judgeLoads.get(judge.id) ?? 0) + judge.current_workload;
        if (currentLoad >= data.maxJudgeWorkload) continue;
        if (occupiedJudgeSlots.has(`${judge.id}:${slot.id}`)) continue;

        for (const courtroom of data.courtrooms) {
          if (occupiedRoomSlots.has(`${courtroom.id}:${slot.id}`)) continue;

          const match = specialisationMatch(judge, c.case_categories?.name ?? null);
          const workloadRatio = 1 - Math.min(1, currentLoad / data.maxJudgeWorkload);
          const score = Math.round(match * 50 + workloadRatio * 50);

          if (!bestFit || score > bestFit.score) {
            bestFit = { judge, courtroom, slot, score };
          }
        }
      }
    }

    if (bestFit) {
      // Allocate the slot
      occupiedJudgeSlots.add(`${bestFit.judge.id}:${bestFit.slot.id}`);
      occupiedRoomSlots.add(`${bestFit.courtroom.id}:${bestFit.slot.id}`);
      judgeLoads.set(bestFit.judge.id, (judgeLoads.get(bestFit.judge.id) ?? 0) + 1);
      judgeMinutes.set(
        bestFit.judge.id,
        (judgeMinutes.get(bestFit.judge.id) ?? 0) + prediction.predictedMinutes,
      );

      stagedCounts[stage] += 1;

      listings.push({
        caseId: c.id,
        caseNumber: c.case_number,
        cnrNumber: c.cnr_number ?? null,
        parties: c.parties,
        categoryName: c.case_categories?.name || "General",
        priorityScore: Math.round(c.priority_score ?? 50),
        priorityTier: c.priority_tier || "Tier 2",
        stage,
        sequenceNumber: sequenceCounter++,
        judge: bestFit.judge,
        courtroom: bestFit.courtroom,
        slot: bestFit.slot,
        predictedDurationMinutes: prediction.predictedMinutes,
        adjournmentRiskPercentage: risk.riskPercentage,
        fitScore: bestFit.score,
        reasoning: `Optimized for ${bestFit.judge.name} (${bestFit.judge.specialisation || "General"}) in ${bestFit.courtroom.name} (${STAGE_LABELS[stage].window})`,
      });
    } else {
      unassigned.push({
        caseId: c.id,
        caseNumber: c.case_number,
        reason: "All matching benches or courtrooms have reached capacity for this date",
      });
    }
  }

  // Sort final listings by Slot start_time then by stage
  listings.sort((a, b) => a.slot.start_time.localeCompare(b.slot.start_time));
  listings.forEach((item, index) => {
    item.sequenceNumber = index + 1;
  });

  const benchUtilisation = data.judges.map((j) => ({
    judgeId: j.id,
    judgeName: j.name,
    casesCount: judgeLoads.get(j.id) ?? 0,
    totalMinutes: judgeMinutes.get(j.id) ?? 0,
  }));

  return {
    targetDate,
    isHoliday: false,
    totalCandidateCases: cases.length,
    scheduledCount: listings.length,
    unassignedCount: unassigned.length,
    listings,
    unassigned,
    benchUtilisation,
    stagedCounts,
  };
}
