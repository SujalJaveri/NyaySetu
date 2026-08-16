import { supabase } from "@/integrations/supabase/client";
import { priorityBand, type CaseStatus } from "@/lib/cases";

export type CalendarEntry = {
  id: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  slotId: string | null;
  caseId: string | null;
  caseNumber: string;
  caseStatus: CaseStatus | null;
  parties: string;
  priorityScore: number | null;
  categoryName: string | null;
  judgeId: string | null;
  judgeName: string;
  courtroomId: string | null;
  courtroomName: string;
};

const SELECT =
  "id, status, judge_id, courtroom_id, cases(id, case_number, status, parties, priority_score, case_categories(name)), hearing_slots(id, date, start_time, end_time), judges(id, name), courtrooms(id, name)";

type RawRow = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  cases: {
    id: string;
    case_number: string;
    status: CaseStatus;
    parties: string;
    priority_score: number | null;
    case_categories: { name: string } | null;
  } | null;
  hearing_slots: { id: string; date: string; start_time: string; end_time: string } | null;
  judges: { id: string; name: string } | null;
  courtrooms: { id: string; name: string } | null;
};

export const calendarQuery = {
  queryKey: ["calendar", "entries"],
  queryFn: async (): Promise<CalendarEntry[]> => {
    const { data, error } = await supabase.from("schedules").select(SELECT);
    if (error) throw error;
    return ((data ?? []) as unknown as RawRow[])
      .filter(
        (row) =>
          row.hearing_slots &&
          (row.status === "proposed" || row.status === "confirmed" || row.status === "completed"),
      )
      .map((row) => ({
        id: row.id,
        status: row.status,
        date: row.hearing_slots!.date,
        startTime: row.hearing_slots!.start_time,
        endTime: row.hearing_slots!.end_time,
        slotId: row.hearing_slots!.id,
        caseId: row.cases?.id ?? null,
        caseNumber: row.cases?.case_number ?? "—",
        caseStatus: row.cases?.status ?? null,
        parties: row.cases?.parties ?? "",
        priorityScore: row.cases?.priority_score ?? null,
        categoryName: row.cases?.case_categories?.name ?? null,
        judgeId: row.judge_id,
        judgeName: row.judges?.name ?? "Unassigned judge",
        courtroomId: row.courtroom_id,
        courtroomName: row.courtrooms?.name ?? "Unassigned courtroom",
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  },
};

/** Left-border accent classes, keyed by the chosen colour mode. */
export const priorityAccent: Record<string, string> = {
  high: "border-l-destructive",
  medium: "border-l-accent-foreground/70",
  low: "border-l-primary/50",
  pending: "border-l-border",
};

export const statusAccent: Record<string, string> = {
  proposed: "border-l-accent-foreground/70",
  confirmed: "border-l-primary",
  completed: "border-l-muted-foreground/50",
  cancelled: "border-l-destructive",
};

export function entryAccent(entry: CalendarEntry, mode: "priority" | "status") {
  return mode === "priority"
    ? (priorityAccent[priorityBand(entry.priorityScore)] ?? "border-l-border")
    : (statusAccent[entry.status] ?? "border-l-border");
}

export function timeRange(entry: CalendarEntry) {
  return `${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}`;
}

export function groupBy(entries: CalendarEntry[], key: (entry: CalendarEntry) => string) {
  const map = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const k = key(entry);
    const list = map.get(k);
    if (list) list.push(entry);
    else map.set(k, [entry]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
