/**
 * What-If simulation.
 *
 * Everything in this module is pure and in-memory until `applySimulation` is called.
 * The simulated change (e.g. a judge marked unavailable on a date) is layered on top
 * of a COPY of the engine data, so the live schedule is never touched while exploring.
 *
 * Alternatives are produced by the same deterministic scheduling engine used by the
 * Smart Scheduling page — no AI, no randomness.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CaseRow } from "@/lib/cases";
import {
  runSchedulingEngine,
  type AvailabilityRecord,
  type Candidate,
  type EngineData,
  type OccupiedSchedule,
  type Slot,
} from "@/lib/scheduling";
import type { Courtroom, Judge } from "@/lib/registry";

export type AffectedHearing = {
  scheduleId: string;
  caseRow: CaseRow;
  slot: Slot;
  judge: Judge;
  courtroom: Courtroom | null;
  alternatives: Candidate[];
};

export type SimulationResult = {
  judge: Judge;
  date: string;
  affected: AffectedHearing[];
  totalAlternatives: number;
  unresolved: number;
};

const isActive = (status: string) => status === "proposed" || status === "confirmed";

/** Builds synthetic `unavailable` rows for a judge across every slot on a date. */
export function simulatedUnavailability(
  judgeId: string,
  date: string,
  slots: Slot[],
): AvailabilityRecord[] {
  return slots
    .filter((slot) => slot.date === date)
    .map((slot) => ({
      entity_type: "judge" as const,
      entity_id: judgeId,
      date,
      slot_id: slot.id,
      status: "unavailable" as const,
    }));
}

/**
 * Runs the what-if scenario entirely in memory.
 * `maxAlternatives` alternatives are found per affected hearing, reserving each
 * hearing's top pick before evaluating the next so the proposals never collide.
 */
export function simulateJudgeUnavailable(params: {
  judgeId: string;
  date: string;
  data: EngineData;
  cases: CaseRow[];
  maxAlternatives?: number;
}): SimulationResult | null {
  const { judgeId, date, data, cases, maxAlternatives = 3 } = params;
  const judge = data.judges.find((j) => j.id === judgeId);
  if (!judge) return null;

  const affectedSchedules = data.schedules.filter(
    (s) => isActive(s.status) && s.judge_id === judgeId && s.hearing_slots?.date === date,
  );

  // Layered simulation state — copies only, the real data is untouched.
  const availability = [
    ...data.availability,
    ...simulatedUnavailability(judgeId, date, data.slots),
  ];
  const affectedIds = new Set(affectedSchedules.map((s) => s.id));
  // Freed-up bookings: the affected hearings no longer occupy their judge/room/slot.
  let schedules: OccupiedSchedule[] = data.schedules.filter((s) => !affectedIds.has(s.id));
  const judges = data.judges.map((j) =>
    j.id === judgeId ? j : { ...j, current_workload: j.current_workload },
  );

  const affected: AffectedHearing[] = [];

  const ordered = [...affectedSchedules].sort((a, b) =>
    (a.hearing_slots?.start_time ?? "").localeCompare(b.hearing_slots?.start_time ?? ""),
  );

  for (const schedule of ordered) {
    const caseRow = cases.find((c) => c.id === schedule.cases?.id);
    const slot = schedule.hearing_slots;
    if (!caseRow || !slot) continue;

    const result = runSchedulingEngine(caseRow, {
      ...data,
      judges,
      availability,
      schedules,
    });
    const alternatives = result.candidates
      .filter((c) => c.judge.id !== judgeId)
      .slice(0, maxAlternatives);

    // Reserve the top pick so the next hearing cannot be offered the same triple.
    const top = alternatives[0];
    if (top) {
      schedules = [
        ...schedules,
        {
          id: `sim:${schedule.id}`,
          status: "proposed",
          judge_id: top.judge.id,
          courtroom_id: top.courtroom.id,
          slot_id: top.slot.id,
          cases: { id: caseRow.id },
          hearing_slots: top.slot,
        },
      ];
    }

    const courtroom = data.courtrooms.find((c) => c.id === schedule.courtroom_id) ?? null;
    affected.push({ scheduleId: schedule.id, caseRow, slot, judge, courtroom, alternatives });
  }

  const totalAlternatives = affected.reduce((sum, a) => sum + a.alternatives.length, 0);
  const unresolved = affected.filter((a) => a.alternatives.length === 0).length;

  return { judge, date, affected, totalAlternatives, unresolved };
}

/* ------------------------------------------------- courtroom closure scenario */

export type CourtroomSimulationResult = {
  courtroom: Courtroom;
  date: string;
  affected: AffectedHearing[];
  totalAlternatives: number;
  unresolved: number;
};

/** Builds synthetic `unavailable` rows for a courtroom across every slot on a date. */
export function simulatedCourtroomUnavailability(
  courtroomId: string,
  date: string,
  slots: Slot[],
): AvailabilityRecord[] {
  return slots
    .filter((slot) => slot.date === date)
    .map((slot) => ({
      entity_type: "courtroom" as const,
      entity_id: courtroomId,
      date,
      slot_id: slot.id,
      status: "unavailable" as const,
    }));
}

/**
 * Runs the courtroom emergency infrastructure closure scenario.
 */
