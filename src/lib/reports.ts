/**
 * Reports metrics.
 *
 * All figures are computed from rows currently present in this environment's
 * dataset (the demo dataset). They describe what this system did with these
 * records — they are NOT benchmarks or real-world performance claims.
 */
import { supabase } from "@/integrations/supabase/client";

export type ReportsData = {
  recommendations: { id: string; status: string; created_at: string; schedule_id: string }[];
  schedules: { id: string; case_id: string; status: string; created_at: string }[];
  cases: { id: string; created_at: string; previous_adjournments: number; status: string }[];
  adjournments: { id: string; case_id: string; created_at: string }[];
  auditLogs: { id: string; action: string; timestamp: string }[];
};

export const reportsDataQuery = {
  queryKey: ["reports", "data"],
  queryFn: async (): Promise<ReportsData> => {
    const [recRes, schRes, caseRes, adjRes, auditRes] = await Promise.all([
      supabase.from("ai_recommendations").select("id, status, created_at, schedule_id"),
      supabase.from("schedules").select("id, case_id, status, created_at"),
      supabase.from("cases").select("id, created_at, previous_adjournments, status"),
      supabase.from("adjournments").select("id, case_id, created_at"),
      supabase
        .from("audit_logs")
        .select("id, action, timestamp")
        .order("timestamp", { ascending: false })
        .limit(500),
    ]);
    for (const res of [recRes, schRes, caseRes, adjRes]) if (res.error) throw res.error;
    return {
      recommendations: (recRes.data ?? []) as ReportsData["recommendations"],
      schedules: (schRes.data ?? []) as ReportsData["schedules"],
      cases: (caseRes.data ?? []) as ReportsData["cases"],
      adjournments: (adjRes.data ?? []) as ReportsData["adjournments"],
      auditLogs: (auditRes.data ?? []) as ReportsData["auditLogs"],
    };
  },
};

export type ReportsMetrics = {
  recommendationsIssued: number;
  accepted: number;
  modified: number;
  rejected: number;
  acceptanceRate: number;
  conflictsAvoided: number;
  liveConflicts: number;
  averageSchedulingMinutes: number | null;
  schedulingSampleSize: number;
  scheduledCoverage: number;
  averageAdjournments: number;
  simulationsApplied: number;
  decisionsLogged: number;
};

export function computeReportsMetrics(data: ReportsData, liveConflicts: number): ReportsMetrics {
  const recs = data.recommendations;
  const accepted = recs.filter((r) => r.status === "accepted").length;
  const modified = recs.filter((r) => r.status === "modified").length;
  const rejected = recs.filter((r) => r.status === "rejected").length;

  const caseCreated = new Map(data.cases.map((c) => [c.id, new Date(c.created_at).getTime()]));
  const durations: number[] = [];
  for (const s of data.schedules) {
    const filed = caseCreated.get(s.case_id);
    if (!filed) continue;
    const diff = new Date(s.created_at).getTime() - filed;
    if (Number.isFinite(diff) && diff >= 0) durations.push(diff / 60_000);
  }

  const activeCaseIds = new Set(
    data.schedules.filter((s) => s.status !== "cancelled").map((s) => s.case_id),
  );
  const openCases = data.cases.filter((c) => c.status !== "disposed");

  const totalAdjournments =
    data.cases.reduce((sum, c) => sum + (c.previous_adjournments ?? 0), 0) +
    data.adjournments.length;

  return {
    recommendationsIssued: recs.length,
    accepted,
    modified,
    rejected,
    acceptanceRate: recs.length ? Math.round(((accepted + modified) / recs.length) * 100) : 0,
    // Each committed recommendation was re-validated against every hard
    // constraint immediately before it was written, so it could not introduce
    // a double-booking, unavailability clash or duration overflow.
    conflictsAvoided: accepted + modified,
    liveConflicts,
    averageSchedulingMinutes: durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null,
    schedulingSampleSize: durations.length,
    scheduledCoverage: openCases.length
      ? Math.round(
          (openCases.filter((c) => activeCaseIds.has(c.id)).length / openCases.length) * 100,
        )
      : 0,
    averageAdjournments: data.cases.length
      ? Math.round((totalAdjournments / data.cases.length) * 100) / 100
      : 0,
    simulationsApplied: data.auditLogs.filter((l) => l.action.toLowerCase().includes("simulation"))
      .length,
    decisionsLogged: data.auditLogs.length,
  };
}

export function formatDuration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 1) return "<1 min";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours * 10) / 10} hrs`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}
