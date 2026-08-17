import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Gauge,
  Gavel,
  Loader2,
  MapPin,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ReasoningList } from "@/components/reasoning-list";
import { ConfidenceBar } from "@/components/confidence-bar";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { cn } from "@/lib/utils";
import type { CaseRow } from "@/lib/cases";
import {
  confidenceFor,
  formatSlotLabel,
  runSchedulingEngine,
  schedulingDataQuery,
  slotMinutes,
  type Candidate,
  type EngineResult,
} from "@/lib/scheduling";
import { conflictDataQuery, detectAssignmentConflicts, type Conflict } from "@/lib/conflicts";

const STEPS = [
  { key: "priority", label: "Checking Priority Score", icon: ShieldCheck },
  { key: "availability", label: "Checking judge & courtroom availability", icon: Gavel },
  { key: "conflicts", label: "Running Conflict Detection", icon: MapPin },
  { key: "duration", label: "Checking duration fit", icon: Timer },
] as const;

/**
 * Runs the same deterministic scheduling engine used by the standalone Smart
 * Scheduling page, but inline on the case itself so a registrar never has to
 * leave the case to list it.
 */
export function CaseSchedulingPanel({ caseRow }: { caseRow: CaseRow }) {
  const engineData = useQuery(schedulingDataQuery);
  const conflictData = useQuery(conflictDataQuery);

  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<EngineResult | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const running = step >= 0 && step < STEPS.length;

  function run() {
    if (!engineData.data) return;
    timers.current.forEach(clearTimeout);
    setResult(null);
    setStep(0);
    // Presentational pacing only — the engine itself is synchronous and deterministic.
    timers.current = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 500 * (i + 1)));
    timers.current.push(
      setTimeout(
        () => {
          setResult(runSchedulingEngine(caseRow, engineData.data!));
          setStep(-1);
        },
        500 * STEPS.length + 200,
      ),
    );
  }

  const top = result?.candidates[0] ?? null;
  const alternatives = result?.candidates.slice(1, 4) ?? [];
  const confidence = result ? confidenceFor(result.candidates) : null;

  // Same hard-constraint check the Conflict Detection screen runs, previewed inline
  // BEFORE the registrar accepts anything.
  let warnings: Conflict[] = [];
  if (top && conflictData.data) {
    warnings = detectAssignmentConflicts({
      caseNumber: caseRow.case_number,
      caseId: caseRow.id,
      estimatedDurationMinutes: caseRow.estimated_duration_minutes,
      judge: top.judge,
      courtroom: top.courtroom,
      slot: top.slot,
      schedules: conflictData.data.schedules,
      availability: conflictData.data.availability,
      maxJudgeWorkload: conflictData.data.maxJudgeWorkload,
    });
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Schedule this case</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Runs the scheduling engine. Hard constraints filter out invalid slots, and soft
            preferences rank only the valid options. Nothing is listed until you accept.
          </p>
        </div>
        <Button onClick={run} disabled={running || engineData.isLoading} size="lg">
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          {running ? "Analysing…" : result ? "Re-run engine" : "Schedule This Case"}
        </Button>
      </div>

      {engineData.isError && (
        <p className="mt-3 text-sm text-destructive">
          Could not load scheduling data. Try again in a moment.
        </p>
      )}

      {(running || result) && (
        <Card className="registry-enter mt-4 shadow-panel">
          <CardHeader>
            <CardTitle className="text-base">
              {running ? "Analysing…" : "Analysis complete"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STEPS.map((s, i) => {
              const done = result !== null || step > i;
              const active = running && step === i;
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                    done
                      ? "border-border bg-muted/40 text-foreground"
                      : active
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  <span className="flex-1">{s.label}</span>
                  {active && <span className="text-xs text-muted-foreground">working…</span>}
                </div>
              );
            })}
            {result && (
              <p className="pt-1 text-xs text-muted-foreground">
                Evaluated {result.evaluated.toLocaleString()} judge × courtroom × slot combinations;{" "}
                {result.valid.toLocaleString()} passed every hard constraint. Rejected — judge
                unavailable: {result.rejections.judgeUnavailable}, courtroom unavailable:{" "}
                {result.rejections.courtroomUnavailable}, judge double-booked:{" "}
                {result.rejections.judgeBooked}, courtroom double-booked:{" "}
                {result.rejections.courtroomBooked}, slot already allocated:{" "}
                {result.rejections.slotOccupied}, duration overflow:{" "}
                {result.rejections.durationOverflow}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {result && !top && (
        <Card className="registry-enter mt-4 border-dashed shadow-panel">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No valid combination found for {caseRow.case_number}. Every option failed at least one
            hard constraint — add hearing slots, free up availability, or shorten the estimated
            hearing duration.
          </CardContent>
        </Card>
      )}

      {top && (
        <div className="mt-4 space-y-4">
          {confidence && (
            <Card className="registry-enter shadow-panel">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div className="flex items-start gap-3">
                  <Gauge className="mt-0.5 size-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Confidence {confidence.value}% in this recommendation
                    </p>
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                      Derived deterministically: all {warnings.length > 0 ? "hard" : "six hard"}{" "}
                      constraint checks passed (15 pts) and the combination earned {top.score} of
                      100 soft-preference points; {Math.round(confidence.fitRatio * 100)}% fit,{" "}
                      {confidence.margin.toFixed(1)} points clear of the next valid option.
                    </p>
                  </div>
                </div>
                <div className="w-full max-w-xs">
                  <Progress value={confidence.value} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          {result?.blocked && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                Conflict Detection — preferred sitting blocked
              </p>
              <p className="mt-2 text-sm text-destructive">
                The best-ranked combination was {result.blocked.judge.name} in{" "}
                {result.blocked.courtroom.name} on {formatSlotLabel(result.blocked.slot)} (fit score{" "}
                {result.blocked.score}), but it violates a hard constraint:
              </p>
              <ul className="mt-1 space-y-1 text-sm text-destructive">
                {result.blocked.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-destructive/80">
                The engine discarded it and fell back to the next-best valid option shown below.
              </p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                Conflict Detection — review before accepting
              </p>
              <ul className="mt-2 space-y-1 text-sm text-destructive">
                {warnings.map((c) => (
                  <li key={c.kind}>{c.message}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-destructive/80">
                Accepting will be blocked while any hard constraint is violated — pick an
                alternative below or free up the judge, courtroom or slot first.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <RecommendationPanel
              key={caseRow.id + top.key}
              caseRow={caseRow}
              top={top}
              alternatives={alternatives}
            />
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                Alternative scheduling options
              </h3>
              {alternatives.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No other valid combinations were found.
                </p>
              )}
              {alternatives.map((c, i) => (
                <AlternativeCard key={c.key} candidate={c} caseRow={caseRow} rank={i + 2} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AlternativeCard({
  candidate,
  caseRow,
  rank,
}: {
  candidate: Candidate;
  caseRow: CaseRow;
  rank: number;
}) {
  return (
    <Card className="registry-interactive shadow-panel">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <Badge variant="secondary" className="mb-2">
            Option {rank}
          </Badge>
          <CardTitle className="text-base">{candidate.judge.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidate.courtroom.name} · {formatSlotLabel(candidate.slot)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-foreground">{candidate.score}</p>
          <p className="text-xs text-muted-foreground">fit score / 100</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ConfidenceBar value={candidate.confidence} />
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Hard constraints passed — {caseRow.estimated_duration_minutes} min fits the{" "}
          {slotMinutes(candidate.slot)} min slot.
        </div>
        <ReasoningList candidate={candidate} caseRow={caseRow} heading="Reasoning" compact />
      </CardContent>
    </Card>
  );
}
