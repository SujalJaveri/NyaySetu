import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { buildPublicSummary } from "@/lib/case-status-summary";
import type { PublicCaseStatus } from "@/lib/case-status.functions";
import {
  PUBLIC_LANGUAGES,
  translateCaseStatusSummary,
  type PublicLanguage,
} from "@/lib/case-status-translate.functions";

const HEADING: Record<PublicLanguage, string> = {
  en: "What this means",
  hi: "इसका अर्थ",
  mr: "याचा अर्थ",
};

export function PublicCaseSummary({ result }: { result: PublicCaseStatus }) {
  const translate = useServerFn(translateCaseStatusSummary);
  const english = buildPublicSummary(result);

  const [language, setLanguage] = useState<PublicLanguage>("en");
  const [text, setText] = useState(english);
  const [pending, setPending] = useState(false);
  const [fellBack, setFellBack] = useState(false);

  // Reset when a different case is looked up.
  useEffect(() => {
    setLanguage("en");
    setText(english);
    setFellBack(false);
  }, [english]);

  async function choose(next: PublicLanguage) {
    if (next === language && !fellBack) return;
    setFellBack(false);
    if (next === "en") {
      setLanguage("en");
      setText(english);
      return;
    }
    setPending(true);
    try {
      const res = await translate({
        data: { caseNumber: result.caseNumber, language: next, summary: english },
      });
      setLanguage(next);
      setText(res.summary);
    } catch {
      // Fall back to English rather than showing a broken state.
      setLanguage("en");
      setText(english);
      setFellBack(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-lg border bg-card p-5 shadow-sm"
      lang={language}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="summary-heading" className="text-lg font-semibold text-foreground">
          {HEADING[language]}
        </h2>
        <div
          role="group"
          aria-label="Choose language"
          className="inline-flex rounded-md border bg-muted/40 p-0.5"
        >
          {PUBLIC_LANGUAGES.map((option) => (
            <Button
              key={option.code}
              type="button"
              size="sm"
              variant={language === option.code ? "default" : "ghost"}
              aria-pressed={language === option.code}
              disabled={pending}
              onClick={() => choose(option.code)}
              className="h-8 px-3 text-xs"
              lang={option.code}
            >
              {option.native}
            </Button>
          ))}
        </div>
      </div>

      <p
        aria-live="polite"
        aria-busy={pending}
        className="mt-3 text-base leading-relaxed text-foreground"
        style={{ opacity: pending ? 0.6 : 1 }}
        lang={language}
      >
        {pending ? "Translating…" : text}
      </p>

      {fellBack ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Translation is unavailable just now, so the summary is shown in English.
        </p>
      ) : null}
    </section>
  );
}
