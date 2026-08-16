import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Info, ListOrdered, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-current-staff";
import { cn } from "@/lib/utils";
import { prioritySettingsQuery } from "@/lib/priority";
import { courtroomsQuery, judgesQuery } from "@/lib/registry";
import {
  causeListQuery,
  formatSlotTime,
  moveEntry,
  orderEntries,
  persistManualOrder,
  resetManualOrder,
  type CauseListEntry,
} from "@/lib/cause-list";

export const Route = createFileRoute("/_authenticated/cause-list")({
  head: () => ({
    meta: [
      { title: "Cause List — NyaySetu" },
      {
        name: "description",
        content:
          "The proposed hearing order for a chosen judge or courtroom, ranked by priority tier and manually re-orderable by a registrar.",
      },
      { property: "og:title", content: "Cause List — NyaySetu" },
      {
        property: "og:description",
        content:
          "The proposed hearing order for a chosen judge or courtroom, ranked by priority tier and manually re-orderable by a registrar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const today = () => new Date().toISOString().slice(0, 10);

const tierStyles: Record<string, string> = {
  "Tier 1": "border-destructive/30 bg-destructive/10 text-destructive",
  "Tier 2": "border-accent/40 bg-accent text-accent-foreground",
  "Tier 3": "border-border bg-muted text-muted-foreground",
};

function Page() {
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<string>("all");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const settings = useQuery(prioritySettingsQuery);
  const judges = useQuery(judgesQuery);
  const courtrooms = useQuery(courtroomsQuery);
  const listing = useQuery(causeListQuery(date, settings.data ?? null));

  const scopeLabel = useMemo(() => {
    if (scope === "all") return "All benches and courtrooms";
    const [kind, id] = scope.split(":");
    if (kind === "judge") return judges.data?.find((j) => j.id === id)?.name ?? "Judge";
    return courtrooms.data?.find((c) => c.id === id)?.name ?? "Courtroom";
  }, [scope, judges.data, courtrooms.data]);

  const entries = useMemo(() => {
    const rows = (listing.data ?? []).filter((e) => {
      if (scope === "all") return true;
      const [kind, id] = scope.split(":");
      return kind === "judge" ? e.judgeId === id : e.courtroomId === id;
    });
    return orderEntries(rows);
  }, [listing.data, scope]);

  const reorder = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      const next = moveEntry(entries, from, to);
      const moved = entries[from]!;
      await persistManualOrder(
        next,
        { entry: moved, fromPosition: from + 1, toPosition: to + 1 },
        scopeLabel,
        date,
      );
      return moved;
    },
    onSuccess: (moved) => {
      toast.success(`${moved.caseNumber} reordered — the change has been logged.`);
      queryClient.invalidateQueries({ queryKey: ["cause-list"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: () => toast.error("Could not save the new order. Nothing was changed."),
  });

  const reset = useMutation({
    mutationFn: () => resetManualOrder(entries, scopeLabel, date),
    onSuccess: () => {
      toast.success("Manual order cleared — the suggested order has been restored.");
      queryClient.invalidateQueries({ queryKey: ["cause-list"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: () => toast.error("Could not clear the manual order."),
  });

  const canReorder = permissions.canSchedule;
  const busy = reorder.isPending || reset.isPending;
  const hasManual = entries.some((e) => e.position !== null);

  function onDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    reorder.mutate({ from: dragIndex, to: index });
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Daily listing"
        title="Cause list"
        description="The proposed hearing order for the selected date, ranked by priority tier and score."
        actions={
          hasManual && canReorder ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => reset.mutate()}>
              <RotateCcw className="size-4" /> Restore suggested order
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6 flex items-start gap-3 rounded-md border border-primary/25 bg-primary/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-foreground">
          This ordering is a suggestion. A registrar may reorder, and any change is logged.
        </p>
      </div>

      <Card className="mt-6">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cause-date">Hearing date</Label>
            <Input
              id="cause-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bench or courtroom</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue placeholder="All benches and courtrooms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All benches and courtrooms</SelectItem>
                {(judges.data ?? []).map((j) => (
                  <SelectItem key={j.id} value={`judge:${j.id}`}>
                    Judge · {j.name}
                  </SelectItem>
                ))}
                {(courtrooms.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={`courtroom:${c.id}`}>
                    Courtroom · {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {listing.isError || settings.isError ? (
        <ErrorState onRetry={() => listing.refetch()} />
      ) : listing.isLoading || settings.isLoading ? (
        <LoadingState label="Building the cause list…" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="No listings for this selection"
          description="Nothing is listed for the chosen date and bench. Schedule a case or pick another date."
        />
      ) : (
        <ol className="mt-6 space-y-2">
          {entries.map((entry, index) => (
            <CauseListRow
              key={entry.scheduleId}
              entry={entry}
              index={index}
              draggable={canReorder && !busy}
              isDragging={dragIndex === index}
              isOver={overIndex === index && dragIndex !== index}
              onDragStart={() => setDragIndex(index)}
              onDragOver={() => setOverIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDrop={() => onDrop(index)}
              onMove={(dir) => reorder.mutate({ from: index, to: index + dir })}
              canMoveUp={index > 0}
              canMoveDown={index < entries.length - 1}
            />
          ))}
        </ol>
      )}

      {!canReorder && entries.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Your role can view this cause list but not reorder it.
        </p>
      )}
    </div>
  );
}

function CauseListRow({
  entry,
  index,
  draggable,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  entry: CauseListEntry;
  index: number;
  draggable: boolean;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (dir: 1 | -1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "flex items-start gap-3 rounded-md border border-border bg-card p-4 transition-colors",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <GripVertical
        className={cn(
          "mt-0.5 size-4 shrink-0",
          draggable ? "text-muted-foreground" : "text-border",
        )}
      />
      <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{entry.caseNumber}</span>
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium",
              tierStyles[entry.tier],
            )}
          >
            {entry.tier} · {entry.score}
          </span>
          {entry.position !== null && <Badge variant="outline">Manually placed</Badge>}
          <span className="text-xs text-muted-foreground">
            {formatSlotTime(entry.startTime)}–{formatSlotTime(entry.endTime)} · {entry.judgeName} ·{" "}
            {entry.courtroomName}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{entry.reason}</p>
      </div>
      {draggable && (
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
        </div>
      )}
    </li>
  );
}
