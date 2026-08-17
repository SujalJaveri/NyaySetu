import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { queryLLM } from "@/lib/ai.server";

const Input = z.object({ breakdownText: z.string().min(1).max(4000) });

const SYSTEM_PROMPT = [
  "You rephrase an already-computed court case priority breakdown into one short paragraph",
  "for a non-technical reader.",
  "Strict rules: use ONLY the factors and point values given. Never add, remove, reweight,",
  "re-rank or speculate about any factor. Describe only the statutory categories listed.",
  "Keep it under 90 words, plain English, neutral registry tone.",
].join(" ");

/**
 * Convenience server function for natural-language priority breakdown summary.
 * The structured statutory breakdown is always rendered deterministically on the client.
 */
export const summarisePriorityOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    try {
      const summary = await queryLLM([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: data.breakdownText },
      ]);
      return {
        summary:
          summary ||
          `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`,
      };
    } catch {
      return {
        summary: `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`,
      };
    }
  });
