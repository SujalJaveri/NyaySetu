import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Gavel,
  Loader2,
  MapPin,
  Pencil,
  Play,
  Scale,
  ShieldCheck,
  Sparkles,
  Timer,
  UserCheck,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { PriorityBadge } from "@/components/priority-badge";
import { RecommendationPanel } from "@/components/recommendation-panel";
import { ReasoningList } from "@/components/reasoning-list";
import { ConfidenceBar } from "@/components/confidence-bar";
import { DecisionReceiptCard } from "@/components/decision-receipt-card";
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
import { useCurrentStaff, permissionsFor } from "@/hooks/use-current-staff";
import { recordDecision, ConflictError } from "@/lib/recommendations";
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
  { key: "priority", label: "Priority scoring check", icon: ShieldCheck },
  { key: "availability", label: "Judge & room availability", icon: Gavel },
  { key: "conflicts", label: "Booking clash scanning", icon: MapPin },
  { key: "duration", label: "Slot duration fit check", icon: Timer },
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
    timers.current = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 450 * (i + 1)));
    timers.current.push(
      setTimeout(
        () => {
          setResult(runSchedulingEngine(selected, engineData.data!));
          setStep(-1);
        },
        450 * STEPS.length + 200,
      ),
    );
  }

  const top = result?.candidates[0] ?? null;
  const alternatives = result?.candidates.slice(1, 4) ?? [];

  function loadDemo() {
    if (!pending.length || !engineData.data) return;
    const best = [...pending].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))[0];
    if (!best) return;
    setCaseId(best.id);
    setTimeout(() => {
      timers.current.forEach(clearTimeout);
      setResult(null);
      setRanCase(best);
      setStep(0);
      timers.current = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 450 * (i + 1)));
      timers.current.push(
        setTimeout(() => {
          setResult(runSchedulingEngine(best, engineData.data!));
          setStep(-1);
        }, 450 * STEPS.length + 200),
      );
    }, 50);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9 space-y-6">
      <PageHeader
        eyebrow="Automation"
        title="Smart Scheduling"
        description="Multi-constraint solver for pending court matters. Hard constraints strictly filter invalid slots; soft preferences rank the optimal listings."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDemo}
              disabled={!pending.length || !engineData.data || running}
              className="gap-1.5 text-xs shadow-sm"
              title="Pre-select the highest-priority pending case and run the engine"
            >
              <FlaskConical className="size-3.5 text-primary" />
              Load SIH Demo
            </Button>
          </div>
        }
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

      {/* Case Selector Card */}
      <Card className="registry-enter shadow-panel border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Select Pending Case for Listing
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {pending.length} Unscheduled Case{pending.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="space-y-2">
              <Select
                value={caseId}
                onValueChange={setCaseId}
                disabled={cases.isLoading || pending.length === 0}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue
                    placeholder={pending.length === 0 ? "No pending cases in registry" : "Choose a pending case…"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {pending.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-semibold">{c.case_number}</span> · {c.case_categories?.name ?? "Uncategorised"} · {c.parties || "Parties on record"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selected && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <PriorityBadge score={selected.priority_score} />
                  <span className="inline-flex items-center gap-1 font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                    <Clock className="size-3 text-muted-foreground" />
                    {selected.estimated_duration_minutes} min duration
                  </span>
                  <span>·</span>
                  <span>{selected.previous_adjournments} previous adjournment{selected.previous_adjournments !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span className="truncate max-w-md font-medium text-foreground">{selected.parties}</span>
                </div>
              )}
            </div>

            <Button
              onClick={run}
              disabled={!selected || running || engineData.isLoading}
              size="lg"
              className="h-10 sm:w-56 gap-2 shrink-0 font-medium"
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
              {running ? "Solving Constraints…" : "Run Scheduling Engine"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress / Step Feedback Tracker */}
      {(running || result) && (
        <Card className="registry-enter shadow-panel border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                {running ? "Evaluating Combinations against Hard & Soft Constraints…" : "Constraint Solver Analysis Complete"}
              </CardTitle>
              {result && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {result.valid} Valid Listing{result.valid !== 1 ? "s" : ""} Found
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {STEPS.map((s, i) => {
                const done = result !== null || step > i;
                const active = running && step === i;
                const Icon = s.icon;
                return (
                  <div
                    key={s.key}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md border p-3 text-xs transition-all",
                      done
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : active
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                          : "border-border bg-card text-muted-foreground opacity-60",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-4 text-primary shrink-0" />
                    ) : active ? (
                      <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <Icon className="size-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {done ? "Verified" : active ? "Evaluating…" : "Queued"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {result && ranCase && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <span>
                  Evaluated <strong className="text-foreground">{result.evaluated.toLocaleString()}</strong> Judge × Courtroom × Slot combinations for <span className="font-semibold text-foreground">{ranCase.case_number}</span>.
                </span>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="bg-background px-2 py-0.5 rounded border border-border">
                    Judge Busy: {result.rejections.judgeUnavailable + result.rejections.judgeBooked}
                  </span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border">
                    Room Busy: {result.rejections.courtroomUnavailable + result.rejections.courtroomBooked}
                  </span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border">
                    Slot Clash: {result.rejections.slotOccupied}
                  </span>
                  <span className="bg-background px-2 py-0.5 rounded border border-border">
                    Duration Overflow: {result.rejections.durationOverflow}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No valid combinations found alert */}
      {result && !top && (
        <Card className="registry-enter border-dashed border-destructive/40 bg-destructive/5 shadow-panel">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-semibold text-destructive">
              No valid combination found for this case.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Every combination failed at least one hard constraint. You can add hearing slots, check judge availability, or use Custom / Judge's Directive to manually schedule.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results Presentation */}
      {top && ranCase && (
        <div className="space-y-6 pt-2">
          {/* AI Explainability Decision Receipt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Scale className="size-3.5" />
                Explainable Decision Receipt
              </span>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground">
                All 6 Hard Constraints Cleared · 4 Soft Preferences Scored
              </span>
            </div>
            <DecisionReceiptCard top={top} caseRow={ranCase} />
          </div>

          {/* Candidates Split Grid */}
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
            <RecommendationPanel
              key={ranCase.id + top.key}
              caseRow={ranCase}
              top={top}
              alternatives={alternatives}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-4 text-muted-foreground" />
                  Alternative Scheduling Options
                </h2>
                <Badge variant="outline" className="text-xs font-mono">
                  {alternatives.length} Option{alternatives.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {alternatives.length === 0 ? (
                <Card className="border-dashed p-6 text-center text-xs text-muted-foreground">
                  No other valid combinations met all hard constraints.
                </Card>
              ) : (
                alternatives.map((c, i) => (
                  <CandidateCard key={c.key} candidate={c} caseRow={ranCase} rank={i + 2} />
                ))
              )}
            </div>
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
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const permissions = permissionsFor(staff.data?.role);
  const canDecide = permissions.canSchedule;

  async function handleSelectAlternative() {
    if (!staff.data) {
      toast.error("You must be signed in to record a decision.");
      return;
    }
    if (!canDecide) {
      toast.error("Your role does not permit scheduling decisions.");
      return;
    }

    setBusy(true);
    try {
      await recordDecision({
        caseRow,
        candidate,
        action: "modified",
        userId: staff.data.id,
      });
      setConfirmed(true);
      toast.success(
        `Alternative Option ${rank ?? ""} selected and scheduled with ${candidate.judge.name}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-engine-data"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
    } catch (error) {
      if (error instanceof ConflictError) {
        toast.error("Blocked — this alternative clashes with a live constraint.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not schedule alternative.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "shadow-panel transition-all hover:border-primary/40",
        recommended && "border-primary/40",
        confirmed && "border-primary bg-primary/[0.02]",
      )}
    >
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          {recommended ? (
            <Badge className="mb-2">Scheduling recommendation · top ranked</Badge>
          ) : (
            <Badge variant="secondary" className="mb-2 text-xs">
              Alternative Option {rank}
            </Badge>
          )}
          <CardTitle className="text-base">{candidate.judge.name}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {candidate.courtroom.name} · {formatSlotLabel(candidate.slot)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground tabular-nums">{candidate.score}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">fit score / 100</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <ConfidenceBar
          value={candidate.confidence}
          hint="Soft preferences match score plus 15% flat bonus for clearing all hard constraints."
        />
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          ✓ Hard constraints passed — {candidate.judge.name} & {candidate.courtroom.name} free; {caseRow.estimated_duration_minutes} min fits the {slotMinutes(candidate.slot)} min slot.
        </div>
        <div className="space-y-2.5">
          {candidate.factors.map((f) => (
            <div key={f.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-foreground font-medium">{f.label}</span>
                <span className="text-muted-foreground font-mono">
                  +{f.points} / {f.weight}
                </span>
              </div>
              <Progress value={(f.points / f.weight) * 100} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground leading-snug">{f.detail}</p>
            </div>
          ))}
        </div>
        <ReasoningList
          candidate={candidate}
          caseRow={caseRow}
          heading="Reasoning Breakdown"
          compact
          className="border-t border-border pt-3"
        />

        {/* Direct Action Button to Select This Alternative */}
        {!recommended && (
          <div className="border-t border-border pt-3">
            {confirmed ? (
              <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary">
                <CheckCircle2 className="size-4 shrink-0" />
                Scheduled with this alternative option!
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={handleSelectAlternative}
                disabled={busy || !canDecide}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {busy ? "Scheduling Alternative…" : `Select & Schedule Option ${rank ?? ""}`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
