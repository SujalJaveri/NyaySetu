/**
 * Backlog Simulator.
 *
 * A deterministic, in-memory projection run on the demo dataset only.
 * It is NOT a forecast and makes no real-world claim: it simply plays the
 * currently pending cases through a fixed weekly disposal rate under two
 * different hearing orders and reports what falls out.
 */
import { supabase } from "@/integrations/supabase/client";
import { tierForScore, type PriorityTier } from "@/lib/priority";

export type BacklogCase = {
  id: string;
  case_number: string;
  filing_date: string;
  priority_score: number | null;
  priority_tier: string | null;
  statutory_limitation_deadline: string | null;
};

export const backlogCasesQuery = {
  queryKey: ["backlog-simulator", "cases"],
  queryFn: async (): Promise<BacklogCase[]> => {
    const { data, error } = await supabase
      .from("cases")
      .select(
        "id, case_number, filing_date, priority_score, priority_tier, statutory_limitation_deadline",
      )
      .neq("status", "disposed");
    if (error) throw error;
    return (data ?? []) as BacklogCase[];
  },
};

export type OrderingKey = "fifo" | "priority";

export type SeriesPoint = {
  week: number;
  label: string;
  fifoPending: number;
  priorityPending: number;
  fifoTier1: number;
  priorityTier1: number;
};

export type OrderingOutcome = {
  key: OrderingKey;
  label: string;
  /** Average weeks a Tier 1 case waits before its hearing is held. */
  averageTier1WaitWeeks: number;
  /** Average weeks across all cases heard within the horizon. */
  averageWaitWeeks: number;
  /** Cases heard after their statutory limitation deadline within the horizon. */
  deadlineBreaches: number;
  tier1HeardInHorizon: number;
  heardInHorizon: number;
  remaining: number;
};

export type BacklogProjection = {
  horizonWeeks: number;
  disposalRatePerWeek: number;
  startingCaseCount: number;
  startingTier1Count: number;
  series: SeriesPoint[];
  fifo: OrderingOutcome;
  priority: OrderingOutcome;
};

function tierOf(c: BacklogCase): PriorityTier {
  if (
    c.priority_tier === "Tier 1" ||
    c.priority_tier === "Tier 2" ||
    c.priority_tier === "Tier 3"
  ) {
    return c.priority_tier;
  }
  return tierForScore(c.priority_score ?? 0);
}

function orderCases(cases: BacklogCase[], key: OrderingKey): BacklogCase[] {
  const rank: Record<PriorityTier, number> = { "Tier 1": 0, "Tier 2": 1, "Tier 3": 2 };
  const list = [...cases];
  if (key === "fifo") {
    list.sort(
      (a, b) =>
        a.filing_date.localeCompare(b.filing_date) || a.case_number.localeCompare(b.case_number),
    );
    return list;
  }
  list.sort(
    (a, b) =>
      rank[tierOf(a)] - rank[tierOf(b)] ||
      (b.priority_score ?? 0) - (a.priority_score ?? 0) ||
      a.filing_date.localeCompare(b.filing_date) ||
      a.case_number.localeCompare(b.case_number),
  );
  return list;
}

function simulate(
  cases: BacklogCase[],
  key: OrderingKey,
  label: string,
  ratePerWeek: number,
  horizonWeeks: number,
  startDate: Date,
): { outcome: OrderingOutcome; pendingByWeek: number[]; tier1ByWeek: number[] } {
  const queue = orderCases(cases, key);
  const total = queue.length;
  const totalTier1 = queue.filter((c) => tierOf(c) === "Tier 1").length;

  const pendingByWeek: number[] = [total];
  const tier1ByWeek: number[] = [totalTier1];

  let index = 0;
  let heard = 0;
  let tier1Heard = 0;
  let waitSum = 0;
  let tier1WaitSum = 0;
  let breaches = 0;

  for (let week = 1; week <= horizonWeeks; week += 1) {
    for (let n = 0; n < ratePerWeek && index < total; n += 1, index += 1) {
      const c = queue[index]!;
      heard += 1;
      waitSum += week;
      if (tierOf(c) === "Tier 1") {
        tier1Heard += 1;
        tier1WaitSum += week;
      }
      if (c.statutory_limitation_deadline) {
        const hearingDate = new Date(startDate.getTime() + week * 7 * 86400000);
        if (hearingDate > new Date(c.statutory_limitation_deadline)) breaches += 1;
      }
    }
    pendingByWeek.push(total - index);
    tier1ByWeek.push(totalTier1 - tier1Heard);
  }

  return {
    pendingByWeek,
    tier1ByWeek,
    outcome: {
      key,
      label,
      averageTier1WaitWeeks: tier1Heard ? Math.round((tier1WaitSum / tier1Heard) * 10) / 10 : 0,
      averageWaitWeeks: heard ? Math.round((waitSum / heard) * 10) / 10 : 0,
      deadlineBreaches: breaches,
      tier1HeardInHorizon: tier1Heard,
      heardInHorizon: heard,
      remaining: total - index,
    },
  };
}

export function runBacklogProjection(
  cases: BacklogCase[],
  disposalRatePerWeek: number,
  horizonWeeks: number,
  today = new Date(),
): BacklogProjection {
  const rate = Math.max(1, Math.round(disposalRatePerWeek));
  const fifo = simulate(cases, "fifo", "Filing-date order (FIFO)", rate, horizonWeeks, today);
  const priority = simulate(
    cases,
    "priority",
    "Proposed order (tier + score)",
    rate,
    horizonWeeks,
    today,
  );

  const series: SeriesPoint[] = [];
  for (let week = 0; week <= horizonWeeks; week += 1) {
    series.push({
      week,
      label: week === 0 ? "Now" : `Wk ${week}`,
      fifoPending: fifo.pendingByWeek[week] ?? 0,
      priorityPending: priority.pendingByWeek[week] ?? 0,
      fifoTier1: fifo.tier1ByWeek[week] ?? 0,
      priorityTier1: priority.tier1ByWeek[week] ?? 0,
    });
  }

  return {
    horizonWeeks,
    disposalRatePerWeek: rate,
    startingCaseCount: cases.length,
    startingTier1Count: cases.filter((c) => tierOf(c) === "Tier 1").length,
    series,
    fifo: fifo.outcome,
    priority: priority.outcome,
  };
}

export const HORIZONS = [
  { key: "6m", label: "6 months", weeks: 26 },
  { key: "12m", label: "12 months", weeks: 52 },
] as const;
