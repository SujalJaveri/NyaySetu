/**
 * Deterministic conflict detection.
 *
 * Every hard constraint in the scheduling engine has a matching check here, so a
 * manual assignment and an engine-produced assignment are validated by the exact
 * same rules. No AI, no heuristics — a conflict is either present or it is not.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Courtroom, Judge } from "@/lib/registry";
import type { AvailabilityRecord, Slot } from "@/lib/scheduling";
import { formatSlotLabel, slotMinutes } from "@/lib/scheduling";
import { checkCourtHoliday, DEFAULT_COURT_HOLIDAYS_2026, type CourtHoliday } from "@/lib/holidays";

export const DEFAULT_MAX_JUDGE_WORKLOAD = 25;

export type ConflictKind =
  | "holiday_closure"
  | "judge_booked"
  | "courtroom_booked"
  | "judge_unavailable"
  | "courtroom_unavailable"
  | "slot_occupied"
  | "duration_overflow"
  | "workload_exceeded";

export type Conflict = {
  kind: ConflictKind;
  /** Short label, e.g. "Judge double-booked". */
  title: string;
  /** Full inline message shown to the user. */
  message: string;
  severity: "blocking" | "warning";
};

export const conflictLabel: Record<ConflictKind, string> = {
  holiday_closure: "Gazetted holiday / non-sitting day",
  judge_booked: "Judge double-booked",
  courtroom_booked: "Courtroom double-booked",
  judge_unavailable: "Judge marked unavailable",
  courtroom_unavailable: "Courtroom marked unavailable",
  slot_occupied: "Hearing slot already allocated",
  duration_overflow: "Duration does not fit the slot",
  workload_exceeded: "Judge workload threshold exceeded",
};

export type ScheduleOccupancy = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  slot_id: string | null;
  case_number: string;
  judge_name: string | null;
  courtroom_name: string | null;
  slot: Slot | null;
};

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const overlaps = (a: Slot, b: Slot) =>
  a.date === b.date &&
  toMinutes(a.start_time) < toMinutes(b.end_time) &&
  toMinutes(b.start_time) < toMinutes(a.end_time);

export const isActiveSchedule = (status: string) => status === "proposed" || status === "confirmed";

const unavailable = (
  availability: AvailabilityRecord[],
  entityType: "judge" | "courtroom",
  entityId: string,
  slotId: string,
) =>
  availability.some(
    (a) =>
      a.entity_type === entityType &&
      a.entity_id === entityId &&
      a.slot_id === slotId &&
      a.status === "unavailable",
  );

/**
 * Validates one proposed assignment. Returns every violated hard constraint —
 * an empty array means the assignment may proceed.
 */
export function detectAssignmentConflicts(params: {
  caseNumber: string;
  caseId: string;
  estimatedDurationMinutes: number;
  judge: Pick<Judge, "id" | "name" | "current_workload">;
  courtroom: Pick<Courtroom, "id" | "name">;
  slot: Slot;
  schedules: ScheduleOccupancy[];
  availability: AvailabilityRecord[];
  maxJudgeWorkload: number;
  courtHolidays?: CourtHoliday[];
}): Conflict[] {
  const { caseNumber, judge, courtroom, slot, availability, maxJudgeWorkload, courtHolidays } =
    params;
  const active = params.schedules.filter(
    (s) => isActiveSchedule(s.status) && s.case_number !== caseNumber,
  );
  const conflicts: Conflict[] = [];
  const when = formatSlotLabel(slot);

  const holidayCheck = checkCourtHoliday(slot.date, courtHolidays);
  if (holidayCheck.isHoliday) {
    conflicts.push({
      kind: "holiday_closure",
      title: conflictLabel.holiday_closure,
      message: `Conflict: ${slot.date} is a court closure day (${holidayCheck.holidayName || "Gazetted Holiday"}). No hearings may be listed.`,
      severity: "blocking",
    });
  }

  if (unavailable(availability, "judge", judge.id, slot.id)) {
    conflicts.push({
      kind: "judge_unavailable",
      title: conflictLabel.judge_unavailable,
      message: `Conflict: Judge ${judge.name} is marked unavailable at ${when}.`,
      severity: "blocking",
    });
  }
  if (unavailable(availability, "courtroom", courtroom.id, slot.id)) {
    conflicts.push({
      kind: "courtroom_unavailable",
      title: conflictLabel.courtroom_unavailable,
      message: `Conflict: ${courtroom.name} is marked unavailable at ${when}.`,
      severity: "blocking",
    });
  }

  const judgeClash = active.find(
    (s) => s.judge_id === judge.id && s.slot && overlaps(s.slot, slot),
  );
  if (judgeClash) {
    conflicts.push({
      kind: "judge_booked",
      title: conflictLabel.judge_booked,
      message: `Conflict: Judge ${judge.name} is already scheduled for Case ${judgeClash.case_number} at this time (${formatSlotLabel(judgeClash.slot!)}).`,
      severity: "blocking",
    });
  }

  const roomClash = active.find(
    (s) => s.courtroom_id === courtroom.id && s.slot && overlaps(s.slot, slot),
  );
  if (roomClash) {
    conflicts.push({
      kind: "courtroom_booked",
      title: conflictLabel.courtroom_booked,
      message: `Conflict: ${courtroom.name} is already occupied by Case ${roomClash.case_number} at this time (${formatSlotLabel(roomClash.slot!)}).`,
      severity: "blocking",
    });
  }

  const slotTaken = active.find((s) => s.slot_id === slot.id);
  if (slotTaken && !judgeClash && !roomClash) {
    conflicts.push({
      kind: "slot_occupied",
      title: conflictLabel.slot_occupied,
      message: `Conflict: the hearing slot ${when} is already allocated to Case ${slotTaken.case_number}.`,
      severity: "blocking",
    });
  }

  if (params.estimatedDurationMinutes > slotMinutes(slot)) {
    conflicts.push({
      kind: "duration_overflow",
      title: conflictLabel.duration_overflow,
      message: `Conflict: Case ${caseNumber} needs ${params.estimatedDurationMinutes} min but the slot ${when} is only ${slotMinutes(slot)} min long.`,
      severity: "blocking",
    });
  }

  if (judge.current_workload + 1 > maxJudgeWorkload) {
    conflicts.push({
      kind: "workload_exceeded",
      title: conflictLabel.workload_exceeded,
      message: `Conflict: Judge ${judge.name} already carries ${judge.current_workload} active hearings — scheduling this case would exceed the configured threshold of ${maxJudgeWorkload}.`,
      severity: "blocking",
    });
  }

  return conflicts;
}

