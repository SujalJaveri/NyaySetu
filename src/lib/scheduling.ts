/**
 * Deterministic, rules-based scheduling engine.
 *
 * IMPORTANT: there is NO AI, no model call and no randomness anywhere in this file.
 * Every recommendation is produced by pure functions over the registry data, so the
 * same inputs always produce exactly the same ranked output.
 *
 * Two distinct layers:
 *   1. HARD CONSTRAINTS  — a (judge, courtroom, slot) triple is either valid or it is
 *      discarded. Never used for ranking.
 *   2. SOFT PREFERENCES  — only ever used to RANK the surviving valid candidates.
 */
import { supabase } from "@/integrations/supabase/client";
import { MAX_JUDGE_WORKLOAD, type Courtroom, type Judge } from "@/lib/registry";
import type { CaseRow } from "@/lib/cases";
import { checkCourtHoliday, DEFAULT_COURT_HOLIDAYS_2026, type CourtHoliday } from "@/lib/holidays";

export type Slot = { id: string; date: string; start_time: string; end_time: string };

export type AvailabilityRecord = {
  entity_type: "judge" | "courtroom";
  entity_id: string;
  date: string;
  slot_id: string;
  status: "available" | "unavailable";
};

export type OccupiedSchedule = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  slot_id: string | null;
  cases: { id: string } | null;
  hearing_slots: Slot | null;
};

/** Admin-configurable soft-preference weights used only for RANKING valid candidates. */
export type SchedulingWeights = {
  specialisation: number;
  workload: number;
  priority: number;
  utilisation: number;
};

export const DEFAULT_SCHEDULING_WEIGHTS: SchedulingWeights = {
  specialisation: 35,
  workload: 30,
  priority: 20,
  utilisation: 15,
};

export type EngineData = {
  judges: Judge[];
  courtrooms: Courtroom[];
  slots: Slot[];
  availability: AvailabilityRecord[];
  schedules: OccupiedSchedule[];
  maxJudgeWorkload: number;
  weights?: SchedulingWeights;
  courtHolidays?: CourtHoliday[];
};

export type SoftFactor = {
  key: string;
  label: string;
  detail: string;
  weight: number;
  points: number;
};

export type Candidate = {
  key: string;
  judge: Judge;
  courtroom: Courtroom;
  slot: Slot;
  score: number;
  /** 0–100 deterministic confidence: 15 pts for clearing every hard check + 85 × soft fit. */
  confidence: number;
  factors: SoftFactor[];
};

export type RejectionCounts = {
  holidayClosure: number;
  judgeUnavailable: number;
  courtroomUnavailable: number;
  judgeBooked: number;
  courtroomBooked: number;
  slotOccupied: number;
  durationOverflow: number;
};

/**
 * A combination that WOULD have ranked at the top on soft preferences but was
 * discarded because it violates a hard constraint (double booking / unavailability).
 * Surfaced so Conflict Detection can explain the fallback instead of silently
 * skipping the preferred sitting.
 */
export type BlockedCandidate = {
  judge: Judge;
  courtroom: Courtroom;
  slot: Slot;
  score: number;
  reasons: string[];
};

export type EngineResult = {
  candidates: Candidate[];
  evaluated: number;
  valid: number;
  rejections: RejectionCounts;
  blocked: BlockedCandidate | null;
};

/* ------------------------------------------------------------------ helpers */

const toMinutes = (time: string) => {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
};

export const slotMinutes = (slot: Slot) => toMinutes(slot.end_time) - toMinutes(slot.start_time);

const overlaps = (a: Slot, b: Slot) =>
  a.date === b.date &&
  toMinutes(a.start_time) < toMinutes(b.end_time) &&
  toMinutes(b.start_time) < toMinutes(a.end_time);

const isActiveSchedule = (status: string) => status === "proposed" || status === "confirmed";

const norm = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

/** Specialisation match is a soft preference only — a mismatch never invalidates a slot. */
export function specialisationMatch(judge: Judge, categoryName: string | null): number {
  if (!categoryName || !judge.specialisation) return 0;
  const a = judge.specialisation.toLowerCase();
  const b = categoryName.toLowerCase();
  if (a === b) return 1;
  const wordsA = norm(a);
  const wordsB = norm(b);
  const setA = new Set(wordsA);
  const shared = wordsB.filter((word) => setA.has(word)).length;
  // Full token overlap ("Commercial Law" vs "Commercial Dispute") is treated as a
  // domain match; partial overlap ranks lower; substring containment sits between.
  if (shared > 0 && shared >= Math.min(wordsA.length, wordsB.length)) return 0.9;
  if (a.includes(b) || b.includes(a)) return 0.85;
  return shared > 0 ? 0.6 : 0;
}

