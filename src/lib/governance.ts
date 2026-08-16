/**
 * Governance & Compliance metrics.
 *
 * Evidence pack for Regulation 9 of the Supreme Court's Draft Regulations for
 * the Use of AI in Courts (continuous monitoring and periodic audits).
 *
 * Every figure below is derived from rows actually present in this
 * environment's database — recommendations issued by the scheduling engine,
 * registrar decisions on them, manual cause list overrides and the audit
 * trail. Nothing here is estimated, projected or invented; when there is no
 * data for a measure the page reports that plainly instead of substituting a
 * placeholder number.
 */
import { supabase } from "@/integrations/supabase/client";

export type GovernanceData = {
  recommendations: { id: string; status: string; created_at: string }[];
  cases: {
    id: string;
    case_number: string;
    priority_tier: string | null;
    priority_score: number | null;
    status: string;
    created_at: string;
  }[];
  schedules: { id: string; case_id: string; status: string; created_at: string }[];
  auditLogs: { id: string; action: string; timestamp: string }[];
};

export const governanceDataQuery = {
  queryKey: ["governance", "data"],
  queryFn: async (): Promise<GovernanceData> => {
    const [recRes, caseRes, schRes, auditRes] = await Promise.all([
      supabase.from("ai_recommendations").select("id, status, created_at"),
      supabase
        .from("cases")
        .select("id, case_number, priority_tier, priority_score, status, created_at"),
      supabase.from("schedules").select("id, case_id, status, created_at"),
      supabase
        .from("audit_logs")
        .select("id, action, timestamp")
        .order("timestamp", { ascending: false })
        .limit(1000),
    ]);
    for (const res of [recRes, caseRes, schRes, auditRes]) if (res.error) throw res.error;
    return {
      recommendations: (recRes.data ?? []) as GovernanceData["recommendations"],
      cases: (caseRes.data ?? []) as GovernanceData["cases"],
      schedules: (schRes.data ?? []) as GovernanceData["schedules"],
      auditLogs: (auditRes.data ?? []) as GovernanceData["auditLogs"],
    };
  },
};

export type Outcome = {
  label: string;
  count: number;
  percent: number;
};

export type GovernanceMetrics = {
  issued: number;
  accepted: number;
  modified: number;
  rejected: number;
  pending: number;
  outcomes: Outcome[];
  acceptedPercent: number;
  overriddenPercent: number;
  summaryLine: string;
  reorderCount: number;
  reorderResetCount: number;
  listingsSchedulesCount: number;
  reorderRatePercent: number | null;
  reorderWindowDays: number | null;
  tierCounts: { tier: string; count: number; percent: number }[];
  tierOneToHearingDays: number | null;
  tierOneSampleSize: number;
  tierOneUnscheduled: number;
  auditEntries: number;
  firstAudit: string | null;
  lastAudit: string | null;
};

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);

const REORDER_MATCH = "cause list manually reordered";
const RESET_MATCH = "cause list manual order cleared";

export function computeGovernanceMetrics(data: GovernanceData): GovernanceMetrics {
  const recs = data.recommendations;
  const issued = recs.length;
  const by = (s: string) => recs.filter((r) => (r.status ?? "").toLowerCase() === s).length;
  const accepted = by("accepted");
  const modified = by("modified");
  const rejected = by("rejected");
  const pending = issued - accepted - modified - rejected;

  const outcomes: Outcome[] = [
    { label: "Accepted as recommended", count: accepted, percent: pct(accepted, issued) },
    { label: "Modified by a registrar", count: modified, percent: pct(modified, issued) },
    { label: "Rejected outright", count: rejected, percent: pct(rejected, issued) },
    { label: "Awaiting a decision", count: pending, percent: pct(pending, issued) },
  ];

  const acceptedPercent = pct(accepted, issued);
  const overriddenPercent = pct(modified + rejected, issued);

  const summaryLine = issued
    ? `${acceptedPercent}% of recommendations issued by this system were accepted without modification; ${overriddenPercent}% were overridden by a registrar (modified or rejected). Based on ${issued} recommendation${issued === 1 ? "" : "s"} recorded in this environment.`
    : "No recommendations have been issued in this environment yet, so no acceptance or override rate can be reported.";

  // Human overrides of the machine-suggested listing order.
  const reorderLogs = data.auditLogs.filter((l) => l.action.toLowerCase().includes(REORDER_MATCH));
  const reorderResets = data.auditLogs.filter((l) => l.action.toLowerCase().includes(RESET_MATCH));
  const listings = data.schedules.filter((s) => s.status !== "cancelled");
  const reorderRatePercent = listings.length ? pct(reorderLogs.length, listings.length) : null;

  let reorderWindowDays: number | null = null;
  if (data.auditLogs.length > 1) {
    const times = data.auditLogs
      .map((l) => new Date(l.timestamp).getTime())
      .filter(Number.isFinite);
    if (times.length > 1) {
      const span = Math.max(...times) - Math.min(...times);
      reorderWindowDays = Math.max(1, Math.round(span / 86_400_000));
    }
  }

  // Priority tier distribution.
  const tiers = ["Tier 1", "Tier 2", "Tier 3"];
  const total = data.cases.length;
  const tierCounts = tiers.map((tier) => {
    const count = data.cases.filter((c) => c.priority_tier === tier).length;
    return { tier, count, percent: pct(count, total) };
  });
  const untiered = total - tierCounts.reduce((sum, t) => sum + t.count, 0);
  if (untiered > 0)
    tierCounts.push({ tier: "Not yet scored", count: untiered, percent: pct(untiered, total) });

  // Time from a case entering Tier 1 (its registration, when the tier is
  // computed) to the first hearing being listed for it.
  const firstSchedule = new Map<string, number>();
  for (const s of data.schedules) {
    if (s.status === "cancelled") continue;
    const t = new Date(s.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const existing = firstSchedule.get(s.case_id);
    if (existing === undefined || t < existing) firstSchedule.set(s.case_id, t);
  }
  const tierOne = data.cases.filter((c) => c.priority_tier === "Tier 1");
  const spans: number[] = [];
  let tierOneUnscheduled = 0;
  for (const c of tierOne) {
    const listed = firstSchedule.get(c.id);
    if (listed === undefined) {
      tierOneUnscheduled += 1;
      continue;
    }
    const diff = listed - new Date(c.created_at).getTime();
    if (Number.isFinite(diff) && diff >= 0) spans.push(diff / 86_400_000);
  }
  const tierOneToHearingDays = spans.length
    ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 100) / 100
    : null;

  const timestamps = data.auditLogs.map((l) => l.timestamp).sort();

  return {
    issued,
    accepted,
    modified,
    rejected,
    pending,
    outcomes,
    acceptedPercent,
    overriddenPercent,
    summaryLine,
    reorderCount: reorderLogs.length,
    reorderResetCount: reorderResets.length,
    listingsSchedulesCount: listings.length,
    reorderRatePercent,
    reorderWindowDays,
    tierCounts,
    tierOneToHearingDays,
    tierOneSampleSize: spans.length,
    tierOneUnscheduled,
    auditEntries: data.auditLogs.length,
    firstAudit: timestamps[0] ?? null,
    lastAudit: timestamps[timestamps.length - 1] ?? null,
  };
}

export function formatDays(days: number | null) {
  if (days === null) return "—";
  if (days < 0.5) return "Same day";
  if (days < 1) return `${Math.round(days * 24)} hrs`;
  return `${days} days`;
}

export function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB");
}
