import type { AdjournmentRow, CaseRow, CaseStatus } from "@/lib/cases";
import { formatDate } from "@/lib/cases";
import { formatSlot, isActive, type ScheduleRow } from "@/lib/registry";

export type TimelineStepKey = "registered" | "scheduled" | "heard" | "adjourned" | "closed";

export type TimelineState = "done" | "current" | "pending" | "skipped";

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
  state: TimelineState;
  /** When the transition actually happened, blank when it has not happened yet. */
  timestamp: string | null;
  /** Plain-language evidence pulled from the case's own records. */
  detail: string;
};

/** Where each live case status sits on the lifecycle track. */
const STATUS_STAGE: Record<CaseStatus, TimelineStepKey> = {
  filed: "registered",
  scheduled: "scheduled",
  in_progress: "heard",
  adjourned: "adjourned",
  disposed: "closed",
};

const ORDER: TimelineStepKey[] = ["registered", "scheduled", "heard", "adjourned", "closed"];

const earliest = (values: (string | null | undefined)[]) =>
  values.filter((v): v is string => Boolean(v)).sort()[0] ?? null;

const latest = (values: (string | null | undefined)[]) =>
  values
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

/**
 * Derives the lifecycle timeline for one case from what is actually recorded against it:
 * its schedules, its adjournments and its current status. Nothing here is hardcoded per case.
 */
export function buildCaseTimeline(
  record: CaseRow,
  schedules: ScheduleRow[],
  adjournments: AdjournmentRow[],
): TimelineStep[] {
  const caseSchedules = schedules.filter((s) => s.cases?.id === record.id);
  const activeSchedule = caseSchedules.find((s) => isActive(s.status));
  const completedSchedules = caseSchedules.filter((s) => s.status === "completed");
  const stage = STATUS_STAGE[record.status] ?? "registered";
  const stageIndex = ORDER.indexOf(stage);

  const scheduledAt = earliest(caseSchedules.map((s) => s.created_at));
  const heardAt = latest(completedSchedules.map((s) => s.created_at));
  const lastAdjournedAt = latest(adjournments.map((a) => a.created_at));
  const adjournmentCount = adjournments.length;

  const reached: Record<TimelineStepKey, boolean> = {
    registered: true,
    scheduled: caseSchedules.length > 0 || stageIndex >= 1,
    heard: completedSchedules.length > 0 || stageIndex >= 2,
    adjourned:
      adjournmentCount > 0 || record.previous_adjournments > 0 || record.status === "adjourned",
    closed: record.status === "disposed",
  };

  const stateFor = (key: TimelineStepKey): TimelineState => {
    if (key === stage) return "current";
    if (reached[key]) return "done";
    if (key === "adjourned") return "skipped";
    return "pending";
  };

  const scheduleDetail = () => {
    if (activeSchedule) {
      return `Listed before ${activeSchedule.judges?.name ?? "an unassigned judge"} in ${
        activeSchedule.courtrooms?.name ?? "an unassigned courtroom"
      } — ${formatSlot(activeSchedule.hearing_slots)}.`;
    }
    if (caseSchedules.length > 0) {
      return `${caseSchedules.length} listing${caseSchedules.length === 1 ? "" : "s"} recorded; none currently active.`;
    }
    return "No hearing has been listed for this case yet.";
  };

  const heardDetail = () => {
    if (completedSchedules.length > 0) {
      const last = completedSchedules.at(-1)!;
      return `${completedSchedules.length} completed sitting${
        completedSchedules.length === 1 ? "" : "s"
      } — most recently ${formatSlot(last.hearing_slots)}.`;
    }
    if (record.status === "in_progress") return "Hearing is in progress.";
    return "No sitting has been heard yet.";
  };

  const adjournedDetail = () => {
    if (adjournmentCount === 0) {
      if (record.previous_adjournments > 0)
        return `${record.previous_adjournments} prior adjournment${
          record.previous_adjournments === 1 ? "" : "s"
        } counted on the case record; no itemised adjournment entry filed.`;
      return record.status === "adjourned"
        ? "Case marked adjourned; no adjournment record filed."
        : "No adjournment recorded — this step does not apply.";
    }
    const last = adjournments.at(-1)!;
    return `${adjournmentCount} adjournment${adjournmentCount === 1 ? "" : "s"} on record — latest reason: ${
      last.reason || "not stated"
    }.`;
  };

  const closedDetail = () =>
    record.status === "disposed"
      ? "Case disposed and closed on the register."
      : "Case is still live on the register.";

  return [
    {
      key: "registered",
      label: "Registered",
      state: stateFor("registered"),
      timestamp: formatDate(record.filing_date),
      detail: `Filed on ${formatDate(record.filing_date)} and entered on the register.`,
    },
    {
      key: "scheduled",
      label: "Scheduled",
      state: stateFor("scheduled"),
      timestamp: scheduledAt ? formatDate(scheduledAt) : null,
      detail: scheduleDetail(),
    },
    {
      key: "heard",
      label: "Heard",
      state: stateFor("heard"),
      timestamp: heardAt ? formatDate(heardAt) : null,
      detail: heardDetail(),
    },
    {
      key: "adjourned",
      label: "Adjourned",
      state: stateFor("adjourned"),
      timestamp: lastAdjournedAt ? formatDate(lastAdjournedAt) : null,
      detail: adjournedDetail(),
    },
    {
      key: "closed",
      label: "Closed",
      state: stateFor("closed"),
      timestamp: null,
      detail: closedDetail(),
    },
  ];
}
