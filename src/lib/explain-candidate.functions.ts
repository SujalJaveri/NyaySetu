import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { queryLLM, getEnvVar } from "@/lib/ai.server";

const CandidateSchema = z.object({
  key: z.string(),
  judge: z.object({
    name: z.string(),
    specialisation: z.string().nullable(),
  }),
  courtroom: z.object({
    name: z.string(),
  }),
  slot: z.object({
    date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
  }),
  score: z.number(),
  confidence: z.number(),
  factors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      detail: z.string(),
      points: z.number(),
      weight: z.number(),
    }),
  ),
});

const Input = z.object({
  caseNumber: z.string(),
  parties: z.string().nullable(),
  estimatedDuration: z.number(),
  priorityScore: z.number().nullable(),
  topCandidate: CandidateSchema,
  alternatives: z.array(CandidateSchema),
});

const SYSTEM_PROMPT = [
  "You are an AI judicial scheduling analyst.",
  "You explain why a recommended judge, courtroom, and time slot is the best fit for a given case.",
  "You also compare it to the available alternative slots.",
  "Strict rules: refer ONLY to the scores, points, and details provided.",
  "Write in a helpful, official, administrative tone.",
  "Keep it under 120 words and format in plain text.",
].join(" ");

export const explainSchedulingRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const hasAI =
      getEnvVar("CUSTOM_LLM_URL") ||
      getEnvVar("OPENAI_API_KEY") ||
      getEnvVar("AI_GATEWAY_API_KEY") ||
      getEnvVar("GEMINI_API_KEY");

    if (!hasAI) {
      return {
        explanation:
          "AI gateway or API key not configured. Enable keys in your environment to get natural-language scheduling explanations.",
      };
    }

    try {
      const topFactorText = data.topCandidate.factors
        .map((f) => `- ${f.label}: +${f.points}/${f.weight} points (${f.detail})`)
        .join("\n");

      const alternativesText = data.alternatives
        .map(
          (alt) =>
            `- ${alt.judge.name} in ${alt.courtroom.name} on ${alt.slot.date} (${alt.slot.start_time}-${alt.slot.end_time}) with fit score ${alt.score}`,
        )
        .join("\n");

      const prompt = `
Case Information:
- Case Number: ${data.caseNumber}
- Parties: ${data.parties || "Unknown"}
- Estimated Duration: ${data.estimatedDuration} minutes
- Priority Score: ${data.priorityScore ?? "Pending"}

Top Recommended Option (Score: ${data.topCandidate.score}/100, Confidence: ${data.topCandidate.confidence}%):
- Judge: ${data.topCandidate.judge.name} (${data.topCandidate.judge.specialisation || "General"})
- Courtroom: ${data.topCandidate.courtroom.name}
- Slot: Date ${data.topCandidate.slot.date}, Time ${data.topCandidate.slot.start_time} to ${data.topCandidate.slot.end_time}
- Fit Factors:
${topFactorText}

Alternative Options:
${alternativesText || "No alternatives available."}

Explain briefly why this top recommended slot was selected by the engine, highlighting how it satisfies soft preferences (such as matching specialization, managing judge workload, and scheduling high-priority cases). Contrast it briefly with the alternatives.
`;

      const explanation = await queryLLM([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ]);

      return {
        explanation:
          explanation ||
          "Could not generate AI explanation. Please refer to the fit score and factors breakdown.",
      };
    } catch (e) {
      console.error("AI scheduling explanation failed:", e);
      return {
        explanation: "AI explanation service is temporarily unavailable.",
      };
    }
  });