/* ------------------------------------------------------------- hard filters */

/**
 * Availability convention: a slot counts as unavailable only when an explicit
 * `unavailable` record exists for that entity + date + slot. Anything else is open.
 */
function isEntityUnavailable(
  availability: AvailabilityRecord[],
  entityType: "judge" | "courtroom",
  entityId: string,
  slot: Slot,
) {
  return availability.some(
    (row) =>
      row.entity_type === entityType &&
      row.entity_id === entityId &&
      row.slot_id === slot.id &&
      row.status === "unavailable",
  );
}

/* -------------------------------------------------------------- the engine */

export function runSchedulingEngine(target: CaseRow, data: EngineData): EngineResult {
  const rejections: RejectionCounts = {
    holidayClosure: 0,
    judgeUnavailable: 0,
    courtroomUnavailable: 0,
    judgeBooked: 0,
    courtroomBooked: 0,
    slotOccupied: 0,
    durationOverflow: 0,
  };

  const active = data.schedules.filter((s) => isActiveSchedule(s.status) && s.hearing_slots);
  const duration = Math.max(
    1,
    target.predicted_duration_minutes || target.estimated_duration_minutes || 60,
  );
  const categoryName = target.case_categories?.name ?? null;
  const priorityNorm = Math.min(1, Math.max(0, (target.priority_score ?? 50) / 100));
  const weights = data.weights ?? DEFAULT_SCHEDULING_WEIGHTS;

  // Slots sorted chronologically — index 0 is the earliest sitting available.
  const slots = [...data.slots].sort((a, b) =>
    a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date),
  );
  const lastIndex = Math.max(1, slots.length - 1);

  // Courtroom utilisation reference: how loaded each room already is.
  const roomBookings = new Map<string, number>();
  for (const s of active)
    if (s.courtroom_id)
      roomBookings.set(s.courtroom_id, (roomBookings.get(s.courtroom_id) ?? 0) + 1);
  const busiestRoom = Math.max(1, ...[...roomBookings.values(), 1]);

  const candidates: Candidate[] = [];
  let blocked: BlockedCandidate | null = null;
  let evaluated = 0;

  /** Soft-preference scoring — identical for valid and blocked combinations. */
  const scoreCombo = (
    judge: Judge,
    courtroom: Courtroom,
    slot: Slot,
    slotIndex: number,
  ): SoftFactor[] => {
    const match = specialisationMatch(judge, categoryName);
    const workloadRatio = 1 - Math.min(1, judge.current_workload / MAX_JUDGE_WORKLOAD);
    const earliness = 1 - slotIndex / lastIndex;
    const roomLoad = roomBookings.get(courtroom.id) ?? 0;
    const utilisation = 1 - roomLoad / busiestRoom;

    return [
      {
        key: "specialisation",
        label: "Specialisation fit",
        detail:
          match > 0
            ? `${judge.specialisation || "General"} covers ${categoryName ?? "this category"}`
            : `General listing (${judge.specialisation || "General"})`,
        weight: weights.specialisation,
        points: round1(weights.specialisation * match),
      },
      {
        key: "workload",
        label: "Workload balance",
        detail: `${judge.current_workload} of ${data.maxJudgeWorkload} active hearings`,
        weight: weights.workload,
        points: round1(weights.workload * workloadRatio),
      },
      {
        key: "priority",
        label: "Priority slot match",
        detail:
          priorityNorm >= 0.7
            ? "High Priority Score — early slot prioritized"
            : "Standard scheduling window",
        weight: weights.priority,
        points: round1(weights.priority * (priorityNorm * 0.5 + earliness * 0.5)),
      },
      {
        key: "utilisation",
        label: "Courtroom utilisation",
        detail: `${roomBookings.get(courtroom.id) ?? 0} existing bookings in ${courtroom.name}`,
        weight: weights.utilisation,
        points: round1(weights.utilisation * utilisation),
      },
    ];
  };

  const total = (factors: SoftFactor[]) => round1(factors.reduce((sum, f) => sum + f.points, 0));

  const noteBlocked = (
    judge: Judge,
    courtroom: Courtroom,
    slot: Slot,
    slotIndex: number,
    reasons: string[],
  ) => {
    const score = total(scoreCombo(judge, courtroom, slot, slotIndex));
    if (!blocked || score > blocked.score) blocked = { judge, courtroom, slot, score, reasons };
  };

  slots.forEach((slot, slotIndex) => {
    // HARD CONSTRAINT 0 — Court holiday or closed sitting day.
    const holidayCheck = checkCourtHoliday(slot.date, data.courtHolidays);
    if (holidayCheck.isHoliday) {
      rejections.holidayClosure += data.judges.length * data.courtrooms.length;
      return;
    }

    // HARD CONSTRAINT 4 — the estimated hearing must fit inside the slot length.
    if (duration > slotMinutes(slot)) {
      rejections.durationOverflow += data.judges.length * data.courtrooms.length;
      return;
    }

    const slotTaken = active.some((s) => s.slot_id === slot.id && s.cases?.id !== target.id);

    for (const judge of data.judges) {
      // HARD CONSTRAINT 5 — judge workload must stay within the configured threshold.
      if (judge.current_workload + 1 > data.maxJudgeWorkload) continue;
      // HARD CONSTRAINT 1 — judge availability.
      const judgeFree = !isEntityUnavailable(data.availability, "judge", judge.id, slot);
      // HARD CONSTRAINT 3a — judge not already sitting in an overlapping hearing.
      const judgeClash = active.some(
        (s) => s.judge_id === judge.id && s.hearing_slots && overlaps(s.hearing_slots, slot),
      );

      for (const courtroom of data.courtrooms) {
        evaluated += 1;

        if (!judgeFree) {
          rejections.judgeUnavailable += 1;
          noteBlocked(judge, courtroom, slot, slotIndex, [
            `${judge.name} is marked unavailable for ${formatSlotLabel(slot)}.`,
          ]);
          continue;
        }
        if (judgeClash) {
          rejections.judgeBooked += 1;
          noteBlocked(judge, courtroom, slot, slotIndex, [
            `${judge.name} is already sitting in an overlapping hearing at ${formatSlotLabel(slot)}.`,
          ]);
          continue;
        }
        // HARD CONSTRAINT 2 — courtroom availability.
        if (isEntityUnavailable(data.availability, "courtroom", courtroom.id, slot)) {
          rejections.courtroomUnavailable += 1;
          noteBlocked(judge, courtroom, slot, slotIndex, [
            `${courtroom.name} is marked unavailable for ${formatSlotLabel(slot)}.`,
          ]);
          continue;
        }
        // HARD CONSTRAINT 3b — courtroom not already occupied at an overlapping time.
        if (
          active.some(
            (s) =>
              s.courtroom_id === courtroom.id && s.hearing_slots && overlaps(s.hearing_slots, slot),
          )
        ) {
          rejections.courtroomBooked += 1;
          noteBlocked(judge, courtroom, slot, slotIndex, [
            `${courtroom.name} is already booked for an overlapping hearing at ${formatSlotLabel(slot)}.`,
          ]);
          continue;
        }
        // HARD CONSTRAINT 3c — the slot itself is not already allocated.
        if (slotTaken) {
          rejections.slotOccupied += 1;
          // Not reported as a "blocked preference": a fully allocated sitting is ordinary
          // capacity, not a clash with this case's preferred judge or courtroom.
          continue;
        }

        /* ---------------- soft preferences: ranking only ---------------- */
        const factors = scoreCombo(judge, courtroom, slot, slotIndex);

        candidates.push({
          key: `${judge.id}:${courtroom.id}:${slot.id}`,
          judge,
          courtroom,
          slot,
          score: total(factors),
          confidence: confidenceForFactors(total(factors), factors),
          factors,
        });
      }
    }
  });

  // Deterministic ordering: score desc, then earliest slot, then stable id ordering.
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.slot.date.localeCompare(b.slot.date) ||
      a.slot.start_time.localeCompare(b.slot.start_time) ||
      a.key.localeCompare(b.key),
  );

  // One recommendation per slot keeps the alternatives meaningfully different.
  const seenSlots = new Set<string>();
  const spread = candidates.filter((c) => {
    if (seenSlots.has(c.slot.id)) return false;
    seenSlots.add(c.slot.id);
    return true;
  });

  // Only report the blocked preference when it actually outranks the best valid option —
  // otherwise the engine did not have to fall back on anything.
  const bestValid = candidates[0]?.score ?? -1;
  const blockedTop: BlockedCandidate | null =
    blocked && (blocked as BlockedCandidate).score > bestValid ? blocked : null;

  return {
    candidates: spread,
    evaluated,
    valid: candidates.length,
    rejections,
    blocked: blockedTop,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/* ---------------------------------------------------------------- queries */

export const schedulingDataQuery = {
  queryKey: ["scheduling-engine-data"],
  queryFn: async (): Promise<EngineData> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const [judges, courtrooms, slots, availability, schedules, settings, holidaysRes] =
      await Promise.all([
        supabase.from("judges").select("*").order("name"),
        supabase.from("courtrooms").select("*").order("name"),
        supabase
          .from("hearing_slots")
          .select("id, date, start_time, end_time")
          .gte("date", from)
          .order("date"),
        supabase
          .from("availability")
          .select("entity_type, entity_id, date, slot_id, status")
          .gte("date", from),
        supabase
          .from("schedules")
          .select(
            "id, status, judge_id, courtroom_id, slot_id, cases(id), hearing_slots(id, date, start_time, end_time)",
          ),
        supabase
          .from("priority_settings")
          .select(
            "max_judge_workload, sched_specialisation_weight, sched_workload_weight, sched_priority_weight, sched_utilisation_weight",
          )
          .limit(1)
          .maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("court_holidays")
          .select("id, date, name, type, jurisdiction")
          .order("date"),
      ]);

    for (const res of [judges, courtrooms, slots, availability, schedules]) {
      if (res.error) throw res.error;
    }

    const holidays =
      holidaysRes?.data && holidaysRes.data.length > 0
        ? (holidaysRes.data as unknown as CourtHoliday[])
        : DEFAULT_COURT_HOLIDAYS_2026;

    return {
      judges: (judges.data ?? []) as Judge[],
      courtrooms: (courtrooms.data ?? []) as Courtroom[],
      slots: (slots.data ?? []) as Slot[],
      availability: (availability.data ?? []) as AvailabilityRecord[],
      schedules: (schedules.data ?? []) as unknown as OccupiedSchedule[],
      maxJudgeWorkload: settings.data?.max_judge_workload ?? 25,
      weights: {
        specialisation: Number(
          settings.data?.sched_specialisation_weight ?? DEFAULT_SCHEDULING_WEIGHTS.specialisation,
        ),
        workload: Number(
          settings.data?.sched_workload_weight ?? DEFAULT_SCHEDULING_WEIGHTS.workload,
        ),
        priority: Number(
          settings.data?.sched_priority_weight ?? DEFAULT_SCHEDULING_WEIGHTS.priority,
        ),
        utilisation: Number(
          settings.data?.sched_utilisation_weight ?? DEFAULT_SCHEDULING_WEIGHTS.utilisation,
        ),
      },
      courtHolidays: holidays,
    };
  },
};

