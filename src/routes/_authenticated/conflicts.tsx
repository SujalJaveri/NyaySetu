import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  conflictDataQuery,
  conflictLabel,
  scanSystemConflicts,
  type ConflictKind,
} from "@/lib/conflicts";

export const Route = createFileRoute("/_authenticated/conflicts")({
  head: () => ({
    meta: [
      { title: "Conflicts — NyaySetu" },
      {
        name: "description",
        content:
          "Every double-booking, unavailability clash and workload breach currently flagged across the registry.",
      },
      { property: "og:title", content: "Conflicts — NyaySetu" },
      {
        property: "og:description",
        content:
          "Every double-booking, unavailability clash and workload breach currently flagged across the registry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const KINDS: ConflictKind[] = [
  "judge_booked",
  "courtroom_booked",
  "judge_unavailable",
  "courtroom_unavailable",
  "slot_occupied",
  "duration_overflow",
  "workload_exceeded",
];

function Page() {
  const data = useQuery(conflictDataQuery);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("all");

  const conflicts = useMemo(() => (data.data ? scanSystemConflicts(data.data) : []), [data.data]);

  const filtered = conflicts.filter((c) => {
    if (kind !== "all" && c.kind !== kind) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.message, c.caseNumber, c.judgeName, c.courtroomName, c.slotLabel]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const counts = KINDS.map((k) => ({
    kind: k,
    count: conflicts.filter((c) => c.kind === k).length,
  })).filter((c) => c.count > 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Quality control"
        title="Conflict Detection"
        description="Every hard-constraint violation currently present in the registry, detected by the same deterministic rules the scheduling engine uses."
        actions={
          <Button variant="outline" onClick={() => data.refetch()} disabled={data.isFetching}>
            <RefreshCw className={cn("size-4", data.isFetching && "animate-spin")} />
            Re-scan
          </Button>
        }
      />

      {data.isError ? (
        <ErrorState
          title="Could not run conflict detection"
          error={data.error}
          onRetry={() => void data.refetch()}
          retrying={data.isFetching}
        />
      ) : data.isLoading ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card className="shadow-panel">
              <CardContent className="py-4">
                <p className="text-eyebrow">Total flagged</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{conflicts.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-panel">
              <CardContent className="py-4">
                <p className="text-eyebrow">Blocking</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {conflicts.filter((c) => c.severity === "blocking").length}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-panel">
              <CardContent className="py-4">
                <p className="text-eyebrow">Active schedules scanned</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {
                    (data.data?.schedules ?? []).filter(
                      (s) => s.status === "proposed" || s.status === "confirmed",
                    ).length
                  }
                </p>
              </CardContent>
            </Card>
          </div>

          {counts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {counts.map((c) => (
                <Badge key={c.kind} variant="secondary">
                  {conflictLabel[c.kind]} · {c.count}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Search by case, judge, courtroom or slot…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-sm"
            />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All conflict types</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {conflictLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {conflicts.length === 0 ? (
            <Card className="mt-6 shadow-panel">
              <CardContent className="py-14 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <ShieldCheck className="size-5" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-foreground">
                  No conflicts detected
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Every active schedule passes all hard constraints: availability, double-booking,
                  slot allocation, duration fit and judge workload.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 space-y-3">
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No conflicts match this filter.
                </p>
              )}
              {filtered.map((c, i) => (
                <Card
                  key={`${c.scheduleId}-${c.kind}-${i}`}
                  className={cn(
                    "shadow-panel",
                    c.severity === "blocking" ? "border-destructive/40" : "border-border",
                  )}
                >
                  <CardContent className="flex items-start gap-3 py-4">
                    <AlertTriangle
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        c.severity === "blocking" ? "text-destructive" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{c.title}</span>
                        <Badge variant={c.severity === "blocking" ? "destructive" : "secondary"}>
                          {c.severity === "blocking" ? "Blocking" : "Warning"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{c.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Case {c.caseNumber} · {c.judgeName ?? "No judge"} ·{" "}
                        {c.courtroomName ?? "No courtroom"} · {c.slotLabel}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
