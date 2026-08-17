import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { queryLLM } from "@/lib/ai.server";

export const PUBLIC_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type PublicLanguage = (typeof PUBLIC_LANGUAGES)[number]["code"];

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi (Devanagari script)",
  mr: "Marathi (Devanagari script)",
};

const Input = z.object({
  caseNumber: z.string().min(1).max(40),
  language: z.enum(["en", "hi", "mr"]),
  summary: z.string().min(1).max(1200),
});

const SYSTEM_PROMPT = [
  "You translate a short court-registry notice for a member of the public.",
  "Translate the given English sentence(s) faithfully into the requested language.",
  "Do not add, remove, explain or reinterpret any information.",
  "Keep case numbers, dates, times, judge names and courtroom names exactly as written in Latin script.",
  "Use simple, respectful, official language. Reply with the translation only, no preamble.",
].join(" ");

async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Public: translates the plain-language public case-status summary only.
 * Never handles internal scoring, tiers or reasoning. Cached per case + language +
 * summary content, so a re-listing produces a fresh translation but repeat visits do not.
 */
export const translateCaseStatusSummary = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(
    async ({ data }): Promise<{ summary: string; language: PublicLanguage; cached: boolean }> => {
      if (data.language === "en") {
        return { summary: data.summary, language: "en", cached: true };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sourceHash = await hashText(data.summary);

      const { data: cached } = await supabaseAdmin
        .from("case_status_translations")
        .select("summary")
        .eq("case_number", data.caseNumber)
        .eq("language", data.language)
        .eq("source_hash", sourceHash)
        .maybeSingle();

      if (cached?.summary) {
        return { summary: cached.summary, language: data.language, cached: true };
      }

      try {
        const translated = await queryLLM([
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Target language: ${LANGUAGE_NAMES[data.language]}\n\n${data.summary}`,
          },
        ]);

        if (!translated) {
          return { summary: data.summary, language: data.language, cached: true };
        }

        await supabaseAdmin.from("case_status_translations").upsert(
          {
            case_number: data.caseNumber,
            language: data.language,
            source_hash: sourceHash,
            summary: translated,
          },
          { onConflict: "case_number,language,source_hash" },
        );

        return { summary: translated, language: data.language, cached: false };
      } catch {
        return { summary: data.summary, language: data.language, cached: true };
      }
    },
  );
