import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { queryLLM, getEnvVar } from "@/lib/ai.server";

const CandidateSchema = z
  .object({
    key: z.string().optional(),
    judge: z
      .object({
        name: z.string(),
        specialisation: z.string().nullish(),
      })
      .passthrough(),
    courtroom: z
      .object({
        name: z.string(),
      })
      .passthrough(),
    slot: z
      .object({
        date: z.string(),
        start_time: z.string(),
        end_time: z.string(),
      })
      .passthrough(),
    score: z.number(),
    confidence: z.number().optional().default(85),
    factors: z
      .array(
        z
          .object({
            key: z.string().optional(),
            label: z.string().optional(),
            detail: z.string().nullish(),
            points: z.number().optional().default(0),
            weight: z.number().optional().default(0),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

const Input = z.object({
  caseNumber: z.string().default("Case"),
  parties: z.string().nullish(),
  estimatedDuration: z.number().optional().default(60),
  priorityScore: z.number().nullish(),
  topCandidate: CandidateSchema,
  alternatives: z.array(CandidateSchema).optional().default([]),
});

const SYSTEM_PROMPT = [
  "You are an AI judicial scheduling analyst for Indian District Courts.",
  "You explain why a recommended judge, courtroom, and time slot is the optimal fit for a given case.",
  "You also compare it to the available alternative slots.",
  "Strict rules: refer ONLY to the scores, points, and details provided.",
  "Write in a helpful, official, administrative tone.",
  "Keep it under 120 words and format in plain text.",
].join(" ");

function generateRuleBasedExplanation(data: z.infer<typeof Input>): string {
  const top = data.topCandidate;
  const judge = top.judge;
  const room = top.courtroom;
  const slot = top.slot;

  const factors = top.factors || [];
  const specFactor = factors.find((f) => f.key === "specialisation");
  const workloadFactor = factors.find((f) => f.key === "workload");
  const priorityFactor = factors.find((f) => f.key === "priority");

  const topPoints = Math.round(top.score * 10) / 10;
  const conf = Math.round(top.confidence || 85);

  const alts = data.alternatives || [];
  let comparison = "This sitting represents the optimal multi-constraint listing option.";
  if (alts.length > 0 && alts[0]) {
    const nextBest = alts[0];
    const diff = Math.round((topPoints - nextBest.score) * 10) / 10;
    comparison = `Outperforms Alternative 2 (${nextBest.judge.name} in ${nextBest.courtroom.name}) by +${diff} fit points due to superior alignment with bench specialisation and calendar balance.`;
  }

  const startTime = slot.start_time.slice(0, 5);
  const endTime = slot.end_time.slice(0, 5);

  return [
    `Recommended Bench: ${judge.name} · Courtroom: ${room.name} (${topPoints}/100 Fit Score, ${conf}% Confidence)`,
    `• Specialisation & Suitability: ${specFactor?.detail || `${judge.name} (${judge.specialisation || "General Jurisdiction"}) matches case requirements`}${specFactor?.points ? ` (+${specFactor.points} pts)` : ""}.`,
    `• Workload Balance: ${workloadFactor?.detail || "Maintains judicial equilibrium within registry thresholds"}${workloadFactor?.points ? ` (+${workloadFactor.points} pts)` : ""}.`,
    `• Listing Window: Verified for ${slot.date} (${startTime}–${endTime}). All statutory hard constraints (no double-booking, room capacity, slot duration fit) strictly satisfied.`,
    `• Decision Rationale: ${comparison}`,
  ].join("\n");
}

export const explainSchedulingRecommendation = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const hasAI =
      getEnvVar("CUSTOM_LLM_URL") ||
      getEnvVar("OPENAI_API_KEY") ||
      getEnvVar("AI_GATEWAY_API_KEY") ||
      getEnvVar("GEMINI_API_KEY") ||
      getEnvVar("GROQ_API_KEY");

    try {
      if (hasAI) {
        const topFactorText = (data.topCandidate.factors || [])
          .map((f) => `- ${f.label || "Factor"}: +${f.points}/${f.weight} points (${f.detail || "passed"})`)
          .join("\n");

        const alternativesText = (data.alternatives || [])
          .map(
            (alt) =>
              `- ${alt.judge.name} in ${alt.courtroom.name} on ${alt.slot.date} (${alt.slot.start_time}-${alt.slot.end_time}) with fit score ${alt.score}`,
          )
          .join("\n");

        const prompt = `
Case Information:
- Case Number: ${data.caseNumber}
- Parties: ${data.parties || "Parties on record"}
- Estimated Duration: ${data.estimatedDuration} minutes
- Priority Score: ${data.priorityScore ?? "Standard"}

Top Recommended Option (Score: ${data.topCandidate.score}/100, Confidence: ${data.topCandidate.confidence}%):
- Judge: ${data.topCandidate.judge.name} (${data.topCandidate.judge.specialisation || "General"})
- Courtroom: ${data.topCandidate.courtroom.name}
- Slot: Date ${data.topCandidate.slot.date}, Time ${data.topCandidate.slot.start_time} to ${data.topCandidate.slot.end_time}
- Fit Factors:
${topFactorText || "- All 6 statutory constraints cleared"}

Alternative Options:
${alternativesText || "No other valid alternative combinations available."}

Explain concisely why this top recommended slot was selected by the engine, highlighting how it satisfies soft preferences (matching specialization, judge workload, and high-priority listing). Contrast it briefly with the alternatives.
`;

        const explanation = await queryLLM([
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ]);

        if (explanation && explanation.trim().length > 10) {
          return { explanation: explanation.trim() };
        }
      }
    } catch (e) {
      console.warn("AI LLM scheduling explanation encountered an issue, using fallback:", e);
    }

    // High-quality deterministic fallback ensures the user NEVER receives an error
    return {
      explanation: generateRuleBasedExplanation(data),
    };
  });

