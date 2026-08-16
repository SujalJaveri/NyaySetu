import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MAX_JUDGE_WORKLOAD } from "@/lib/registry";

export function WorkloadMeter({ value }: { value: number }) {
  const pct = Math.min(100, Math.round((value / MAX_JUDGE_WORKLOAD) * 100));
  const tone = pct >= 90 ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="w-40">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={tone}>
          {value} / {MAX_JUDGE_WORKLOAD}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

export function AllocationBadge({ bookings }: { bookings: number }) {
  if (bookings === 0) return <Badge variant="secondary">Available</Badge>;
  return <Badge>{bookings} booked</Badge>;
}
