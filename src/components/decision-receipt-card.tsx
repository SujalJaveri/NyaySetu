/**
 * DecisionReceiptCard
 *
 * Renders a styled "audit ticket" for the top scheduling recommendation.
 * Shows every hard constraint that was checked (all must pass) and every
 * soft preference that was scored (used only for ranking).
 *
 * Design intent: this should feel like a receipt / official decision document —
 * transparent, machine-readable, audit-ready.
 */
import { CheckCircle2, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseRow } from "@/lib/cases";
import { formatSlotLabel, slotMinutes, type Candidate } from "@/lib/scheduling";
import { MAX_JUDGE_WORKLOAD } from "@/lib/registry";

export function DecisionReceiptCard({
  top,
  caseRow,
  className,
}: {
  top: Candidate;
  caseRow: CaseRow;
  className?: string;
}) {
  const slotLen = slotMinutes(top.slot);
  const duration = caseRow.estimated_duration_minutes ?? 60;
  const durationFits = duration <= slotLen;
  const workloadOk = top.judge.current_workload < MAX_JUDGE_WORKLOAD;

  const hardConstraints = [
    {
      label: "Judge available at this slot",
      detail: `${top.judge.name} — no unavailability record`,
      pass: true,
    },
    {
      label: "Courtroom available",
      detail: `${top.courtroom.name} — not marked closed`,
      pass: true,
    },
    {
      label: "No double-booking",
      detail: "Neither judge nor courtroom has an overlapping hearing",
      pass: true,
    },
    {
      label: "Hearing duration fits slot",
      detail: `${duration} min hearing fits the ${slotLen} min slot`,
      pass: durationFits,
    },
    {
      label: "Judge workload within threshold",
      detail: `${top.judge.current_workload} / ${MAX_JUDGE_WORKLOAD} active hearings`,
      pass: workloadOk,
    },
    {
      label: "Not a court holiday",
      detail: `${top.slot.date} — court sitting day confirmed`,
      pass: true,
    },
  ];

  const softTotal = top.factors.reduce((s, f) => s + f.weight, 0) || 100;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-panel overflow-hidden font-mono text-xs",
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            NyayaSetu · Scheduling Decision
          </p>
          <p className="mt-0.5 text-sm font-bold text-foreground">
            {caseRow.case_number}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-primary tabular-nums leading-none">
            {top.score}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            fit score / 100
          </p>
        </div>
      </div>

      {/* Assignment line */}
      <div className="border-b border-dashed border-border px-4 py-2.5 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-foreground font-semibold">Judge:</span>{" "}
          {top.judge.name}
        </span>
        <span>
          <span className="text-foreground font-semibold">Courtroom:</span>{" "}
          {top.courtroom.name}
        </span>
        <span>
          <span className="text-foreground font-semibold">Slot:</span>{" "}
          {formatSlotLabel(top.slot)}
        </span>
      </div>

      {/* Two-column body */}
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Hard Constraints */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Hard Constraints (all must pass)
          </p>
          {hardConstraints.map((c) => (
            <div key={c.label} className="flex items-start gap-2">
              {c.pass ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className={cn("font-semibold", c.pass ? "text-foreground" : "text-destructive")}>
                  {c.label}
                </p>
                <p className="text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Soft Preferences */}
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Soft Preferences (ranking only)
          </p>
          {top.factors.map((f) => {
            const pct = Math.round((f.points / Math.max(1, f.weight)) * 100);
            return (
              <div key={f.key} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-foreground font-semibold truncate">{f.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    +{f.points} / {f.weight}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-muted-foreground leading-snug">{f.detail}</p>
              </div>
            );
          })}
          <div className="pt-2 border-t border-border flex items-baseline justify-between">
            <span className="text-foreground font-bold">Total fit score</span>
            <span className="tabular-nums font-bold text-primary">
              {top.score} / {softTotal}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center gap-2">
        <Zap className="size-3 text-primary shrink-0" />
        <p className="text-[10px] text-muted-foreground">
          Deterministic rules engine · No AI randomness · Same inputs always produce same output
        </p>
      </div>
    </div>
  );
}
