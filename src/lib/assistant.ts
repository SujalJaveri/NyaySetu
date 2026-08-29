/**
 * Registry Assistant — deterministic question answering.
 *
 * This is NOT an LLM and it never generates prose about data it did not read.
 * A question is matched against a small fixed set of intent patterns; each
 * intent runs a real Supabase query and every number/row shown comes straight
 * back from the database. If no pattern matches, the assistant says so and
 * lists what it can answer — it never guesses.
 */
import { supabase } from "@/integrations/supabase/client";
import { priorityBand } from "@/lib/cases";
import { DEFAULT_MAX_JUDGE_WORKLOAD, isActiveSchedule, scanSystemConflicts } from "@/lib/conflicts";
import type { Judge, Courtroom } from "@/lib/registry";

export type AssistantIntent =
  | "availability"
  | "high_priority_cases"
  | "unscheduled_cases"
  | "conflict_count"
  | "judge_workload"
  | "hearings_on_date"
  | "unknown";

export type AssistantRowTarget =
  | { route: "/cases/$caseId"; caseId: string }
  | { route: "/judges/$judgeId"; judgeId: string }
  | { route: "/courtrooms/$courtroomId"; courtroomId: string }
  | { route: "/conflicts" }
  | { route: "/calendar" };

export type AssistantRow = {
  id: string;
  label: string;
  detail: string;
  badge?: string;
  target?: AssistantRowTarget;
};

export type AssistantAnswer = {
  intent: AssistantIntent;
  /** One-sentence answer built from the real counts returned by the query. */
  summary: string;
  /** Plain-language description of exactly which tables/filters were read. */
  source: string;
  rows: AssistantRow[];
};

export const EXAMPLE_QUESTIONS = [
  "Which judges are free tomorrow afternoon?",
  "Show me high-priority pending cases",
  "How many conflicts are open right now?",
  "Which judges are nearing their workload?",
  "Which cases are still unscheduled?",
  "What hearings are listed today?",
];

/* ---------------------------------------------------------------- parsing */

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Resolves a date reference in the question. Defaults to today. */
export function parseDate(q: string): { date: string; label: string } {
  const explicit = q.match(/\d{4}-\d{2}-\d{2}/);
  if (explicit) return { date: explicit[0], label: explicit[0] };
  const today = new Date();
  if (/tomorrow/i.test(q)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { date: iso(d), label: "tomorrow" };
  }
  if (/yesterday/i.test(q)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { date: iso(d), label: "yesterday" };
  }
  return { date: iso(today), label: "today" };
}

export type PartOfDay = "morning" | "afternoon" | "all";

export function parsePartOfDay(q: string): PartOfDay {
  if (/morning/i.test(q)) return "morning";
  if (/afternoon|evening/i.test(q)) return "afternoon";
  return "all";
}

/** Deterministic keyword routing — first match wins, in this fixed order. */
export function classifyQuestion(question: string): AssistantIntent {
  const q = question.toLowerCase();
  if (/conflict/.test(q)) return "conflict_count";
  if (/(free|available|availability)/.test(q)) return "availability";
  if (/(workload|capacity|busiest|overloaded|load)/.test(q)) return "judge_workload";
  if (/(unscheduled|awaiting scheduling|not scheduled|no listing)/.test(q))
    return "unscheduled_cases";
  if (/(high[- ]?priority|tier\s*1|top priority)/.test(q)) return "high_priority_cases";
  if (/(hearing|listing|listed|scheduled|schedule)/.test(q)) return "hearings_on_date";
  return "unknown";
}

const timeLabel = (s: string) => s.slice(0, 5);
const inPart = (start: string, part: PartOfDay) =>
  part === "all" ? true : part === "morning" ? start < "12:00" : start >= "12:00";

const prettyDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

/* --------------------------------------------------------------- handlers */

