/**
 * Dashboard metrics.
 *
 * Every number here is a straight aggregation of live registry rows — no
 * estimates, no AI. Conflict counts reuse the same deterministic scanner the
 * Conflicts page uses.
 */
import { supabase } from "@/integrations/supabase/client";
import { tierForScore, type PriorityTier } from "@/lib/priority";
import { DEFAULT_MAX_JUDGE_WORKLOAD, isActiveSchedule } from "@/lib/conflicts";
import type { Courtroom, Judge } from "@/lib/registry";

export type DashboardSchedule = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  slot_id: string | null;
  created_at: string;
  case_id: string;
  slot: { id: string; date: string; start_time: string; end_time: string } | null;
};

export type DashboardCase = {
  id: string;
  case_number: string;
  status: string;
  priority_score: number | null;
  priority_tier: string | null;
  filing_date: string;
  created_at: string;
  previous_adjournments: number;
};

export type DashboardData = {
  cases: DashboardCase[];
  schedules: DashboardSchedule[];
  judges: Judge[];
  courtrooms: Courtroom[];
  slotCount: number;
  maxJudgeWorkload: number;
};

type RawSchedule = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  slot_id: string | null;
  created_at: string;
  case_id: string;
  hearing_slots: { id: string; date: string; start_time: string; end_time: string } | null;
};

export const dashboardDataQuery = {
  queryKey: ["dashboard", "data"],
  queryFn: async (): Promise<DashboardData> => {
    const [casesRes, schedulesRes, judgesRes, courtroomsRes, slotsRes, settingsRes] =
      await Promise.all([
        supabase
          .from("cases")
          .select(
            "id, case_number, status, priority_score, priority_tier, filing_date, created_at, previous_adjournments",
          ),
        supabase
          .from("schedules")
          .select(
            "id, status, judge_id, courtroom_id, slot_id, created_at, case_id, hearing_slots(id, date, start_time, end_time)",
          ),
        supabase.from("judges").select("*").order("name"),
        supabase.from("courtrooms").select("*").order("name"),
        supabase.from("hearing_slots").select("id", { count: "exact", head: true }),
        supabase.from("priority_settings").select("max_judge_workload").limit(1).maybeSingle(),
      ]);
    if (casesRes.error) throw casesRes.error;
    if (schedulesRes.error) throw schedulesRes.error;
    if (judgesRes.error) throw judgesRes.error;
    if (courtroomsRes.error) throw courtroomsRes.error;

    return {
      cases: (casesRes.data ?? []) as DashboardCase[],
      schedules: ((schedulesRes.data ?? []) as unknown as RawSchedule[]).map((r) => ({
        id: r.id,
        status: r.status,
        judge_id: r.judge_id,
        courtroom_id: r.courtroom_id,
        slot_id: r.slot_id,
        created_at: r.created_at,
        case_id: r.case_id,
        slot: r.hearing_slots,
      })),
      judges: (judgesRes.data ?? []) as Judge[],
      courtrooms: (courtroomsRes.data ?? []) as Courtroom[],
      slotCount: slotsRes.count ?? 0,
      maxJudgeWorkload: settingsRes.data?.max_judge_workload ?? DEFAULT_MAX_JUDGE_WORKLOAD,
    };
  },
};

export type DashboardMetrics = {
  pendingCases: number;
  /** Tier 1 cases among pending cases — the dashboard's headline priority count. */
  highPriorityCases: number;
  tierCounts: Record<PriorityTier, number>;
  scheduledHearings: number;
  awaitingScheduling: number;
  judgeUtilisation: number;
  courtroomUtilisation: number;
  judgeWorkload: { name: string; hearings: number; capacity: number }[];
  courtroomLoad: { name: string; hearings: number; capacity: number }[];
  totalCases: number;
  disposedCases: number;
};

/** Stored tier wins; falls back to the same thresholds used when scoring. */
export function caseTier(c: {
  priority_tier: string | null;
  priority_score: number | null;
}): PriorityTier {
  if (c.priority_tier === "Tier 1" || c.priority_tier === "Tier 2" || c.priority_tier === "Tier 3")
    return c.priority_tier;
  return tierForScore(c.priority_score ?? 0);
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function computeDashboardMetrics(data: DashboardData): DashboardMetrics {
  const active = data.schedules.filter((s) => isActiveSchedule(s.status));
  const scheduledCaseIds = new Set(active.map((s) => s.case_id));

  const pendingCases = data.cases.filter((c) => c.status !== "disposed");
  const tierCounts: Record<PriorityTier, number> = { "Tier 1": 0, "Tier 2": 0, "Tier 3": 0 };
  for (const c of pendingCases) tierCounts[caseTier(c)] += 1;
  const highPriorityCases = pendingCases.filter((c) => caseTier(c) === "Tier 1");
  const awaiting = pendingCases.filter((c) => !scheduledCaseIds.has(c.id));

  const judgeWorkload = data.judges.map((j) => ({
    name: j.name,
    hearings: active.filter((s) => s.judge_id === j.id).length,
    capacity: data.maxJudgeWorkload,
  }));
  const courtroomLoad = data.courtrooms.map((c) => ({
    name: c.name,
    hearings: active.filter((s) => s.courtroom_id === c.id).length,
    capacity: Math.max(1, c.capacity || 0),
  }));

  const judgeCapacity = data.judges.length * data.maxJudgeWorkload;
  const judgeBooked = judgeWorkload.reduce((sum, j) => sum + j.hearings, 0);

  // Courtroom utilisation = booked (courtroom × slot) pairs against every
  // (courtroom × published hearing slot) pair that exists in the registry.
  const courtroomCapacity = data.courtrooms.length * data.slotCount;
  const courtroomBooked = active.filter((s) => s.courtroom_id && s.slot_id).length;

  return {
    pendingCases: pendingCases.length,
    highPriorityCases: highPriorityCases.length,
    tierCounts,
    scheduledHearings: active.length,
    awaitingScheduling: awaiting.length,
    judgeUtilisation: pct(judgeBooked, judgeCapacity),
    courtroomUtilisation: pct(courtroomBooked, courtroomCapacity),
    judgeWorkload,
    courtroomLoad,
    totalCases: data.cases.length,
    disposedCases: data.cases.filter((c) => c.status === "disposed").length,
  };
}
