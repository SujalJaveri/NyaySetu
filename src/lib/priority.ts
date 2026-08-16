import { supabase } from "@/integrations/supabase/client";
import { pendingDays } from "@/lib/cases";

export type PrioritySettings = {
  id: string;
  category_weight: number;
  pending_weight: number;
  adjournment_weight: number;
  boost_points: number;
  pending_cap_days: number;
  adjournment_cap: number;
  max_judge_workload: number;
  sched_specialisation_weight: number;
  sched_workload_weight: number;
  sched_priority_weight: number;
  sched_utilisation_weight: number;
  ftsc_pocso_weight: number;
  senior_citizen_weight: number;
  property_dispute_weight: number;
  limitation_deadline_weight: number;
  limitation_horizon_days: number;
};

export const DEFAULT_PRIORITY_SETTINGS: Omit<PrioritySettings, "id"> = {
  category_weight: 30,
  pending_weight: 40,
  adjournment_weight: 20,
  boost_points: 10,
  pending_cap_days: 365,
  adjournment_cap: 5,
  max_judge_workload: 25,
  sched_specialisation_weight: 35,
  sched_workload_weight: 30,
  sched_priority_weight: 20,
  sched_utilisation_weight: 15,
  ftsc_pocso_weight: 30,
  senior_citizen_weight: 12,
  property_dispute_weight: 10,
  limitation_deadline_weight: 18,
  limitation_horizon_days: 90,
};

export type PriorityFactor = {
  key: string;
  label: string;
  detail: string;
  weight: number;
  ratio: number;
  points: number;
};

export type PriorityTier = "Tier 1" | "Tier 2" | "Tier 3";

export type PriorityBreakdown = {
  score: number;
  tier: PriorityTier;
  rawTotal: number;
  factors: PriorityFactor[];
};

/** Tier thresholds are fixed so the label means the same thing everywhere. */
export const TIER_THRESHOLDS = { tier1: 70, tier2: 40 } as const;

export function tierForScore(score: number): PriorityTier {
  if (score >= TIER_THRESHOLDS.tier1) return "Tier 1";
  if (score >= TIER_THRESHOLDS.tier2) return "Tier 2";
  return "Tier 3";
}

/** Days from today until a statutory limitation deadline (negative = elapsed). */
export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((target - today) / 86_400_000);
}