async function answerAvailability(question: string, db = supabase): Promise<AssistantAnswer> {
  const { date, label } = parseDate(question);
  const part = parsePartOfDay(question);
  const wantsCourtrooms = /courtroom|room|court hall/i.test(question) && !/judge/i.test(question);
  const entityType = wantsCourtrooms ? "courtroom" : "judge";

  const [slotsRes, entitiesRes, availRes, schedulesRes] = await Promise.all([
    db
      .from("hearing_slots")
      .select("id, date, start_time, end_time")
      .eq("date", date)
      .order("start_time"),
    wantsCourtrooms
      ? db.from("courtrooms").select("*").order("name")
      : db.from("judges").select("*").order("name"),
    db
      .from("availability")
      .select("entity_type, entity_id, slot_id, status")
      .eq("date", date),
    db.from("schedules").select("id, status, judge_id, courtroom_id, slot_id"),
  ]);
  if (slotsRes.error) throw slotsRes.error;
  if (entitiesRes.error) throw entitiesRes.error;

  const slots = (slotsRes.data ?? []).filter((s) => inPart(s.start_time, part));
  const entities = (entitiesRes.data ?? []) as (Judge | Courtroom)[];
  const unavailable = new Set(
    (availRes.data ?? [])
      .filter((a) => a.entity_type === entityType && a.status === "unavailable")
      .map((a) => `${a.entity_id}:${a.slot_id}`),
  );
  const booked = new Set(
    (schedulesRes.data ?? [])
      .filter((s) => isActiveSchedule(s.status) && s.slot_id)
      .map((s) => `${wantsCourtrooms ? s.courtroom_id : s.judge_id}:${s.slot_id}`),
  );

  const partLabel = part === "all" ? "" : ` ${part}`;
  if (slots.length === 0) {
    return {
      intent: "availability",
      summary: `No hearing slots are published for ${label}${partLabel} (${prettyDate(date)}), so availability cannot be assessed.`,
      source: `hearing_slots where date = ${date}`,
      rows: [],
    };
  }

  const rows: AssistantRow[] = [];
  for (const e of entities) {
    const free = slots.filter(
      (s) => !unavailable.has(`${e.id}:${s.id}`) && !booked.has(`${e.id}:${s.id}`),
    );
    if (free.length === 0) continue;
    rows.push({
      id: e.id,
      label: e.name,
      detail: `Free at ${free.map((s) => `${timeLabel(s.start_time)}–${timeLabel(s.end_time)}`).join(", ")}`,
      badge: `${free.length}/${slots.length} slots`,
      target: wantsCourtrooms
        ? { route: "/courtrooms/$courtroomId", courtroomId: e.id }
        : { route: "/judges/$judgeId", judgeId: e.id },
    });
  }

  return {
    intent: "availability",
    summary: `${rows.length} of ${entities.length} ${wantsCourtrooms ? "courtrooms" : "judges"} have at least one free slot ${label}${partLabel} (${prettyDate(date)}).`,
    source: `hearing_slots + availability + schedules for ${date}${part === "all" ? "" : ` (${part} slots only)`}`,
    rows,
  };
}

async function answerCases(
  highPriorityOnly: boolean,
  unscheduledOnly: boolean,
  db = supabase,
): Promise<AssistantAnswer> {
  const [casesRes, schedulesRes] = await Promise.all([
    db
      .from("cases")
      .select("id, case_number, status, priority_score, filing_date, parties")
      .neq("status", "disposed")
      .order("priority_score", { ascending: false, nullsFirst: false }),
    db.from("schedules").select("case_id, status"),
  ]);
  if (casesRes.error) throw casesRes.error;

  const scheduled = new Set(
    (schedulesRes.data ?? []).filter((s) => isActiveSchedule(s.status)).map((s) => s.case_id),
  );

  let cases = casesRes.data ?? [];
  if (highPriorityOnly) cases = cases.filter((c) => priorityBand(c.priority_score) === "high");
  if (unscheduledOnly) cases = cases.filter((c) => !scheduled.has(c.id));

  const rows: AssistantRow[] = cases.slice(0, 25).map((c) => ({
    id: c.id,
    label: c.case_number,
    detail: `${c.parties || "Parties not recorded"} · filed ${prettyDate(c.filing_date)}${scheduled.has(c.id) ? "" : " · no active listing"}`,
    badge:
      c.priority_score == null ? "Pending calculation" : `Priority ${Math.round(c.priority_score)}`,
    target: { route: "/cases/$caseId", caseId: c.id },
  }));

  const what = highPriorityOnly ? "high Priority Score" : "pending";
  const where = unscheduledOnly ? " with no active listing" : "";
  return {
    intent: unscheduledOnly && !highPriorityOnly ? "unscheduled_cases" : "high_priority_cases",
    summary: `${cases.length} ${what} case(s)${where}.${cases.length > rows.length ? ` Showing the top ${rows.length} by Priority Score.` : ""}`,
    source: "cases (excluding disposed) joined against active schedules",
    rows,
  };
}

