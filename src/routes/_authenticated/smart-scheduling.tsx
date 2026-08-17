import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Gavel, Loader2, MapPin, Play, ShieldCheck, Timer } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { PriorityBadge } from "@/components/priority-badge";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { ReasoningList } from "@/components/reasoning-list";
import { ConfidenceBar } from "@/components/confidence-bar";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { casesQuery, type CaseRow } from "@/lib/cases";
import {
  formatSlotLabel,
  runSchedulingEngine,
  schedulingDataQuery,
  slotMinutes,
  type Candidate,
  type EngineResult,
} from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/smart-scheduling")({
  head: () => ({
    meta: [
      { title: "Smart Scheduling — NyayaSetu" },
      {
        name: "description",
        content:
          "Run the deterministic scheduling engine to find valid judge, courtroom and slot combinations.",
      },
      { property: "og:title", content: "Smart Scheduling — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Run the deterministic scheduling engine to find valid judge, courtroom and slot combinations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const STEPS = [
  { key: "priority", label: "Checking case priority", icon: ShieldCheck },
  { key: "availability", label: "Checking judge & courtroom availability", icon: Gavel },
  { key: "conflicts", label: "Checking booking conflicts", icon: MapPin },
  { key: "duration", label: "Checking duration fit", icon: Timer },
] as const;

const PENDING_STATUSES = ["filed", "adjourned"];

function Page() {
  const cases = useQuery(casesQuery);
  const engineData = useQuery(schedulingDataQuery);

  const [caseId, setCaseId] = useState<string>("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [ranCase, setRanCase] = useState<CaseRow | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pending = useMemo(
    () => (cases.data ?? []).filter((c) => PENDING_STATUSES.includes(c.status)),
    [cases.data],
  );
  const selected = pending.find((c) => c.id === caseId) ?? null;
  const running = step >= 0 && step < STEPS.length;

  function run() {
    if (!selected || !engineData.data) return;
    timers.current.forEach(clearTimeout);
    setResult(null);
    setRanCase(selected);
    setStep(0);
    // Purely presentational pacing — the engine itself is synchronous and deterministic.
    timers.current = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 550 * (i + 1)));
    timers.current.push(
      setTimeout(
        () => {
          setResult(runSchedulingEngine(selected, engineData.data!));
          setStep(-1);
        },
        550 * STEPS.length + 250,
      ),
    );
  }

  const top = result?.candidates[0] ?? null;
  const alternatives = result?.candidates.slice(1, 4) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Automation"
        title="Smart Scheduling"
        description="Batch view for working through pending cases. To list a single case, use Schedule This Case on the case detail page. Hard constraints filter invalid slots, and soft preferences rank only the valid options."
      />

      {(cases.isError || engineData.isError) && (
        <ErrorState
          title="Could not load scheduling data"
          error={cases.error ?? engineData.error}
          onRetry={() => {
            void cases.refetch();
            void engineData.refetch();
          }}
          retrying={cases.isFetching || engineData.isFetching}
        />
      )}

      <Card className="registry-enter mt-6 shadow-panel">
        <CardHeader>
          <CardTitle className="text-base">Select a pending case</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Select
              value={caseId}
              onValueChange={setCaseId}
              disabled={cases.isLoading || pending.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={pending.length === 0 ? "No pending cases" : "Choose a case…"}
                />
              </SelectTrigger>
              <SelectContent>
                {pending.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number} · {c.case_categories?.name ?? "Uncategorised"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PriorityBadge score={selected.priority_score} />
                <span>{selected.estimated_duration_minutes} min estimated</span>
                <span>·</span>
                <span>{selected.previous_adjournments} adjournments</span>
                <span>·</span>
                <span className="truncate">{selected.parties}</span>
              </div>
            )}
          </div>
          <Button
            onClick={run}
            disabled={!selected || running || engineData.isLoading}
            className="sm:w-56"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Analysing…" : "Run Scheduling Engine"}
          </Button>
        </CardContent>
      </Card>

      {(running || result) && (
        <Card className="registry-enter mt-6 shadow-panel">
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
            {result && ranCase && (
              <p className="pt-1 text-xs text-muted-foreground">
                Evaluated {result.evaluated.toLocaleString()} judge × courtroom × slot combinations
                for {ranCase.case_number}; {result.valid.toLocaleString()} passed every hard
                constraint. Rejected — judge unavailable: {result.rejections.judgeUnavailable},
                courtroom unavailable: {result.rejections.courtroomUnavailable}, judge
                double-booked: {result.rejections.judgeBooked}, courtroom double-booked:{" "}
                {result.rejections.courtroomBooked}, slot already allocated:{" "}
                {result.rejections.slotOccupied}, duration overflow:{" "}
                {result.rejections.durationOverflow}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {result && !top && (
        <Card className="registry-enter mt-6 border-dashed shadow-panel">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No valid combination found. Every option failed at least one hard constraint — add
            hearing slots, free up availability, or shorten the estimated hearing duration.
          </CardContent>
        </Card>
      )}

      {top && ranCase && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <RecommendationPanel
            key={ranCase.id + top.key}
            caseRow={ranCase}
            top={top}
            alternatives={alternatives}
          />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">
              Alternative scheduling options
            </h2>
            {alternatives.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No other valid combinations were found.
              </p>
            )}
            {alternatives.map((c, i) => (
              <CandidateCard key={c.key} candidate={c} caseRow={ranCase} rank={i + 2} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate,
  caseRow,
  recommended,
  rank,
}: {
  candidate: Candidate;
  caseRow: CaseRow;
  recommended?: boolean;
  rank?: number;
}) {
  return (
    <Card className={cn("shadow-panel", recommended && "border-primary/40")}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          {recommended ? (
            <Badge className="mb-2">Scheduling recommendation · top ranked</Badge>
          ) : (
            <Badge variant="secondary" className="mb-2">
              Option {rank}
            </Badge>
          )}
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
      <CardContent className="space-y-4">
        <ConfidenceBar
          value={candidate.confidence}
          hint="Share of the soft preferences this option satisfies, plus a flat 15% for clearing every hard constraint."
        />
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Hard constraints passed — judge and courtroom both available, no overlapping booking, and{" "}
          {caseRow.estimated_duration_minutes} min fits the {slotMinutes(candidate.slot)} min slot.
        </div>
        <div className="space-y-3">
          {candidate.factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{f.label}</span>
                <span className="text-muted-foreground">
                  +{f.points} / {f.weight}
                </span>
              </div>
              <Progress value={(f.points / f.weight) * 100} className="mt-1 h-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </div>
        <ReasoningList
          candidate={candidate}
          caseRow={caseRow}
          heading="Reasoning"
          compact
          className="border-t border-border pt-4"
        />
      </CardContent>
    </Card>
  );
}
