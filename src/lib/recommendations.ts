/**
 * Deterministic reasoning + decision recording for scheduling recommendations.
 *
 * The reasoning list is generated from a fixed template driven ONLY by the engine's
 * own output (constraint results and soft-preference points). No text is invented,
 * and no AI model is involved at any point.
 */
import { supabase } from "@/integrations/supabase/client";
import { MAX_JUDGE_WORKLOAD } from "@/lib/registry";
import type { CaseRow } from "@/lib/cases";
import { formatSlotLabel, slotMinutes, type Candidate } from "@/lib/scheduling";
import { detectAssignmentConflicts, fetchConflictData, type Conflict } from "@/lib/conflicts";

/** Thrown when a scheduling action would violate a hard constraint. */
export class ConflictError extends Error {
  conflicts: Conflict[];
  constructor(conflicts: Conflict[]) {
    super(conflicts.map((c) => c.message).join(" "));
    this.name = "ConflictError";
    this.conflicts = conflicts;
  }
}

export type ReasonTone = "constraint" | "preference" | "caution";

export type Reason = { key: string; tone: ReasonTone; text: string };

export type DecisionAction = "accepted" | "modified" | "rejected";

/** Builds the plain-language reasoning list from the engine result for one candidate. */
export function buildReasoning(candidate: Candidate, caseRow: CaseRow): Reason[] {
  const { judge, courtroom, slot, factors } = candidate;
  const factor = (key: string) => factors.find((f) => f.key === key);
  const specialisation = factor("specialisation");
  const workload = factor("workload");
  const priority = factor("priority");
  const utilisation = factor("utilisation");

  const reasons: Reason[] = [
    {
      key: "judge-available",
      tone: "constraint",
      text: `Judge ${judge.name} is marked available at ${formatSlotLabel(slot)}`,
    },
    {
      key: "courtroom-available",
      tone: "constraint",
      text: `${courtroom.name} is available at this slot and seats ${courtroom.capacity}`,
    },
    {
      key: "no-conflict",
      tone: "constraint",
      text: "No scheduling conflict — neither the judge, the courtroom nor the slot is already booked at an overlapping time",
    },
    {
      key: "duration",
      tone: "constraint",
      text: `Estimated duration of ${caseRow.estimated_duration_minutes} min fits within the ${slotMinutes(slot)} min slot`,
    },
  ];

  if (specialisation) {
    reasons.push(
      specialisation.points >= specialisation.weight * 0.8
        ? {
            key: "specialisation",
            tone: "preference",
            text: `Judge specialisation (${judge.specialisation}) matches the case category ${caseRow.case_categories?.name ?? "—"}`,
          }
        : specialisation.points > 0
          ? {
              key: "specialisation",
              tone: "preference",
              text: `Judge specialisation (${judge.specialisation}) partially overlaps the case category ${caseRow.case_categories?.name ?? "—"}`,
            }
          : {
              key: "specialisation",
              tone: "caution",
              text: `Judge specialisation (${judge.specialisation || "not recorded"}) does not match the case category ${caseRow.case_categories?.name ?? "—"} — this did not disqualify the slot, it only lowered the ranking`,
            },
    );
  }

  if (workload) {
    reasons.push({
      key: "workload",
      tone: workload.points >= workload.weight * 0.4 ? "preference" : "caution",
      text:
        workload.points >= workload.weight * 0.4
          ? `Judge's current workload remains balanced at ${judge.current_workload} of ${MAX_JUDGE_WORKLOAD} active hearings`
          : `Judge is already carrying a heavy workload (${judge.current_workload} of ${MAX_JUDGE_WORKLOAD} active hearings)`,
    });
  }

  if (priority) {
    reasons.push({
      key: "priority",
      tone: "preference",
      text: `${caseRow.priority_tier ?? "Tier 3"} case — priority score ${Math.round(caseRow.priority_score ?? 50)} was used to rank this sitting — ${priority.detail.toLowerCase()}`,
    });
  }

  if (utilisation) {
    reasons.push({
      key: "utilisation",
      tone: "preference",
      text: `Courtroom utilisation stays efficient — ${utilisation.detail.toLowerCase()}`,
    });
  }

  return reasons;
}

/** Flattens the reasoning into the text stored in ai_recommendations.reasoning. */
export function reasoningToText(candidate: Candidate, caseRow: CaseRow, reasons: Reason[]) {
  const header = `Deterministic rules engine · fit score ${candidate.score}/100 · ${candidate.judge.name} · ${candidate.courtroom.name} · ${formatSlotLabel(candidate.slot)} · case ${caseRow.case_number}`;
  return [header, ...reasons.map((r) => `- ${r.text}`)].join("\n");
}

const actionVerb: Record<DecisionAction, string> = {
  accepted: "Accepted scheduling recommendation; listing created",
  modified: "Modified scheduling recommendation (chose an alternative valid slot); listing created",
  rejected: "Rejected scheduling recommendation; no listing confirmed",
};

/**
 * Records the human decision: creates the schedule, stores the reasoning against it
 * in ai_recommendations with the chosen status, and writes an audit_logs entry.
 */
export async function recordDecision(params: {
  caseRow: CaseRow;
  candidate: Candidate;
  action: DecisionAction;
  userId: string;
}) {
  const { caseRow, candidate, action, userId } = params;
  const reasons = buildReasoning(candidate, caseRow);

  // Re-validate against live data — a conflict may have appeared since the engine ran.
  if (action !== "rejected") {
    const data = await fetchConflictData();
    const conflicts = detectAssignmentConflicts({
      caseNumber: caseRow.case_number,
      caseId: caseRow.id,
      estimatedDurationMinutes: caseRow.estimated_duration_minutes,
      judge: candidate.judge,
      courtroom: candidate.courtroom,
      slot: candidate.slot,
      schedules: data.schedules,
      availability: data.availability,
      maxJudgeWorkload: data.maxJudgeWorkload,
    });
    if (conflicts.length > 0) throw new ConflictError(conflicts);
  }

  const { data: schedule, error: scheduleError } = await supabase
    .from("schedules")
    .insert({
      case_id: caseRow.id,
      judge_id: candidate.judge.id,
      courtroom_id: candidate.courtroom.id,
      slot_id: candidate.slot.id,
      // A rejected recommendation is kept as a cancelled schedule so the reasoning
      // and the human decision stay auditable.
      status: action === "rejected" ? "cancelled" : "proposed",
    })
    .select("id")
    .single();
  if (scheduleError) throw scheduleError;

  const { error: recError } = await supabase.from("ai_recommendations").insert({
    schedule_id: schedule.id,
    reasoning: reasoningToText(candidate, caseRow, reasons),
    status: action,
  });
  if (recError) throw recError;

  if (action !== "rejected") {
    await supabase.from("cases").update({ status: "scheduled" }).eq("id", caseRow.id);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action: `${actionVerb[action]} — ${candidate.judge.name} / ${candidate.courtroom.name} / ${formatSlotLabel(candidate.slot)}`,
    entity_affected: `case:${caseRow.case_number} schedule:${schedule.id}`,
  });
  if (auditError) throw auditError;

  return { scheduleId: schedule.id };
}

/** Fetches the stored scheduling recommendation (reasoning + human decision) for a schedule. */
export function scheduleRecommendationQuery(scheduleId: string | null | undefined) {
  return {
    queryKey: ["ai-recommendation", scheduleId ?? "none"],
    enabled: Boolean(scheduleId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("id, reasoning, status, created_at")
        .eq("schedule_id", scheduleId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}