export function formatSlotLabel(slot: Slot) {
  const date = new Date(`${slot.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${date} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}

/**
 * Deterministic confidence for the top recommendation.
 *
 * Two ingredients, no AI and no randomness:
 *   1. Hard constraints — every candidate returned by the engine has already passed
 *      all six hard checks, which is worth a flat 15 points of confidence.
 *   2. Soft-preference fit — the share of the available ranking weight the top
 *      candidate actually earned, worth the remaining 85 points.
 */
/**
 * Per-candidate confidence — the share of the available soft-preference weight the
 * combination earned (85 pts) plus a flat 15 pts for clearing every hard constraint.
 */
export function confidenceForFactors(score: number, factors: SoftFactor[]) {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0) || 100;
  const fitRatio = Math.min(1, Math.max(0, score / totalWeight));
  return Math.round(15 + 85 * fitRatio);
}

export function confidenceFor(candidates: Candidate[]): {
  value: number;
  fitRatio: number;
  margin: number;
} | null {
  const top = candidates[0];
  if (!top) return null;
  const totalWeight = top.factors.reduce((sum, f) => sum + f.weight, 0) || 100;
  const fitRatio = Math.min(1, top.score / totalWeight);
  const second = candidates[1];
  const margin = second ? Math.max(0, round1(top.score - second.score)) : round1(top.score);
  return { value: Math.round(15 + 85 * fitRatio), fitRatio, margin };
}
