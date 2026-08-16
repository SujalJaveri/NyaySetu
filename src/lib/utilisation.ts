/**
 * Weekly utilisation heatmap data.
 *
 * Hours booked per judge / courtroom per weekday, derived from the schedules
 * table joined to their hearing slots. Cancelled listings are excluded.
 */
import { supabase } from "@/integrations/supabase/client";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type UtilisationRow = {
  id: string;
  name: string;
  hours: number[]; // length 7, Mon..Sun
  total: number;
};

export type UtilisationData = {
  schedules: {
    id: string;
    status: string;
    judge_id: string | null;
    courtroom_id: string | null;
    slot_id: string | null;
  }[];
  slots: { id: string; date: string; start_time: string; end_time: string }[];
  judges: { id: string; name: string }[];
  courtrooms: { id: string; name: string }[];
};

export const utilisationDataQuery = {
  queryKey: ["reports", "utilisation"],
  queryFn: async (): Promise<UtilisationData> => {
    const [schRes, slotRes, judgeRes, roomRes] = await Promise.all([
      supabase.from("schedules").select("id, status, judge_id, courtroom_id, slot_id"),
      supabase.from("hearing_slots").select("id, date, start_time, end_time"),
      supabase.from("judges").select("id, name").order("name"),
      supabase.from("courtrooms").select("id, name").order("name"),
    ]);
    for (const res of [schRes, slotRes, judgeRes, roomRes]) if (res.error) throw res.error;
    return {
      schedules: (schRes.data ?? []) as UtilisationData["schedules"],
      slots: (slotRes.data ?? []) as UtilisationData["slots"],
      judges: (judgeRes.data ?? []) as UtilisationData["judges"],
      courtrooms: (roomRes.data ?? []) as UtilisationData["courtrooms"],
    };
  },
};

function toMinutes(time: string) {
  const [h, m] = time.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

/** Monday = 0 … Sunday = 6, from an ISO date string (date-only, no timezone shift). */
function weekdayIndex(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const js = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (js + 6) % 7;
}

function build(
  entities: { id: string; name: string }[],
  data: UtilisationData,
  key: "judge_id" | "courtroom_id",
): UtilisationRow[] {
  const slots = new Map(data.slots.map((s) => [s.id, s]));
  const rows = new Map<string, UtilisationRow>(
    entities.map((e) => [e.id, { id: e.id, name: e.name, hours: Array(7).fill(0), total: 0 }]),
  );

  for (const s of data.schedules) {
    if (s.status === "cancelled") continue;
    const entityId = s[key];
    if (!entityId || !s.slot_id) continue;
    const row = rows.get(entityId);
    const slot = slots.get(s.slot_id);
    if (!row || !slot) continue;
    const minutes = Math.max(0, toMinutes(slot.end_time) - toMinutes(slot.start_time));
    const day = weekdayIndex(slot.date);
    row.hours[day] = (row.hours[day] ?? 0) + minutes / 60;
    row.total += minutes / 60;
  }

  return [...rows.values()].map((r) => ({
    ...r,
    hours: r.hours.map((h) => Math.round(h * 100) / 100),
    total: Math.round(r.total * 100) / 100,
  }));
}

export function computeUtilisation(data: UtilisationData) {
  const judges = build(data.judges, data, "judge_id");
  const courtrooms = build(data.courtrooms, data, "courtroom_id");
  const peak = Math.max(
    0,
    ...judges.flatMap((r) => r.hours),
    ...courtrooms.flatMap((r) => r.hours),
  );
  return { judges, courtrooms, peak };
}

export function formatHours(hours: number) {
  if (hours <= 0) return "—";
  return `${Math.round(hours * 10) / 10}h`;
}
