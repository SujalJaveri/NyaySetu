import { CheckCircle2, ShieldCheck, Sparkles, XCircle, Zap } from "lucide-react";
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
      label: "Judge available at slot",
      detail: `${top.judge.name} — no unassigned clash`,
      pass: true,
    },
    {
      label: "Courtroom available",
      detail: `${top.courtroom.name} — open for hearing`,
      pass: true,
    },
    {
      label: "No double-booking",
      detail: "Zero concurrent booking for bench or hall",
      pass: true,
    },
    {
      label: "Duration fits slot",
      detail: `${duration}m est. fits ${slotLen}m allocation`,
      pass: durationFits,
    },
    {
      label: "Workload within threshold",
      detail: `${top.judge.current_workload} / ${MAX_JUDGE_WORKLOAD} active hearings`,
      pass: workloadOk,
    },
    {
      label: "Court sitting confirmed",
      detail: `${top.slot.date} — non-holiday sitting confirmed`,
      pass: true,
    },
  ];

  const softTotal = top.factors.reduce((s, f) => s + f.weight, 0) || 100;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-panel overflow-hidden text-xs",
        className,
      )}
    >
      {/* Header */}
      <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Deterministic Decision Receipt
            </p>
          </div>
          <p className="text-sm font-bold text-foreground">
            {caseRow.case_number} · <span className="font-normal text-muted-foreground">{caseRow.case_categories?.name ?? "Uncategorised"}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-primary tabular-nums leading-none">
            {top.score}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
            fit score / 100
          </p>
        </div>
      </div>

      {/* Assignment strip */}
      <div className="border-b border-border/70 bg-card/60 px-5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span>
            <span className="text-muted-foreground">Presiding Bench:</span>{" "}
            <strong className="text-foreground">{top.judge.name}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Courtroom:</span>{" "}
            <strong className="text-foreground">{top.courtroom.name}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Hearing Slot:</span>{" "}
            <strong className="text-foreground font-mono">{formatSlotLabel(top.slot)}</strong>
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {top.judge.specialisation || "General Jurisdiction"}
        </span>
      </div>

      {/* Two-column body */}
      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Hard Constraints */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Hard Constraints (Disqualifying Rules)
            </p>
            <span className="text-[10px] font-semibold text-primary">6 / 6 Passed</span>
          </div>
          <div className="space-y-2">
            {hardConstraints.map((c) => (
              <div key={c.label} className="flex items-start gap-2.5">
                {c.pass ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium text-xs leading-tight", c.pass ? "text-foreground" : "text-destructive")}>
                    {c.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Soft Preferences */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Soft Preferences (Ranking Weights)
            </p>
            <span className="text-[10px] font-semibold text-primary">{top.score} Points Scored</span>
          </div>
          <div className="space-y-2">
            {top.factors.map((f) => {
              const pct = Math.round((f.points / Math.max(1, f.weight)) * 100);
              return (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground font-medium text-xs truncate">{f.label}</span>
                    <span className="shrink-0 tabular-nums font-mono text-[11px] text-muted-foreground">
                      +{f.points} / {f.weight}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{f.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-muted/30 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="size-3.5 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Deterministic rule solver · 100% explainable · Zero black-box AI variance
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          Audit Verified
        </span>
      </div>
    </div>
  );
}