export function simulateCourtroomClosure(params: {
  courtroomId: string;
  date: string;
  data: EngineData;
  cases: CaseRow[];
  maxAlternatives?: number;
}): CourtroomSimulationResult | null {
  const { courtroomId, date, data, cases, maxAlternatives = 3 } = params;
  const courtroom = data.courtrooms.find((c) => c.id === courtroomId);
  if (!courtroom) return null;

  const affectedSchedules = data.schedules.filter(
    (s) => isActive(s.status) && s.courtroom_id === courtroomId && s.hearing_slots?.date === date,
  );

  const availability = [
    ...data.availability,
    ...simulatedCourtroomUnavailability(courtroomId, date, data.slots),
  ];
  const affectedIds = new Set(affectedSchedules.map((s) => s.id));
  let schedules: OccupiedSchedule[] = data.schedules.filter((s) => !affectedIds.has(s.id));

  const affected: AffectedHearing[] = [];
  const ordered = [...affectedSchedules].sort((a, b) =>
    (a.hearing_slots?.start_time ?? "").localeCompare(b.hearing_slots?.start_time ?? ""),
  );

  for (const schedule of ordered) {
    const caseRow = cases.find((c) => c.id === schedule.cases?.id);
    const slot = schedule.hearing_slots;
    const judge = data.judges.find((j) => j.id === schedule.judge_id);
    if (!caseRow || !slot || !judge) continue;

    const result = runSchedulingEngine(caseRow, {
      ...data,
      availability,
      schedules,
    });
    const alternatives = result.candidates
      .filter((c) => c.courtroom.id !== courtroomId)
      .slice(0, maxAlternatives);

    const top = alternatives[0];
    if (top) {
      schedules = [
        ...schedules,
        {
          id: `sim:room:${schedule.id}`,
          status: "proposed",
          judge_id: top.judge.id,
          courtroom_id: top.courtroom.id,
          slot_id: top.slot.id,
          cases: { id: caseRow.id },
          hearing_slots: top.slot,
        },
      ];
    }

    affected.push({ scheduleId: schedule.id, caseRow, slot, judge, courtroom, alternatives });
  }

  const totalAlternatives = affected.reduce((sum, a) => sum + a.alternatives.length, 0);
  const unresolved = affected.filter((a) => a.alternatives.length === 0).length;

  return { courtroom, date, affected, totalAlternatives, unresolved };
}

/* ---------------------------------------------------- apply transactional commit */

/**
 * Persists a simulation choice into the live database.
 */
export async function applySimulationChoice(
  scheduleId: string,
  choice: Candidate,
  reason: string,
): Promise<void> {
  const { error: schedError } = await supabase
    .from("schedules")
    .update({
      judge_id: choice.judge.id,
      courtroom_id: choice.courtroom.id,
      slot_id: choice.slot.id,
      status: "confirmed",
    })
    .eq("id", scheduleId);
  if (schedError) throw schedError;

  await supabase.from("ai_recommendations").insert({
    schedule_id: scheduleId,
    reasoning: `What-If simulation reassignment: ${reason} (Fit score ${choice.score}/100, Confidence ${choice.confidence}%)`,
    status: "accepted",
  });
}

/**
 * COMMIT STEP — the only function here that writes. Persists the simulated judge
 * unavailability and reassigns each affected hearing to its chosen alternative.
 */
export async function applySimulation(params: {
  result: SimulationResult;
  choices: Record<string, string>;
  slots: Slot[];
  userId: string;
}) {
  const { result, choices, slots, userId } = params;
  const rows = simulatedUnavailability(result.judge.id, result.date, slots);

  if (rows.length > 0) {
    const { error } = await supabase.from("availability").insert(rows);
    if (error) throw error;
  }

  let reassigned = 0;
  for (const hearing of result.affected) {
    const candidate = hearing.alternatives.find((c) => c.key === choices[hearing.scheduleId]);
    if (!candidate) continue;
    const { error } = await supabase
      .from("schedules")
      .update({
        judge_id: candidate.judge.id,
        courtroom_id: candidate.courtroom.id,
        slot_id: candidate.slot.id,
      })
      .eq("id", hearing.scheduleId);
    if (error) throw error;
    reassigned += 1;
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action: `Applied what-if simulation — ${result.judge.name} marked unavailable on ${result.date}; ${reassigned} hearing(s) reassigned`,
    entity_affected: `judge:${result.judge.id} date:${result.date}`,
  });
  if (auditError) throw auditError;

  return { reassigned };
}

/**
 * Persists the simulated courtroom closure and reassigns each affected hearing.
 */
export async function applyCourtroomSimulation(params: {
  result: CourtroomSimulationResult;
  choices: Record<string, string>;
  slots: Slot[];
  userId: string;
}) {
  const { result, choices, slots, userId } = params;
  const rows = simulatedCourtroomUnavailability(result.courtroom.id, result.date, slots);

  if (rows.length > 0) {
    const { error } = await supabase.from("availability").insert(rows);
    if (error) throw error;
  }

  let reassigned = 0;
  for (const hearing of result.affected) {
    const candidate = hearing.alternatives.find((c) => c.key === choices[hearing.scheduleId]);
    if (!candidate) continue;
    const { error } = await supabase
      .from("schedules")
      .update({
        judge_id: candidate.judge.id,
        courtroom_id: candidate.courtroom.id,
        slot_id: candidate.slot.id,
      })
      .eq("id", hearing.scheduleId);
    if (error) throw error;
    reassigned += 1;
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action: `Applied what-if simulation — ${result.courtroom.name} marked closed on ${result.date}; ${reassigned} hearing(s) reassigned`,
    entity_affected: `courtroom:${result.courtroom.id} date:${result.date}`,
  });
  if (auditError) throw auditError;

  return { reassigned };
}
