import { supabase } from "@/integrations/supabase/client";

export const MAX_JUDGE_WORKLOAD = 25;
export const ACTIVE_SCHEDULE_STATUSES = ["proposed", "confirmed"] as const;

export type Judge = {
  id: string;
  name: string;
  specialisation: string;
  current_workload: number;
  user_id: string | null;
  created_at: string;
};

/** Accounts carrying the judge role, available to link to a judge record. */
export type BenchAccount = { id: string; fullName: string };

export const benchAccountsQuery = {
  queryKey: ["bench-accounts"],
  queryFn: async (): Promise<BenchAccount[]> => {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "judge");
    if (error) throw error;
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    if (profileError) throw profileError;
    return (profiles ?? []).map((p) => ({ id: p.id, fullName: p.full_name || "Unnamed account" }));
  },
};

export type Courtroom = {
  id: string;
  name: string;
  capacity: number;
  type: string;
  current_allocation: number;
  created_at: string;
};

export type ScheduleRow = {
  id: string;
  status: string;
  created_at: string;
  judge_id: string | null;
  courtroom_id: string | null;
  cases: { id: string; case_number: string; status: string; parties: string } | null;
  hearing_slots: { id: string; date: string; start_time: string; end_time: string } | null;
  judges: { id: string; name: string } | null;
  courtrooms: { id: string; name: string } | null;
};

const SCHEDULE_SELECT =
  "id, status, created_at, judge_id, courtroom_id, cases(id, case_number, status, parties), hearing_slots(id, date, start_time, end_time), judges(id, name), courtrooms(id, name)";

export const judgesQuery = {
  queryKey: ["judges"],
  queryFn: async (): Promise<Judge[]> => {
    const { data, error } = await supabase.from("judges").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Judge[];
  },
};

export const courtroomsQuery = {
  queryKey: ["courtrooms"],
  queryFn: async (): Promise<Courtroom[]> => {
    const { data, error } = await supabase.from("courtrooms").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Courtroom[];
  },
};

export const schedulesQuery = {
  queryKey: ["schedules", "registry"],
  queryFn: async (): Promise<ScheduleRow[]> => {
    const { data, error } = await supabase.from("schedules").select(SCHEDULE_SELECT);
    if (error) throw error;
    return (data ?? []) as unknown as ScheduleRow[];
  },
};

export function isActive(status: string) {
  return status === "proposed" || status === "confirmed";
}

export function countBy<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export function formatSlot(slot: ScheduleRow["hearing_slots"]) {
  if (!slot) return "Unscheduled";
  const date = new Date(`${slot.date}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${date} · ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`;
}
