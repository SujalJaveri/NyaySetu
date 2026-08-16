import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarOff,
  CheckCircle2,
  FlaskConical,
  Gavel,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { ReasoningList } from "@/components/reasoning-list";
import { ErrorState, PermissionNotice } from "@/components/states";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { casesQuery, formatDate } from "@/lib/cases";
import { useCurrentStaff, permissionsFor, roleLabel } from "@/hooks/use-current-staff";
import { formatSlotLabel, schedulingDataQuery } from "@/lib/scheduling";
import { recordAudit } from "@/lib/audit";
import { applySimulation, simulateJudgeUnavailable, type SimulationResult } from "@/lib/simulation";

export const Route = createFileRoute("/_authenticated/what-if-simulation")({
  head: () => ({
    meta: [
      { title: "What-If Simulation — NyaySetu" },
      {
        name: "description",
        content:
          "Model a judge's unavailability and preview every affected hearing before committing any change.",
      },
      { property: "og:title", content: "What-If Simulation — NyaySetu" },
      {
        property: "og:description",
        content:
          "Model a judge's unavailability and preview every affected hearing before committing any change.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const STEPS = [
  { key: "scope", label: "Applying simulated condition", icon: FlaskConical },
  { key: "impact", label: "Tracing affected hearings", icon: CalendarOff },
  { key: "availability", label: "Re-checking judge & courtroom availability", icon: Gavel },
  { key: "conflicts", label: "Re-checking conflicts and duration fit", icon: Timer },
] as const;

function Page() {
  const staff = useCurrentStaff();
  const cases = useQuery(casesQuery);
  const engineData = useQuery(schedulingDataQuery);
  const queryClient = useQueryClient();

  const [judgeId, setJudgeId] = useState("");
  const [date, setDate] = useState("");
  const [step, setStep] = useState(-1);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const judges = engineData.data?.judges ?? [];
  const running = step >= 0 && step < STEPS.length;
  const canApply = permissionsFor(staff.data?.role).canSchedule;

  /** Dates on which the selected judge currently has active hearings — handy shortcuts. */
  const judgeDates = useMemo(() => {
    if (!engineData.data || !judgeId) return [] as string[];
    const set = new Set<string>();
    for (const s of engineData.data.schedules) {
      if (
        (s.status === "proposed" || s.status === "confirmed") &&
        s.judge_id === judgeId &&
        s.hearing_slots
      ) {
        set.add(s.hearing_slots.date);
      }
    }
    return [...set].sort();
  }, [engineData.data, judgeId]);

  function discard() {
    timers.current.forEach(clearTimeout);
    setStep(-1);
    setResult(null);
    setChoices({});
    setApplied(null);
  }

  function run() {
    if (!judgeId || !date || !engineData.data || !cases.data) return;
    timers.current.forEach(clearTimeout);
    setResult(null);
    setChoices({});
    setApplied(null);
    setStep(0);
    // Purely presentational pacing — the simulation itself is synchronous and in-memory.
    timers.current = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), 480 * (i + 1)));
    timers.current.push(
      setTimeout(() => {
        const sim = simulateJudgeUnavailable({
          judgeId,
          date,
          data: engineData.data!,
          cases: cases.data!,
        });
        setResult(sim);
        // Records the run so an unapplied simulation surfaces in notifications.
        if (sim) {
          void recordAudit(
            `Ran What-If Simulation — ${sim.judge.name} marked unavailable on ${sim.date}; ${sim.affected.length} hearing(s) affected`,
            `judge:${sim.judge.id} date:${sim.date}`,
          );
        }
        setChoices(
          Object.fromEntries(
            (sim?.affected ?? [])
              .map((a) => [a.scheduleId, a.alternatives[0]?.key] as const)
              .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
          ),
        );
      }, 480 * STEPS.length),
    );
  }

  async function apply() {
    if (!result || !engineData.data || !staff.data) return;
    if (!canApply) {
      toast.error("Your role does not permit committing schedule changes.");
      return;
    }
    setApplying(true);
    try {
      const { reassigned } = await applySimulation({
        result,
        choices,
        slots: engineData.data.slots,
        userId: staff.data.id,
      });
      setApplied(reassigned);
      toast.success(`What-If Simulation applied — ${reassigned} hearing(s) reassigned`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply the What-If Simulation",
      );
    } finally {
      setApplying(false);
    }
  }

  const chosenCount = result ? result.affected.filter((a) => choices[a.scheduleId]).length : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Planning"
        title="What-If Simulation"
        description="Model a change to court conditions and see its full knock-on effect. Nothing is written to the live cause list until you press Apply Changes."
      />

      {(cases.isError || engineData.isError) && (
        <ErrorState
          title="Could not load What-If Simulation data"
          error={cases.error ?? engineData.error}
          onRetry={() => {
            void cases.refetch();
            void engineData.refetch();
          }}
          retrying={cases.isFetching || engineData.isFetching}
        />
      )}

      <Card className="mt-8 shadow-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4 text-primary" />
            Scenario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value="judge-unavailable" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="judge-unavailable">
                    Mark a judge unavailable on a specific date
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Courtroom unavailability will be added as a second condition.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-judge">Judge</Label>
              <Select
                value={judgeId}
                onValueChange={(v) => {
                  setJudgeId(v);
                  discard();
                }}
              >
                <SelectTrigger id="sim-judge">
                  <SelectValue placeholder="Select a judge" />
                </SelectTrigger>
                <SelectContent>
                  {judges.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name} · {j.specialisation || "General"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sim-date">Unavailable on</Label>
              <Input
                id="sim-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  discard();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Dates with sittings</Label>
              <div className="flex flex-wrap gap-2">
                {judgeDates.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {judgeId
                      ? "This judge has no active hearings scheduled."
                      : "Select a judge to see their sitting dates."}
                  </p>
                )}
                {judgeDates.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={date === d ? "default" : "outline"}
                    onClick={() => {
                      setDate(d);
                      discard();
                    }}
                  >
                    {formatDate(d)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={run}
              disabled={!judgeId || !date || running || engineData.isLoading || cases.isLoading}
            >
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              Run What-If Simulation
            </Button>
            {(result || running) && (
              <Button variant="outline" onClick={discard}>
                <RotateCcw className="size-4" />
                Discard Simulation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {step >= 0 && (
        <Card className="mt-6 shadow-panel">
          <CardContent className="space-y-3 py-5">
            {STEPS.map((s, i) => {
              const done = step > i;
              const active = step === i;
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-all duration-300",
                    done && "border-primary/30 bg-primary/5 text-foreground",
                    active && "border-primary bg-primary/10 text-foreground shadow-sm",
                    !done && !active && "border-border text-muted-foreground opacity-60",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                  <span>{s.label}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <Card className="border-primary/40 shadow-panel">
            <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-eyebrow mb-1">Impact summary — simulated only</p>
                <p className="text-lg font-semibold text-foreground">
                  {result.affected.length} hearing{result.affected.length === 1 ? "" : "s"}{" "}
                  affected, {result.totalAlternatives} alternative
                  {result.totalAlternatives === 1 ? "" : "s"} found
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.judge.name} marked unavailable on {formatDate(result.date)}.{" "}
                  {result.unresolved > 0
                    ? `${result.unresolved} hearing(s) have no valid alternative under the current constraints.`
                    : "Every affected hearing has at least one valid alternative."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={apply}
                  disabled={applying || !canApply || chosenCount === 0 || applied !== null}
                >
                  {applying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Apply changes
                </Button>
                <Button variant="outline" onClick={discard} disabled={applying}>
                  <RotateCcw className="size-4" />
                  Discard Simulation
                </Button>
              </div>
            </CardContent>
          </Card>

          {!canApply && (
            <PermissionNotice
              message={`Your role (${staff.data ? roleLabel[staff.data.role] : "unknown"}) can review this What-If Simulation but cannot commit reassignments.`}
            />
          )}

          {applied !== null && (
            <div className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 text-primary" />
              <p>
                What-If Simulation committed — {result.judge.name} is now marked unavailable on{" "}
                {formatDate(result.date)} and {applied} hearing{applied === 1 ? " was" : "s were"}{" "}
                reassigned.
              </p>
            </div>
          )}

          {result.affected.length === 0 && (
            <Card className="shadow-panel">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No active hearings sit before {result.judge.name} on {formatDate(result.date)} —
                this change would have no impact on the cause list.
              </CardContent>
            </Card>
          )}

          {result.affected.map((hearing) => (
            <Card key={hearing.scheduleId} className="shadow-panel">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{hearing.caseRow.case_number}</CardTitle>
                  <PriorityBadge score={hearing.caseRow.priority_score} />
                  <Badge variant="outline">
                    {hearing.caseRow.case_categories?.name ?? "Uncategorised"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Currently {formatSlotLabel(hearing.slot)} · {hearing.judge.name} ·{" "}
                  {hearing.courtroom?.name ?? "No courtroom"} ·{" "}
                  {hearing.caseRow.estimated_duration_minutes} min
                </p>
              </CardHeader>
              <Separator />
              <CardContent className="pt-5">
                {hearing.alternatives.length === 0 ? (
                  <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                    <p>
                      No valid alternative found — every other judge, courtroom and slot combination
                      fails at least one hard constraint. This hearing would need to be adjourned.
                    </p>
                  </div>
                ) : (
                  <RadioGroup
                    value={choices[hearing.scheduleId] ?? ""}
                    onValueChange={(v) =>
                      setChoices((prev) => ({ ...prev, [hearing.scheduleId]: v }))
                    }
                    className="space-y-3"
                  >
                    {hearing.alternatives.map((candidate, index) => (
                      <label
                        key={candidate.key}
                        htmlFor={`${hearing.scheduleId}-${candidate.key}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors",
                          choices[hearing.scheduleId] === candidate.key
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <RadioGroupItem
                          id={`${hearing.scheduleId}-${candidate.key}`}
                          value={candidate.key}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {index === 0 ? "Best alternative" : `Alternative ${index + 1}`}
                            </span>
                            <Badge variant="secondary">Fit {candidate.score}/100</Badge>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Gavel className="size-3.5" /> {candidate.judge.name}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3.5" /> {candidate.courtroom.name}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Timer className="size-3.5" /> {formatSlotLabel(candidate.slot)}
                            </span>
                          </p>
                          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {candidate.factors.map((f) => (
                              <span key={f.key}>
                                {f.label}: <span className="text-foreground">+{f.points}</span>
                              </span>
                            ))}
                          </p>
                          <ReasoningList
                            candidate={candidate}
                            caseRow={hearing.caseRow}
                            heading="Reasoning"
                            compact
                            className="mt-3 border-t border-border pt-3"
                          />
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </CardContent>
            </Card>
          ))}

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Simulated results are held in memory only. Apply Changes commits the unavailability and
            the selected reassignments; Discard Simulation leaves the live schedule untouched.
          </p>
        </div>
      )}
    </div>
  );
}
