import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, ScrollText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/priority-badge";
import type { PriorityBreakdown } from "@/lib/priority";
import { buildOrderReasons, reasonsToPlainText } from "@/lib/why-this-order";
import { summarisePriorityOrder } from "@/lib/why-this-order.functions";

export function WhyThisOrderPanel({
  breakdown,
  caseNumber,
  footer,
}: {
  breakdown: PriorityBreakdown;
  caseNumber: string;
  footer?: React.ReactNode;
}) {
  const summarise = useServerFn(summarisePriorityOrder);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reasons = buildOrderReasons(breakdown);
  const applied = reasons.filter((r) => r.applies);
  const notApplied = reasons.filter((r) => !r.applies);

  async function onSummarise() {
    setLoading(true);
    setSummaryError(null);
    try {
      const result = await summarise({
        data: { breakdownText: reasonsToPlainText(caseNumber, breakdown, reasons) },
      });
      setSummary(result.summary);
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : "Could not generate a plain-language summary.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="text-base">Why this order</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Every point below comes from a statutory category or recorded fact — no inference, no
            free text.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="outline">{breakdown.tier}</Badge>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {breakdown.score}
          </span>
          <PriorityBadge score={breakdown.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {applied.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">
              Routine case — no statutory category applies
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No statutory category, pendency threshold or administrative direction has added
              points, so the case is listed in the ordinary order at the base tier.
            </p>
          </div>
        )}

        {applied.map((r) => (
          <div key={r.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-foreground">{r.headline}</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">+{r.points} pts</p>
            </div>
            <Progress value={r.weight > 0 ? (r.points / r.weight) * 100 : 0} className="h-1.5" />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ScrollText className="mt-0.5 size-3 shrink-0" />
              <span>
                {r.basis} — maximum {r.weight} pts
              </span>
            </p>
          </div>
        ))}

        {notApplied.length > 0 && (
          <div className="rounded-md border border-dashed border-border p-3">
            <p className="text-xs font-medium text-foreground">Categories not contributing</p>
            <ul className="mt-1 space-y-1">
              {notApplied.map((r) => (
                <li key={r.key} className="text-xs text-muted-foreground">
                  {r.headline} — 0 of {r.weight} pts
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-semibold tabular-nums text-foreground">
            {breakdown.rawTotal} pts
            {breakdown.rawTotal !== breakdown.score ? ` → capped at ${breakdown.score}` : ""} / 100
          </span>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Optional: rephrase the breakdown above for a non-technical reader. Factors and points
              never change.
            </p>
            <Button variant="outline" size="sm" onClick={onSummarise} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Draft plain-language summary
            </Button>
          </div>
          {summary && (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-foreground">{summary}</p>
          )}
          {summaryError && (
            <p className="text-xs text-destructive">
              {summaryError} The breakdown above is unaffected.
            </p>
          )}
        </div>

        {footer}
      </CardContent>
    </Card>
  );
}
