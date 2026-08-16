import { AlertTriangle, CheckCircle2, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CaseRow } from "@/lib/cases";
import type { Candidate } from "@/lib/scheduling";
import { buildReasoning, type Reason } from "@/lib/recommendations";

const toneStyles: Record<Reason["tone"], string> = {
  constraint: "text-primary",
  preference: "text-foreground",
  caution: "text-destructive",
};

/**
 * Renders the deterministic reasoning behind a scheduling recommendation. Used everywhere a
 * recommendation is shown so the "why" always travels with the suggestion.
 */
export function ReasoningList({
  candidate,
  caseRow,
  heading = "Why this combination was recommended",
  compact = false,
  className,
}: {
  candidate: Candidate;
  caseRow: CaseRow;
  heading?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const reasons = buildReasoning(candidate, caseRow);
  return (
    <div className={className}>
      {heading && (
        <h3
          className={cn(
            "mb-2 flex items-center gap-2 font-semibold text-foreground",
            compact ? "text-xs uppercase tracking-wide text-muted-foreground" : "text-sm",
          )}
        >
          <ScrollText className="size-3.5 text-muted-foreground" />
          {heading}
        </h3>
      )}
      <ul className={cn("space-y-1.5", compact && "space-y-1")}>
        {reasons.map((r) => (
          <li key={r.key} className={cn("flex items-start gap-2", compact ? "text-xs" : "text-sm")}>
            {r.tone === "caution" ? (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className={cn("mt-0.5 size-3.5 shrink-0", toneStyles[r.tone])} />
            )}
            <span className="text-muted-foreground">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renders reasoning previously stored against a schedule in the recommendations record. */
export function StoredReasoning({
  text,
  heading = "Scheduling recommendation reasoning",
}: {
  text: string;
  heading?: string;
}) {
  const lines = text.split("\n").filter(Boolean);
  const header = lines[0]?.startsWith("- ") ? null : lines[0];
  const bullets = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ScrollText className="size-3.5 text-muted-foreground" />
        {heading}
      </h3>
      {header && <p className="mb-2 text-xs text-muted-foreground">{header}</p>}
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
