import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
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
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";
import {
  AUDIT_ACTION_TYPES,
  auditActionLabel,
  auditLogQuery,
  formatAuditTime,
  type AuditActionType,
} from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/activity-log")({
  head: () => ({
    meta: [
      { title: "Activity Log — NyayaSetu" },
      {
        name: "description",
        content:
          "Reverse-chronological accountability trail of every recorded registry action: who acted, what they did, which record it affected and when.",
      },
      { property: "og:title", content: "Activity Log — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Reverse-chronological accountability trail of every recorded registry action: who acted, what they did, which record it affected and when.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const typeTone: Record<AuditActionType, string> = {
  case: "bg-secondary text-secondary-foreground",
  schedule: "bg-primary/10 text-primary",
  recommendation: "bg-gold/15 text-gold-foreground",
  availability: "bg-secondary text-secondary-foreground",
  simulation: "bg-primary/10 text-primary",
  registry: "bg-muted text-muted-foreground",
  settings: "bg-muted text-muted-foreground",
  other: "bg-muted text-muted-foreground",
};

function Page() {
  const logs = useQuery(auditLogQuery);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const entries = useMemo(() => logs.data ?? [], [logs.data]);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.user_id) map.set(e.user_id, e.userName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const filtered = entries.filter((e) => {
    if (user !== "all" && e.user_id !== user) return false;
    if (type !== "all" && e.actionType !== type) return false;
    const day = e.timestamp.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [e.action, e.entity_affected, e.userName, e.userRole].some((v) =>
      v.toLowerCase().includes(q),
    );
  });

  const activeFilters =
    user !== "all" || type !== "all" || Boolean(from) || Boolean(to) || Boolean(search.trim());

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Accountability"
        title="Activity Log"
        description="Every recorded action in the registry, newest first — who took it, what they did, which record it affected and exactly when. This is the audit trail behind every scheduling recommendation a human accepted, modified or rejected."
        actions={
          <Button variant="outline" onClick={() => logs.refetch()} disabled={logs.isFetching}>
            <RefreshCw className={cn("size-4", logs.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="mt-6 flex items-start gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          The scheduling engine and the What-If Simulation only ever propose. Every entry below is
          attributed to the named member of staff who made the final call, so an AI-assisted listing
          can always be traced to a human decision-maker.
        </p>
      </div>

      <Card className="mt-6 shadow-panel">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <Input
              className="mt-1.5"
              placeholder="Action, case, judge…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">User</Label>
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Action type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="All action types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All action types</SelectItem>
                {AUDIT_ACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              className="mt-1.5"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {logs.isLoading ? (
        <LoadingState label="Loading the accountability trail…" />
      ) : logs.isError ? (
        <ErrorState
          title="Could not load the Activity Log"
          error={logs.error}
          onRetry={() => logs.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={activeFilters ? "No entries match these filters" : "No recorded activity yet"}
          description={
            activeFilters
              ? "Widen the date range or clear the user and action-type filters to see more of the trail."
              : "Registering a case, accepting a scheduling recommendation, changing availability or applying a What-If Simulation will appear here immediately."
          }
          action={
            activeFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setUser("all");
                  setType("all");
                  setFrom("");
                  setTo("");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mt-6 text-xs text-muted-foreground">
            Showing {filtered.length} of {entries.length} recorded actions.
          </p>
          <Card className="mt-3 shadow-panel">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {filtered.map((entry) => (
                  <li
                    key={entry.id}
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border-0", typeTone[entry.actionType])}>
                          {auditActionLabel[entry.actionType]}
                        </Badge>
                        <span className="text-sm font-medium text-foreground">
                          {entry.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">{entry.userRole}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                        {entry.action}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.entityLabel}</p>
                    </div>
                    <time
                      dateTime={entry.timestamp}
                      className="shrink-0 text-xs text-muted-foreground sm:text-right"
                    >
                      {formatAuditTime(entry.timestamp)}
                    </time>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
