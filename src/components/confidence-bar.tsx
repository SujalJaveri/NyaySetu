import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Deterministic confidence readout for a single recommendation.
 * Value is produced by the scheduling engine (hard-constraint clearance + soft-preference fit).
 */
export function ConfidenceBar({
  value,
  label = "Confidence",
  hint,
  className,
}: {
  value: number;
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(value)}%</span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} className="h-2" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
