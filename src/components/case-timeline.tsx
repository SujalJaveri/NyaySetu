import { Check, CircleDot, Minus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimelineState, TimelineStep } from "@/lib/case-timeline";

const dotClass: Record<TimelineState, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  current: "border-accent bg-accent text-accent-foreground ring-4 ring-accent/20",
  pending: "border-border bg-muted text-muted-foreground",
  skipped: "border-dashed border-border bg-background text-muted-foreground",
};

const labelClass: Record<TimelineState, string> = {
  done: "text-foreground",
  current: "text-foreground font-semibold",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
};

function StepIcon({ state }: { state: TimelineState }) {
  if (state === "done") return <Check className="size-4" />;
  if (state === "current") return <CircleDot className="size-4" />;
  if (state === "skipped") return <Minus className="size-3.5" />;
  return <span className="size-1.5 rounded-full bg-current" />;
}

export function CaseTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Case status timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Derived from this case's own records — its listings, adjournments and current register
          status.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-6 sm:flex-row sm:gap-0">
          {steps.map((step, index) => (
            <li key={step.key} className="relative flex flex-1 gap-3 sm:flex-col sm:gap-3">
              {/* connector */}
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%+0.75rem)] w-px sm:left-auto sm:top-[15px] sm:h-px sm:w-full sm:translate-x-4",
                    steps[index + 1]?.state === "done" || steps[index + 1]?.state === "current"
                      ? "bg-primary"
                      : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border",
                  dotClass[step.state],
                )}
                aria-hidden
              >
                <StepIcon state={step.state} />
              </span>
              <div className="sm:pr-6">
                <p className={cn("text-sm", labelClass[step.state])}>
                  {step.label}
                  {step.state === "current" && (
                    <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                      Current
                    </span>
                  )}
                  {step.state === "skipped" && (
                    <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                      Not applicable
                    </span>
                  )}
                </p>
                {step.timestamp && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.timestamp}</p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