export type PriorityInput = {
  categoryName: string | null;
  categoryUrgency: number | null;
  pendingDays: number;
  adjournments: number;
  legalPriorityFlag: boolean;
  isFtscPocso: boolean;
  seniorCitizenLitigant: boolean;
  propertyDispute5yrPlus: boolean;
  statutoryLimitationDeadline: string | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Deterministic 0-100 priority score with a fully explainable breakdown. */
export function computePriority(
  input: PriorityInput,
  settings: PrioritySettings | Omit<PrioritySettings, "id">,
): PriorityBreakdown {
  const urgency = clamp(input.categoryUrgency ?? 50, 0, 100);
  const pendingCap = Math.max(1, settings.pending_cap_days);
  const adjCap = Math.max(1, settings.adjournment_cap);

  const categoryRatio = urgency / 100;
  const pendingRatio = clamp(input.pendingDays / pendingCap, 0, 1);
  const adjRatio = clamp(input.adjournments / adjCap, 0, 1);

  // Deadline proximity: full weight once the deadline is reached or passed,
  // scaling linearly across the configured horizon before it.
  const horizon = Math.max(1, settings.limitation_horizon_days);
  let limitationRatio = 0;
  let limitationDetail = "No statutory limitation deadline recorded";
  if (input.statutoryLimitationDeadline) {
    const remaining = daysUntil(input.statutoryLimitationDeadline);
    limitationRatio = remaining <= 0 ? 1 : clamp((horizon - remaining) / horizon, 0, 1);
    limitationDetail =
      remaining <= 0
        ? `Deadline ${input.statutoryLimitationDeadline} reached or elapsed (${Math.abs(remaining)} days)`
        : `${remaining} days to ${input.statutoryLimitationDeadline} (counts within ${horizon} days)`;
  }

  const factors: PriorityFactor[] = [
    {
      key: "category",
      label: "Category urgency",
      detail: `${input.categoryName ?? "Uncategorised"} · urgency weight ${urgency}/100`,
      weight: settings.category_weight,
      ratio: categoryRatio,
      points: round1(settings.category_weight * categoryRatio),
    },
    {
      key: "pending",
      label: "Pending duration",
      detail: `${input.pendingDays} days pending (capped at ${pendingCap})`,
      weight: settings.pending_weight,
      ratio: pendingRatio,
      points: round1(settings.pending_weight * pendingRatio),
    },
    {
      key: "adjournments",
      label: "Previous adjournments",
      detail: `${input.adjournments} adjournment${input.adjournments === 1 ? "" : "s"} (capped at ${adjCap})`,
      weight: settings.adjournment_weight,
      ratio: adjRatio,
      points: round1(settings.adjournment_weight * adjRatio),
    },
    {
      key: "ftsc_pocso",
      label: "Fast Track Special Court / POCSO",
      detail: input.isFtscPocso
        ? "Centrally-mandated fast-track category — recorded by the registrar"
        : "Not an FTSC / POCSO matter",
      weight: settings.ftsc_pocso_weight,
      ratio: input.isFtscPocso ? 1 : 0,
      points: input.isFtscPocso ? round1(settings.ftsc_pocso_weight) : 0,
    },
    {
      key: "senior_citizen",
      label: "Senior citizen litigant",
      detail: input.seniorCitizenLitigant
        ? "Senior citizen party on record"
        : "No senior citizen party recorded",
      weight: settings.senior_citizen_weight,
      ratio: input.seniorCitizenLitigant ? 1 : 0,
      points: input.seniorCitizenLitigant ? round1(settings.senior_citizen_weight) : 0,
    },
    {
      key: "property_dispute",
      label: "Property dispute pending 5 years or more",
      detail: input.propertyDispute5yrPlus ? "Recorded by the registrar" : "Not recorded",
      weight: settings.property_dispute_weight,
      ratio: input.propertyDispute5yrPlus ? 1 : 0,
      points: input.propertyDispute5yrPlus ? round1(settings.property_dispute_weight) : 0,
    },
    {
      key: "limitation",
      label: "Statutory limitation deadline",
      detail: limitationDetail,
      weight: settings.limitation_deadline_weight,
      ratio: limitationRatio,
      points: round1(settings.limitation_deadline_weight * limitationRatio),
    },
    {
      key: "boost",
      label: "Legal / administrative priority",
      detail: input.legalPriorityFlag ? "Flagged by an administrator" : "Not flagged",
      weight: settings.boost_points,
      ratio: input.legalPriorityFlag ? 1 : 0,
      points: input.legalPriorityFlag ? round1(settings.boost_points) : 0,
    },
  ];

  const rawTotal = round1(factors.reduce((sum, f) => sum + f.points, 0));
  const score = round1(clamp(rawTotal, 0, 100));
  return { score, tier: tierForScore(score), rawTotal, factors };
}

/** Builds the scoring input from a case row — keeps every call site consistent. */
export function priorityInputFromCase(record: {
  case_categories: { name: string; urgency_weight: number } | null;
  pending_duration_days: number;
  previous_adjournments: number;
  legal_priority_flag: boolean;
  is_ftsc_pocso: boolean;
  senior_citizen_litigant: boolean;
  property_dispute_5yr_plus: boolean;
  statutory_limitation_deadline: string | null;
}): PriorityInput {
  return {
    categoryName: record.case_categories?.name ?? null,
    categoryUrgency: record.case_categories?.urgency_weight ?? null,
    pendingDays: record.pending_duration_days,
    adjournments: record.previous_adjournments,
    legalPriorityFlag: Boolean(record.legal_priority_flag),
    isFtscPocso: Boolean(record.is_ftsc_pocso),
    seniorCitizenLitigant: Boolean(record.senior_citizen_litigant),
    propertyDispute5yrPlus: Boolean(record.property_dispute_5yr_plus),
    statutoryLimitationDeadline: record.statutory_limitation_deadline ?? null,
  };
}

export const prioritySettingsQuery = {
  queryKey: ["priority-settings"],
  queryFn: async (): Promise<PrioritySettings> => {
    const { data, error } = await supabase
      .from("priority_settings")
      .select(
        "id, category_weight, pending_weight, adjournment_weight, boost_points, pending_cap_days, adjournment_cap, max_judge_workload, sched_specialisation_weight, sched_workload_weight, sched_priority_weight, sched_utilisation_weight, ftsc_pocso_weight, senior_citizen_weight, property_dispute_weight, limitation_deadline_weight, limitation_horizon_days",
      )
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as PrioritySettings | null) ?? { id: "", ...DEFAULT_PRIORITY_SETTINGS };
  },
};

