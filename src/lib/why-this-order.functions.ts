import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["AI_GATEWAY_API_KEY"] || process.env["OPENAI_API_KEY"] || process.env["GEMINI_API_KEY"];
    if (!apiKey) {
      // Deterministic clean fallback if no external LLM gateway is configured
      return { 
        summary: `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`
      };
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: data.breakdownText },
          ],
        }),
      });

      if (!res.ok) {
        return { 
          summary: `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`
        };
      }

      const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const summary = payload.choices?.[0]?.message?.content?.trim();
      return { summary: summary || `Prioritised according to registry rules.` };
    } catch {
      return { 
        summary: `Prioritised based on statutory urgency criteria, limitation period, and listing constraints as detailed in the official breakdown.`
      };
    }
  });
