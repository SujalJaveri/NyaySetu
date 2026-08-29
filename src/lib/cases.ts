import { supabase } from "@/integrations/supabase/client";

export const CASE_STATUSES = [
  "filed",
  "scheduled",
  "in_progress",
  "adjourned",
  "disposed",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Statuses where a registrar would still be looking to list the case. */
export const SCHEDULABLE_STATUSES: readonly CaseStatus[] = ["filed", "adjourned"];

export const statusLabel: Record<CaseStatus, string> = {
  filed: "Filed",
  scheduled: "Scheduled",
  in_progress: "In progress",
  adjourned: "Adjourned",
  disposed: "Disposed",
};

export type CaseCategory = {
  id: string;
  name: string;
  typical_duration_minutes: number;
  urgency_weight: number;
};

export type CaseRow = {
  id: string;
  case_number: string;
  cnr_number?: string | null;
  category_id: string | null;
  filing_date: string;
  status: CaseStatus;
  parties: string;
  estimated_duration_minutes: number;
  predicted_duration_minutes?: number | null;
  adjournment_risk_score?: number | null;
  pending_duration_days: number;
  previous_adjournments: number;
  priority_score: number | null;
  priority_tier: string | null;
  legal_priority_flag: boolean;
  is_ftsc_pocso: boolean;
  senior_citizen_litigant: boolean;
  property_dispute_5yr_plus: boolean;
  statutory_limitation_deadline: string | null;
  created_at: string;
  /** Demo walkthrough marker — pinned to the top of the Cases list with an "Example" tag. */
  is_example: boolean;
  example_order: number | null;
  example_label: string | null;
  example_note: string | null;
  case_categories: { id: string; name: string; urgency_weight: number } | null;
};

export type AdjournmentRow = {
  id: string;
  case_id: string;
  reason: string;
  previous_slot_id: string | null;
  created_at: string;
  hearing_slots: { id: string; date: string; start_time: string; end_time: string } | null;
};

const CASE_SELECT =
  "id, case_number, category_id, filing_date, status, parties, estimated_duration_minutes, pending_duration_days, previous_adjournments, priority_score, priority_tier, legal_priority_flag, is_ftsc_pocso, senior_citizen_litigant, property_dispute_5yr_plus, statutory_limitation_deadline, created_at, is_example, example_order, example_label, example_note, case_categories(id, name, urgency_weight)";

export const caseCategoriesQuery = {
  queryKey: ["case-categories"],
  queryFn: async (): Promise<CaseCategory[]> => {
    const { data, error } = await supabase
      .from("case_categories")
      .select("id, name, typical_duration_minutes, urgency_weight")
      .order("name");
    if (error) throw error;
    return (data ?? []) as CaseCategory[];
  },
};

export const casesQuery = {
  queryKey: ["cases"],
  queryFn: async (): Promise<CaseRow[]> => {
    const { data, error } = await supabase.from("cases").select(CASE_SELECT).order("filing_date", {
      ascending: false,
    });
    if (error) throw error;

    return (data ?? []).map((c) => {
      const numPart = (c.case_number || "0001").replace(/[^0-9]/g, "");
      const seq = parseInt(numPart || "1", 10);
      const prefix = (c.case_number || "").startsWith("CRL") ? "DLCT02" : "DLCT01";
      const cnr = `${prefix}-${String(seq).padStart(6, "0")}-2026`;

      return {
        ...c,
        cnr_number: cnr,
        predicted_duration_minutes: c.estimated_duration_minutes || 45,
        adjournment_risk_score: Math.min(95, Math.max(10, (c.previous_adjournments || 0) * 18 + 15)),
      };
    }) as unknown as CaseRow[];
  },
};

export function adjournmentsQuery(caseId: string) {
  return {
    queryKey: ["adjournments", caseId],
    queryFn: async (): Promise<AdjournmentRow[]> => {
      const { data, error } = await supabase
        .from("adjournments")
        .select(
          "id, case_id, reason, previous_slot_id, created_at, hearing_slots(id, date, start_time, end_time)",
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdjournmentRow[];
    },
  };
}

export function pendingDays(filingDate: string) {
  if (!filingDate) return 0;
  const filed = new Date(`${filingDate}T00:00:00`);
  if (Number.isNaN(filed.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - filed.getTime()) / 86_400_000));
}

export type PriorityBand = "high" | "medium" | "low" | "pending";

export function priorityBand(score: number | null): PriorityBand {
  if (score === null || score === undefined) return "pending";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Generates the next case number for the current year, e.g. CIV-2026-0001 or CASE-2026-0001. */
export async function generateCaseNumber(categoryCode = "CASE"): Promise<string> {
  const year = new Date().getFullYear();
  const cleanPrefix = (categoryCode || "CASE").trim().toUpperCase();
  const prefix = `${cleanPrefix}-${year}-`;
  const { data, error } = await supabase
    .from("cases")
    .select("case_number")
    .like("case_number", `${prefix}%`)
    .order("case_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = data?.[0]?.case_number;
  const next = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(4, "0")}`;
}

/**
 * Generates a standard Indian 16-character CNR Number:
 * Format: [State(2)][District(2)][Complex(2)][Sequence(6)][Year(4)]
 * Example: DLCT01-002415-2026
 */
export function generateCnrNumber(
  stateCode = "DL",
  districtCode = "CT",
  complexCode = "01",
  sequence = 1,
): string {
  const year = new Date().getFullYear();
  const seqStr = String(sequence).padStart(6, "0");
  return `${stateCode.toUpperCase()}${districtCode.toUpperCase()}${complexCode}-${seqStr}-${year}`;
}

/**
 * Validates whether a string matches Indian 16-character CNR syntax.
 */
export function validateCnrNumber(cnr: string): boolean {
  if (!cnr) return false;
  const clean = cnr.trim().toUpperCase();
  // Regex: 6 alphanumeric chars, optional hyphen/slash, 6 digits, optional hyphen/slash, 4 digits year
  return /^[A-Z]{2}[A-Z0-9]{4}[-\s]?[0-9]{6}[-\s]?[0-9]{4}$/.test(clean);
}
