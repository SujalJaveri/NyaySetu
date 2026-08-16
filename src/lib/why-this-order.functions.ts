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
 * Optional convenience only — the structured breakdown is always rendered by the
 * client whether or not this call succeeds.
 */
export const summarisePriorityOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Plain-language summaries are not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.breakdownText },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Summary service is busy — please try again shortly.");
    if (res.status === 402)
      throw new Error("AI credits exhausted — add credits to use plain-language summaries.");
    if (!res.ok) throw new Error("Could not generate a plain-language summary.");

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = payload.choices?.[0]?.message?.content?.trim();
    if (!summary) throw new Error("The summary came back empty.");
    return { summary };
  });