/* ----------------------------------------------------- system-wide scanning */

export type FlaggedConflict = Conflict & {
  scheduleId: string;
  caseNumber: string;
  judgeName: string | null;
  courtroomName: string | null;
  slotLabel: string;
};

export type ConflictScanInput = {
  schedules: ScheduleOccupancy[];
  availability: AvailabilityRecord[];
  judges: Judge[];
  durations: Record<string, number>;
  maxJudgeWorkload: number;
  courtHolidays?: CourtHoliday[];
};

/** Scans every active schedule in the system and returns all currently flagged conflicts. */
export function scanSystemConflicts(input: ConflictScanInput): FlaggedConflict[] {
  const active = input.schedules.filter((s) => isActiveSchedule(s.status) && s.slot);
  const found: FlaggedConflict[] = [];

  const push = (s: ScheduleOccupancy, conflict: Conflict) =>
    found.push({
      ...conflict,
      scheduleId: s.id,
      caseNumber: s.case_number,
      judgeName: s.judge_name,
      courtroomName: s.courtroom_name,
      slotLabel: s.slot ? formatSlotLabel(s.slot) : "Unscheduled",
    });

  // 1. Check for schedules falling on court holidays or closed sitting days
  for (const s of active) {
    if (!s.slot) continue;
    const holidayCheck = checkCourtHoliday(s.slot.date, input.courtHolidays);
    if (holidayCheck.isHoliday) {
      push(s, {
        kind: "holiday_closure",
        title: conflictLabel.holiday_closure,
        message: `Conflict: Case ${s.case_number} is scheduled on ${s.slot.date}, which is a non-sitting court day (${holidayCheck.holidayName || "Gazetted Holiday"}).`,
        severity: "blocking",
      });
    }
  }

  for (let i = 0; i < active.length; i += 1) {
    const a = active[i]!;
    for (let j = i + 1; j < active.length; j += 1) {
      const b = active[j]!;
      if (!a.slot || !b.slot || !overlaps(a.slot, b.slot)) continue;

      if (a.judge_id && a.judge_id === b.judge_id) {
        push(a, {
          kind: "judge_booked",
          title: conflictLabel.judge_booked,
          message: `Conflict: Judge ${a.judge_name ?? "—"} is scheduled for both Case ${a.case_number} and Case ${b.case_number} at ${formatSlotLabel(a.slot)}.`,
          severity: "blocking",
        });
      }
      if (a.courtroom_id && a.courtroom_id === b.courtroom_id) {
        push(a, {
          kind: "courtroom_booked",
          title: conflictLabel.courtroom_booked,
          message: `Conflict: ${a.courtroom_name ?? "—"} hosts both Case ${a.case_number} and Case ${b.case_number} at ${formatSlotLabel(a.slot)}.`,
          severity: "blocking",
        });
      }
      if (
        a.slot_id &&
        a.slot_id === b.slot_id &&
        a.judge_id !== b.judge_id &&
        a.courtroom_id !== b.courtroom_id
      ) {
        push(a, {
          kind: "slot_occupied",
          title: conflictLabel.slot_occupied,
          message: `Conflict: hearing slot ${formatSlotLabel(a.slot)} is allocated to both Case ${a.case_number} and Case ${b.case_number}.`,
          severity: "blocking",
        });
      }
    }
  }

  for (const s of active) {
    if (!s.slot || !s.slot_id) continue;
    if (s.judge_id && unavailable(input.availability, "judge", s.judge_id, s.slot_id)) {
      push(s, {
        kind: "judge_unavailable",
        title: conflictLabel.judge_unavailable,
        message: `Conflict: Judge ${s.judge_name ?? "—"} is marked unavailable at ${formatSlotLabel(s.slot)} but is scheduled for Case ${s.case_number}.`,
        severity: "blocking",
      });
    }
    if (s.courtroom_id && unavailable(input.availability, "courtroom", s.courtroom_id, s.slot_id)) {
      push(s, {
        kind: "courtroom_unavailable",
        title: conflictLabel.courtroom_unavailable,
        message: `Conflict: ${s.courtroom_name ?? "—"} is marked unavailable at ${formatSlotLabel(s.slot)} but hosts Case ${s.case_number}.`,
        severity: "blocking",
      });
    }
    const needed = input.durations[s.case_number];
    if (needed && needed > slotMinutes(s.slot)) {
      push(s, {
        kind: "duration_overflow",
        title: conflictLabel.duration_overflow,
        message: `Conflict: Case ${s.case_number} needs ${needed} min but is booked into a ${slotMinutes(s.slot)} min slot (${formatSlotLabel(s.slot)}).`,
        severity: "blocking",
      });
    }
  }

  const load = new Map<string, number>();
  for (const s of active) if (s.judge_id) load.set(s.judge_id, (load.get(s.judge_id) ?? 0) + 1);
  for (const judge of input.judges) {
    const count = Math.max(load.get(judge.id) ?? 0, judge.current_workload);
    if (count > input.maxJudgeWorkload) {
      found.push({
        scheduleId: "system",
        caseNumber: "—",
        judgeName: judge.name,
        courtroomName: null,
        slotLabel: "Active workload",
        kind: "workload_exceeded",
        title: conflictLabel.workload_exceeded,
        message: `Conflict: Judge ${judge.name} carries ${count} active hearings, above the configured threshold of ${input.maxJudgeWorkload}.`,
        severity: "blocking",
      });
    }
  }

  return found;
}

