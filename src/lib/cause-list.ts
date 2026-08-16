import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import {
  computePriority,
  priorityInputFromCase,
  tierForScore,
  type PrioritySettings,
  type PriorityTier,
} from "@/lib/priority";
import { buildOrderReasons } from "@/lib/why-this-order";

export type CauseListEntry = {
  scheduleId: string;
  status: string;
  position: number | null;
  date: string;
  startTime: string;
  endTime: string;
  caseId: string | null;
  caseNumber: string;
  parties: string;
  judgeId: string | null;
  judgeName: string;
  courtroomId: string | null;
  courtroomName: string;
  score: number;
  tier: PriorityTier;
  reason: string;
};

type RawRow = {
  id: string;
  status: string;
  judge_id: string | null;
  courtroom_id: string | null;
  cause_list_position: number | null;
  cases: {
    id: string;
    case_number: string;
    parties: string;
    pending_duration_days: number;
    previous_adjournments: number;
    legal_priority_flag: boolean;
    is_ftsc_pocso: boolean;
    senior_citizen_litigant: boolean;
    property_dispute_5yr_plus: boolean;
    statutory_limitation_deadline: string | null;
    case_categories: { name: string; urgency_weight: number } | null;
  } | null;
  hearing_slots: { id: string; date: string; start_time: string; end_time: string } | null;
  judges: { id: string; name: string } | null;
  courtrooms: { id: string; name: string } | null;
};

const SELECT =
  "id, status, judge_id, courtroom_id, cause_list_position, cases(id, case_number, parties, pending_duration_days, previous_adjournments, legal_priority_flag, is_ftsc_pocso, senior_citizen_litigant, property_dispute_5yr_plus, statutory_limitation_deadline, case_categories(name, urgency_weight)), hearing_slots(id, date, start_time, end_time), judges(id, name), courtrooms(id, name)";

const TIER_RANK: Record<PriorityTier, number> = { "Tier 1": 0, "Tier 2": 1, "Tier 3": 2 };

/** One-line reason summary — the highest-scoring factor from "Why this order". */
function reasonFor(entry: ReturnType<typeof computePriority>): string {
  const reasons = buildOrderReasons(entry)
    .filter((r) => r.applies)
    .sort((a, b) => b.points - a.points);
  const top = reasons[0];
  if (!top) return "No statutory category recorded — listed at the base tier.";
  return `${top.headline} — ${top.basis} (+${top.points} pts)`;
}

export function causeListQuery(date: string, settings: PrioritySettings | null) {
  return {
    queryKey: ["cause-list", date, settings?.id ?? "defaults"],
    enabled: Boolean(date && settings),
    queryFn: async (): Promise<CauseListEntry[]> => {
      const { data, error } = await supabase.from("schedules").select(SELECT);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as RawRow[]).filter(
        (r) => r.hearing_slots?.date === date && r.status !== "cancelled",
      );

      return rows.map((row) => {
        const breakdown = row.cases
          ? computePriority(priorityInputFromCase(row.cases), settings!)
          : { score: 0, tier: tierForScore(0), rawTotal: 0, factors: [] };
        return {
          scheduleId: row.id,
          status: row.status,
          position: row.cause_list_position,
          date: row.hearing_slots!.date,
          startTime: row.hearing_slots!.start_time,
          endTime: row.hearing_slots!.end_time,
          caseId: row.cases?.id ?? null,
          caseNumber: row.cases?.case_number ?? "—",
          parties: row.cases?.parties ?? "",
          judgeId: row.judge_id,
          judgeName: row.judges?.name ?? "Unassigned judge",
          courtroomId: row.courtroom_id,
          courtroomName: row.courtrooms?.name ?? "Unassigned courtroom",
          score: breakdown.score,
          tier: breakdown.tier,
          reason: row.cases ? reasonFor(breakdown) : "No case record attached to this listing.",
        };
      });
    },
  };
}

/** Suggested order: manual overrides first (in saved position), then tier and score. */
export function orderEntries(entries: CauseListEntry[]): CauseListEntry[] {
  return [...entries].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    return (
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      b.score - a.score ||
      a.startTime.localeCompare(b.startTime) ||
      a.caseNumber.localeCompare(b.caseNumber)
    );
  });
}

export function moveEntry<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * Persists a manual override. Every listing in the view gets an explicit
 * position so the registrar's order is what everyone sees next time, and the
 * move itself is written to the audit trail.
 */
export async function persistManualOrder(
  ordered: CauseListEntry[],
  moved: { entry: CauseListEntry; fromPosition: number; toPosition: number },
  scopeLabel: string,
  date: string,
) {
  const updates = ordered.map((entry, index) =>
    supabase
      .from("schedules")
      .update({ cause_list_position: index + 1 })
      .eq("id", entry.scheduleId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  await recordAudit(
    `Cause list manually reordered — ${moved.entry.caseNumber} moved from position ${moved.fromPosition} to ${moved.toPosition} (${scopeLabel}, ${date})`,
    `cause_list:${date} case:${moved.entry.caseNumber} schedule:${moved.entry.scheduleId}`,
  );
}

/** Clears manual overrides for the listings in view, restoring the suggested order. */
export async function resetManualOrder(
  entries: CauseListEntry[],
  scopeLabel: string,
  date: string,
) {
  const ids = entries.map((e) => e.scheduleId);
  if (!ids.length) return;
  const { error } = await supabase
    .from("schedules")
    .update({ cause_list_position: null })
    .in("id", ids);
  if (error) throw error;
  await recordAudit(
    `Cause list manual order cleared — reverted to the suggested order (${scopeLabel}, ${date})`,
    `cause_list:${date}`,
  );
}

export function formatSlotTime(time: string) {
  return time.slice(0, 5);
}