async function answerConflicts(db: any = supabase): Promise<AssistantAnswer> {
  const { fetchConflictData, scanSystemConflicts } = await import("@/lib/conflicts");
  const data = await fetchConflictData(db);
  const conflicts = scanSystemConflicts(data);
  const blocking = conflicts.filter((c) => c.severity === "blocking").length;

  return {
    intent: "conflict_count",
    summary:
      conflicts.length === 0
        ? "Conflict Detection reports no open conflicts across the live schedule."
        : `${conflicts.length} open conflict(s) — ${blocking} blocking, ${conflicts.length - blocking} warning.`,
    source:
      "Conflict Detection scan over every active schedule, availability record and workload cap",
    rows: conflicts.slice(0, 25).map((c, i) => ({
      id: `${c.scheduleId}-${c.kind}-${i}`,
      label: c.title,
      detail: `${c.caseNumber} · ${c.slotLabel}`,
      badge: c.severity === "blocking" ? "Blocking" : "Warning",
      target: { route: "/conflicts" },
    })),
  };
}

async function answerWorkload(db = supabase): Promise<AssistantAnswer> {
  const [judgesRes, schedulesRes, settingsRes] = await Promise.all([
    db.from("judges").select("*").order("name"),
    db.from("schedules").select("id, status, judge_id"),
    db.from("priority_settings").select("max_judge_workload").limit(1).maybeSingle(),
  ]);
  if (judgesRes.error) throw judgesRes.error;

  const cap = settingsRes.data?.max_judge_workload ?? DEFAULT_MAX_JUDGE_WORKLOAD;
  const active = (schedulesRes.data ?? []).filter((s) => isActiveSchedule(s.status));
  const judges = (judgesRes.data ?? []) as Judge[];

  const rows: AssistantRow[] = judges
    .map((j) => {
      const hearings = active.filter((s) => s.judge_id === j.id).length;
      return {
        id: j.id,
        label: j.name,
        detail: `${j.specialisation || "General bench"} · ${hearings} of ${cap} active hearings`,
        badge: `${Math.round((hearings / Math.max(1, cap)) * 100)}%`,
        hearings,
        target: { route: "/judges/$judgeId" as const, judgeId: j.id },
      };
    })
    .sort((a, b) => b.hearings - a.hearings)
    .map(({ hearings: _hearings, ...row }) => row);

  const nearing = judges.filter(
    (j) => active.filter((s) => s.judge_id === j.id).length / Math.max(1, cap) >= 0.8,
  ).length;

  return {
    intent: "judge_workload",
    summary: `${judges.length} judge(s) on the bench; ${nearing} at or above 80% of the ${cap}-hearing workload cap.`,
    source: "judges + active schedules, capped by the configured max judge workload",
    rows,
  };
}