/* ---------------------------------------------------------------- queries */

const OCCUPANCY_SELECT =
  "id, status, judge_id, courtroom_id, slot_id, cases(case_number, estimated_duration_minutes), judges(name), courtrooms(name), hearing_slots(id, date, start_time, end_time)";

type OccupancyRaw = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  slot_id: string | null;
  cases: { case_number: string; estimated_duration_minutes: number } | null;
  judges: { name: string } | null;
  courtrooms: { name: string } | null;
  hearing_slots: Slot | null;
};

export async function fetchConflictData(db: any = supabase) {
  const [schedulesRes, availabilityRes, judgesRes, settingsRes, holidaysRes] =
    await Promise.all([
      db.from("schedules").select(OCCUPANCY_SELECT),
      db.from("availability").select("entity_type, entity_id, date, slot_id, status"),
      db.from("judges").select("*").order("name"),
      db.from("priority_settings").select("max_judge_workload").limit(1).maybeSingle(),
      (db as any)
        .from("court_holidays")
        .select("id, date, name, type, jurisdiction")
        .order("date"),
    ]);
  if (schedulesRes.error) throw schedulesRes.error;
  if (availabilityRes.error) throw availabilityRes.error;
  if (judgesRes.error) throw judgesRes.error;

  const raw = (schedulesRes.data ?? []) as unknown as OccupancyRaw[];
  const schedules: ScheduleOccupancy[] = raw.map((r) => ({
    id: r.id,
    status: r.status,
    judge_id: r.judge_id,
    courtroom_id: r.courtroom_id,
    slot_id: r.slot_id,
    case_number: r.cases?.case_number ?? "—",
    judge_name: r.judges?.name ?? null,
    courtroom_name: r.courtrooms?.name ?? null,
    slot: r.hearing_slots,
  }));
  const durations: Record<string, number> = {};
  for (const r of raw)
    if (r.cases) durations[r.cases.case_number] = r.cases.estimated_duration_minutes;

  const courtHolidays =
    holidaysRes?.data && holidaysRes.data.length > 0
      ? (holidaysRes.data as unknown as CourtHoliday[])
      : DEFAULT_COURT_HOLIDAYS_2026;

  return {
    schedules,
    durations,
    availability: (availabilityRes.data ?? []) as AvailabilityRecord[],
    judges: (judgesRes.data ?? []) as Judge[],
    maxJudgeWorkload: settingsRes.data?.max_judge_workload ?? DEFAULT_MAX_JUDGE_WORKLOAD,
    courtHolidays,
  };
}

export const conflictDataQuery = {
  queryKey: ["conflict-data"],
  queryFn: fetchConflictData,
};
