import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Pencil, Sparkles, UserCheck, X } from "lucide-react";
import { explainSchedulingRecommendation } from "@/lib/explain-candidate.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCurrentStaff, permissionsFor, roleLabel } from "@/hooks/use-current-staff";
import { ReasoningList } from "@/components/reasoning-list";
import { ConfidenceBar } from "@/components/confidence-bar";
import { PermissionNotice } from "@/components/states";
import { NotifyPartiesPanel } from "@/components/notify-parties-panel";

import type { CaseRow } from "@/lib/cases";
import { formatSlotLabel, slotMinutes, type Candidate } from "@/lib/scheduling";
import { ConflictError, recordDecision, type DecisionAction } from "@/lib/recommendations";
import type { Conflict } from "@/lib/conflicts";

export function RecommendationPanel({
  caseRow,
  top,
  alternatives,
}: {
  caseRow: CaseRow;
  top: Candidate;
  alternatives: Candidate[];
}) {
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const explainFn = useServerFn(explainSchedulingRecommendation);
  const [picking, setPicking] = useState(false);
  const [pickedKey, setPickedKey] = useState(alternatives[0]?.key ?? "");
  const [busy, setBusy] = useState<DecisionAction | null>(null);
  const [outcome, setOutcome] = useState<{ action: DecisionAction; candidate: Candidate } | null>(
    null,
  );
  const [blocked, setBlocked] = useState<Conflict[]>([]);

  const permissions = permissionsFor(staff.data?.role);
  const canDecide = permissions.canSchedule;

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  async function handleAiExplain() {
    setLoadingAi(true);
    setAiExplanation(null);
    try {
      const res = await explainFn({
        data: {
          caseNumber: caseRow.case_number,
          parties: caseRow.parties,
          estimatedDuration: caseRow.estimated_duration_minutes,
          priorityScore: caseRow.priority_score,
          topCandidate: top,
          alternatives: alternatives,
        },
      });
      setAiExplanation(res.explanation);
    } catch (e) {
      toast.error("Could not fetch AI explanation.");
    } finally {
      setLoadingAi(false);
    }
  }

  async function decide(action: DecisionAction, candidate: Candidate) {
    if (!staff.data) {
      toast.error("You must be signed in to record a decision.");
      return;
    }
    if (!canDecide) {
      toast.error("Your role does not permit scheduling decisions.");
      return;
    }
    setBusy(action);
    setBlocked([]);
    try {
      await recordDecision({ caseRow, candidate, action, userId: staff.data.id });
      setOutcome({ action, candidate });
      setPicking(false);
      toast.success(
        action === "accepted"
          ? "Recommendation accepted and scheduled."
          : action === "modified"
            ? "Alternative selected and scheduled."
            : "Recommendation rejected — logged for audit.",
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "registry"] });
      queryClient.invalidateQueries({ queryKey: ["scheduling-engine-data"] });
    } catch (error) {
      if (error instanceof ConflictError) {
        setBlocked(error.conflicts);
        toast.error("Blocked — this assignment violates a hard constraint.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not record the decision.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      className={cn("registry-enter shadow-panel", outcome ? "border-border" : "border-primary/40")}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge className="mb-2">Scheduling recommendation · top ranked</Badge>
            <CardTitle className="text-base">{top.judge.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {top.courtroom.name} · {formatSlotLabel(top.slot)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-foreground">{top.score}</p>
            <p className="text-xs text-muted-foreground">fit score / 100</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <UserCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <strong className="font-medium text-foreground">Decision support only.</strong> This is
            a suggestion from a deterministic rules engine. Nothing is scheduled until a registrar
            or administrator accepts, modifies or rejects it; the final call remains with the
            registry.
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* AI Explain Recommendation */}
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-gold animate-pulse" />
              AI Decision Support
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2.5"
              onClick={handleAiExplain}
              disabled={loadingAi}
            >
              {loadingAi ? (
                <>
                  <Loader2 className="size-3 animate-spin mr-1" />
                  Analyzing...
                </>
              ) : aiExplanation ? (
                "Refresh analysis"
              ) : (
                "Explain recommendation"
              )}
            </Button>
          </div>
          {aiExplanation ? (
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
              {aiExplanation}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate an LLM explanation comparing this recommendation against the alternative
              options.
            </p>
          )}
        </div>

        <ConfidenceBar
          value={top.confidence}
          label="Confidence in this recommendation"
          hint="How many of the four soft preferences this sitting satisfies, on top of clearing every hard constraint."
        />
        <ReasoningList candidate={top} caseRow={caseRow} />

        <div className="space-y-3 border-t border-border pt-4">
          {top.factors.map((f) => (
            <div key={f.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{f.label}</span>
                <span className="text-muted-foreground">
                  +{f.points} / {f.weight}
                </span>
              </div>
              <Progress value={(f.points / f.weight) * 100} className="mt-1 h-1.5" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Hard constraints passed — {caseRow.estimated_duration_minutes} min fits the{" "}
            {slotMinutes(top.slot)} min slot.
          </p>
        </div>

        {outcome ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
              <p className="font-medium text-foreground">
                {outcome.action === "accepted"
                  ? "Accepted"
                  : outcome.action === "modified"
                    ? "Modified"
                    : "Rejected"}{" "}
                by {staff.data?.fullName ?? "staff"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {outcome.action === "rejected"
                  ? "No hearing was scheduled. The reasoning and your decision were stored for audit."
                  : `Scheduled with ${outcome.candidate.judge.name} in ${outcome.candidate.courtroom.name} · ${formatSlotLabel(outcome.candidate.slot)}. Recorded in the audit log.`}
              </p>
            </div>
            {outcome.action !== "rejected" && (
              <NotifyPartiesPanel caseRow={caseRow} candidate={outcome.candidate} />
            )}
          </div>
        ) : (
          <div className="space-y-3 border-t border-border pt-4">
            {blocked.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="size-4" />
                  Action blocked — hard constraint violated
                </p>
                <ul className="mt-2 space-y-1 text-sm text-destructive">
                  {blocked.map((c) => (
                    <li key={c.kind}>{c.message}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Nothing was scheduled. Free the clash, change availability, or pick another
                  option.
                </p>
              </div>
            )}
            {!canDecide && (
              <PermissionNotice
                message={`Your role (${staff.data ? roleLabel[staff.data.role] : "unknown"}) cannot accept, modify or reject a scheduling recommendation. Contact an administrator.`}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => decide("accepted", top)}
                disabled={busy !== null || !canDecide}
              >
                {busy === "accepted" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => setPicking((v) => !v)}
                disabled={busy !== null || !canDecide || alternatives.length === 0}
              >
                <Pencil className="size-4" />
                Modify
              </Button>
              <Button
                variant="outline"
                onClick={() => decide("rejected", top)}
                disabled={busy !== null || !canDecide}
              >
                {busy === "rejected" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Reject
              </Button>
            </div>

            {picking && alternatives.length > 0 && (
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Choose a different valid option
                </p>
                <RadioGroup value={pickedKey} onValueChange={setPickedKey} className="gap-2">
                  {alternatives.map((c) => (
                    <div key={c.key} className="flex items-start gap-2">
                      <RadioGroupItem value={c.key} id={c.key} className="mt-1" />
                      <Label
                        htmlFor={c.key}
                        className="cursor-pointer text-sm font-normal leading-snug"
                      >
                        <span className="text-foreground">{c.judge.name}</span>{" "}
                        <span className="text-muted-foreground">
                          · {c.courtroom.name} · {formatSlotLabel(c.slot)} · fit {c.score}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={busy !== null || !canDecide || !pickedKey}
                  onClick={() => {
                    const chosen = alternatives.find((c) => c.key === pickedKey);
                    if (chosen) decide("modified", chosen);
                  }}
                >
                  {busy === "modified" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Confirm this option
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
