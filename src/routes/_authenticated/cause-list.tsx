import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  GripVertical,
  Info,
  Layers,
  ListOrdered,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-current-staff";
import { cn } from "@/lib/utils";
import { prioritySettingsQuery } from "@/lib/priority";
import { courtroomsQuery, judgesQuery } from "@/lib/registry";
import { casesQuery, type CaseRow } from "@/lib/cases";
import { schedulingDataQuery } from "@/lib/scheduling";
import { checkCourtHoliday } from "@/lib/holidays";
import {
  runBatchCauseListOptimizer,
  STAGE_LABELS,
  type BatchOptimizationResult,
  type ProceduralStage,
} from "@/lib/batch-scheduling";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "Cause List — NyayaSetu" },
      {
        name: "description",
        content:
          "The proposed hearing order for a chosen judge or courtroom, ranked by priority tier and manually re-orderable by a registrar.",
      },
      { property: "og:title", content: "Cause List — NyayaSetu" },
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
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const settings = useQuery(prioritySettingsQuery);
  const judges = useQuery(judgesQuery);
  const courtrooms = useQuery(courtroomsQuery);
  const allCases = useQuery(casesQuery);
  const engineData = useQuery(schedulingDataQuery);
  const listing = useQuery(causeListQuery(date, settings.data ?? null));

  const holidayInfo = useMemo(() => checkCourtHoliday(date), [date]);

  const pendingCases = useMemo(() => {
    return (allCases.data ?? []).filter(
      (c) => c.status === "filed" || c.status === "adjourned",
    );
  }, [allCases.data]);

  const batchResult = useMemo(() => {
    if (!engineData.data || !batchModalOpen) return null;
    return runBatchCauseListOptimizer(pendingCases, date, engineData.data);
  }, [pendingCases, date, engineData.data, batchModalOpen]);

  const commitBatch = useMutation({
    mutationFn: async (result: BatchOptimizationResult) => {
      for (const item of result.listings) {
        const { error } = await supabase.from("schedules").upsert(
          {
            case_id: item.caseId,
            judge_id: item.judge.id,
            courtroom_id: item.courtroom.id,
            slot_id: item.slot.id,
            status: "confirmed",
            cause_list_position: item.sequenceNumber,
          },
          { onConflict: "case_id" },
        );
        if (error) throw error;

        await supabase
          .from("cases")
          .update({ status: "scheduled" })
          .eq("id", item.caseId);
      }

      await recordAudit(
        `Committed batch cause list optimization for ${date}: ${result.listings.length} hearings scheduled across ${result.benchUtilisation.length} benches`,
        `date:${date} batch:${result.listings.length}`,
      );
    },
    onSuccess: () => {
      toast.success(
        `Successfully scheduled ${batchResult?.listings.length ?? 0} cases for ${date}!`,
      );
      setBatchModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cause-list"] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
    onError: (err: Error) => {
      toast.error(`Batch optimization commit failed: ${err.message}`);
    },
  });

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
  const busy = reorder.isPending || reset.isPending || commitBatch.isPending;
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
          <div className="flex flex-wrap items-center gap-2">
            {canReorder && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={() => setBatchModalOpen(true)}
              >
                <Sparkles className="size-4 text-accent" />
                Batch Daily Optimizer
              </Button>
            )}
            {hasManual && canReorder && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => reset.mutate()}>
                <RotateCcw className="size-4" /> Restore suggested order
              </Button>
            )}
          </div>
        }
      />

      {holidayInfo.isHoliday && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-semibold">
              Non-sitting Day: {date} ({holidayInfo.holidayName || "Gazetted Court Holiday"})
            </p>
            <p className="text-xs mt-1 text-amber-800 dark:text-amber-300">
              No regular court sessions are scheduled for this date. Use the Batch Daily Optimizer
              to select an alternate working date.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-md border border-primary/25 bg-primary/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-foreground">
          This ordering is a suggestion. A registrar may reorder, and any change is logged.
        </p>
      </div>

      {/* Batch Cause List Optimizer Dialog */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <DialogTitle className="text-lg">Batch Cause List Optimizer</DialogTitle>
            </div>
            <DialogDescription>
              Predict-then-Optimize automated daily board generator for {date}.
            </DialogDescription>
          </DialogHeader>

          {batchResult ? (
            <div className="space-y-5 py-2">
              {batchResult.isHoliday ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    Cannot optimize board: {date} is a court holiday ({batchResult.holidayName}).
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="p-3 shadow-2xs">
                      <p className="text-xs text-muted-foreground font-medium">Cases Evaluated</p>
                      <p className="text-xl font-bold text-foreground mt-1">
                        {batchResult.totalCandidateCases}
                      </p>
                    </Card>
                    <Card className="p-3 shadow-2xs bg-primary/5 border-primary/20">
                      <p className="text-xs text-primary font-medium">To Schedule</p>
                      <p className="text-xl font-bold text-primary mt-1">
                        {batchResult.scheduledCount}
                      </p>
                    </Card>
                    <Card className="p-3 shadow-2xs">
                      <p className="text-xs text-muted-foreground font-medium">Procedural Stages</p>
                      <p className="text-xl font-bold text-foreground mt-1">3 Sessions</p>
                    </Card>
                    <Card className="p-3 shadow-2xs">
                      <p className="text-xs text-muted-foreground font-medium">Unassigned (Load)</p>
                      <p className="text-xl font-bold text-muted-foreground mt-1">
                        {batchResult.unassignedCount}
                      </p>
                    </Card>
                  </div>

                  {/* Staged Board Preview */}
                  <div className="space-y-4 pt-2">
                    {(
                      [
                        "morning_mentions",
                        "contested_trials",
                        "afternoon_orders",
                      ] as ProceduralStage[]
                    ).map((stageKey) => {
                      const stageItems = batchResult.listings.filter((l) => l.stage === stageKey);
                      if (stageItems.length === 0) return null;

                      return (
                        <div key={stageKey} className="rounded-lg border bg-card/60 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="size-4 text-primary" />
                              <span className="text-sm font-semibold text-foreground">
                                {STAGE_LABELS[stageKey].title}
                              </span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {STAGE_LABELS[stageKey].window}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {stageItems.length} Matter{stageItems.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {stageItems.map((item) => (
                              <div
                                key={item.caseId}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/80 p-2.5 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-foreground">
                                      #{item.sequenceNumber} {item.caseNumber}
                                    </span>
                                    {item.cnrNumber && (
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {item.cnrNumber}
                                      </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">
                                      {item.categoryName}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {item.predictedDurationMinutes}m est.
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground truncate max-w-md">
                                    {item.parties}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium text-foreground">
                                    {item.judge.name}
                                  </span>
                                  <p className="text-muted-foreground text-[11px]">
                                    {item.courtroom.name} · {item.slot.start_time.slice(0, 5)}–
                                    {item.slot.end_time.slice(0, 5)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Evaluating pending case inventory and registry constraints…
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBatchModalOpen(false)}>
              Cancel
            </Button>
            {batchResult && batchResult.scheduledCount > 0 && !batchResult.isHoliday && (
              <Button
                variant="default"
                disabled={commitBatch.isPending}
                onClick={() => commitBatch.mutate(batchResult)}
                className="gap-1.5"
              >
                <CheckCircle2 className="size-4" />
                Commit {batchResult.scheduledCount} Hearings to Daily Board
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
