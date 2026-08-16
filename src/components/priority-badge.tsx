import { cn } from "@/lib/utils";
import { priorityBand } from "@/lib/cases";

const styles: Record<string, string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-accent/40 bg-accent text-accent-foreground",
  low: "border-border bg-muted text-muted-foreground",
  pending: "border-dashed border-border bg-transparent text-muted-foreground",
};

export function PriorityBadge({ score }: { score: number | null }) {
  const band = priorityBand(score);
  const label =
    band === "pending"
      ? "Pending calculation"
      : `${band.charAt(0).toUpperCase()}${band.slice(1)} · ${Math.round(score ?? 0)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[band],
      )}
    >
      {label}
    </span>
  );
}