export const categoryWeightsQuery = {
  queryKey: ["category-weights"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("case_categories")
      .select("id, name, typical_duration_minutes, urgency_weight")
      .order("name");
    if (error) throw error;
    return (data ?? []) as {
      id: string;
      name: string;
      typical_duration_minutes: number;
      urgency_weight: number;
    }[];
  },
};

/**
 * Recalculates and stores priority_score for a case. Called whenever a case is
 * created, its adjournment count changes, or its priority flag is toggled.
 */
export async function recomputeCasePriority(caseId: string): Promise<PriorityBreakdown> {
  const [{ data: settings }, { data: record, error }] = await Promise.all([
    supabase
      .from("priority_settings")
      .select(
        "id, category_weight, pending_weight, adjournment_weight, boost_points, pending_cap_days, adjournment_cap, max_judge_workload, sched_specialisation_weight, sched_workload_weight, sched_priority_weight, sched_utilisation_weight, ftsc_pocso_weight, senior_citizen_weight, property_dispute_weight, limitation_deadline_weight, limitation_horizon_days",
      )
      .limit(1)
      .maybeSingle(),
    supabase
      .from("cases")
      .select(
        "id, filing_date, previous_adjournments, legal_priority_flag, is_ftsc_pocso, senior_citizen_litigant, property_dispute_5yr_plus, statutory_limitation_deadline, case_categories(name, urgency_weight)",
      )
      .eq("id", caseId)
      .single(),
  ]);
  if (error) throw error;

  const category = (
    record as unknown as { case_categories: { name: string; urgency_weight: number } | null }
  ).case_categories;
  const days = pendingDays(record.filing_date);

  const breakdown = computePriority(
    {
      categoryName: category?.name ?? null,
      categoryUrgency: category?.urgency_weight ?? null,
      pendingDays: days,
      adjournments: record.previous_adjournments ?? 0,
      legalPriorityFlag: Boolean(record.legal_priority_flag),
      isFtscPocso: Boolean(record.is_ftsc_pocso),
      seniorCitizenLitigant: Boolean(record.senior_citizen_litigant),
      propertyDispute5yrPlus: Boolean(record.property_dispute_5yr_plus),
      statutoryLimitationDeadline: record.statutory_limitation_deadline ?? null,
    },
    (settings as PrioritySettings | null) ?? { id: "", ...DEFAULT_PRIORITY_SETTINGS },
  );

  const { error: updateError } = await supabase
    .from("cases")
    .update({
      priority_score: breakdown.score,
      priority_tier: breakdown.tier,
      pending_duration_days: days,
    })
    .eq("id", caseId);
  if (updateError) throw updateError;

  return breakdown;
}

/** Recalculates every case — used after scoring settings change. */
export async function recomputeAllPriorities(): Promise<number> {
  const { data, error } = await supabase.from("cases").select("id");
  if (error) throw error;
  const ids = (data ?? []).map((c) => c.id);
  for (const id of ids) await recomputeCasePriority(id);
  return ids.length;
}