async function answerHearings(question: string, db = supabase): Promise<AssistantAnswer> {
  const { date, label } = parseDate(question);
  const part = parsePartOfDay(question);

  const { data, error } = await db
    .from("schedules")
    .select(
      "id, status, cases(id, case_number, priority_score), judges(name), courtrooms(name), hearing_slots(date, start_time, end_time)",
    );
  if (error) throw error;

  const activeSchedules = (data ?? []).filter((s) => isActiveSchedule(s.status));
  const listed = activeSchedules
    .filter(
      (s) => s.hearing_slots?.date === date && inPart(s.hearing_slots?.start_time ?? "", part),
    )
    .sort((a, b) =>
      (a.hearing_slots?.start_time ?? "").localeCompare(b.hearing_slots?.start_time ?? ""),
    );

  if (listed.length === 0) {
    const futureHearings = activeSchedules
      .filter((s) => (s.hearing_slots?.date ?? "") >= date)
      .sort((a, b) => (a.hearing_slots?.date ?? "").localeCompare(b.hearing_slots?.date ?? ""));

    const firstUpcoming = futureHearings[0];
    if (firstUpcoming?.hearing_slots?.date) {
      const nextDate = firstUpcoming.hearing_slots.date;
      const dateHearings = futureHearings.filter((s) => s.hearing_slots?.date === nextDate);
      return {
        intent: "hearings_on_date",
        summary: `No hearings listed for ${label} (${prettyDate(date)}). Next scheduled hearings are on ${prettyDate(nextDate)} (${dateHearings.length} listing${dateHearings.length !== 1 ? "s" : ""}).`,
        source: `schedules joined to hearing_slots`,
        rows: dateHearings.slice(0, 15).map((s) => ({
          id: s.id,
          label: s.cases?.case_number ?? "Case",
          detail: `${timeLabel(s.hearing_slots?.start_time ?? "")}–${timeLabel(s.hearing_slots?.end_time ?? "")} · ${s.judges?.name ?? "Judge unassigned"} · ${s.courtrooms?.name ?? "Courtroom unassigned"}`,
          badge:
            s.cases?.priority_score == null
              ? "Priority pending"
              : `Priority ${Math.round(s.cases.priority_score)}`,
          target: s.cases
            ? ({ route: "/cases/$caseId", caseId: s.cases.id } as const)
            : { route: "/calendar" as const },
        })),
      };
    }
  }

  return {
    intent: "hearings_on_date",
    summary: `${listed.length} hearing(s) listed ${label}${part === "all" ? "" : ` ${part}`} (${prettyDate(date)}).`,
    source: `schedules joined to hearing_slots for ${date}`,
    rows: listed.map((s) => ({
      id: s.id,
      label: s.cases?.case_number ?? "Case",
      detail: `${timeLabel(s.hearing_slots?.start_time ?? "")}–${timeLabel(s.hearing_slots?.end_time ?? "")} · ${s.judges?.name ?? "Judge unassigned"} · ${s.courtrooms?.name ?? "Courtroom unassigned"}`,
      badge:
        s.cases?.priority_score == null
          ? "Priority pending"
          : `Priority ${Math.round(s.cases.priority_score)}`,
      target: s.cases
        ? ({ route: "/cases/$caseId", caseId: s.cases.id } as const)
        : { route: "/calendar" as const },
    })),
  };
}

/* ------------------------------------------------------------------ entry */

export async function answerQuestion(question: string, db: any = supabase): Promise<AssistantAnswer> {
  const intent = classifyQuestion(question);
  switch (intent) {
    case "availability":
      return answerAvailability(question, db);
    case "conflict_count":
      return answerConflicts(db);
    case "judge_workload":
      return answerWorkload(db);
    case "unscheduled_cases":
      return answerCases(false, true, db);
    case "high_priority_cases":
      return answerCases(true, false, db);
    case "hearings_on_date":
      return answerHearings(question, db);
    default:
      return {
        intent: "unknown",
        summary:
          "I only answer from a fixed set of registry lookups, and this question does not match one of them — so I will not guess.",
        source: "No query was run.",
        rows: EXAMPLE_QUESTIONS.map((q, i) => ({
          id: `example-${i}`,
          label: q,
          detail: "Supported question pattern",
        })),
      };
  }
}
