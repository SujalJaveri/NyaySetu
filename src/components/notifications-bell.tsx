import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, FlaskConical, Gauge, Gavel, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { auditLogQuery } from "@/lib/audit";
import { conflictDataQuery } from "@/lib/conflicts";
import { dashboardDataQuery } from "@/lib/dashboard";
import {
  buildNotifications,
  notificationKindLabel,
  readSeenIds,
  readUnscheduledThreshold,
  writeSeenIds,
  writeUnscheduledThreshold,
  UNSCHEDULED_THRESHOLD_OPTIONS,
  type NotificationKind,
  type SystemNotification,
} from "@/lib/notifications";

const kindIcon: Record<NotificationKind, typeof Bell> = {
  conflict: AlertTriangle,
  unscheduled_case: ScrollText,
  judge_capacity: Gauge,
  simulation_pending: FlaskConical,
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(7);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    setThreshold(readUnscheduledThreshold());
    setSeen(readSeenIds());
  }, []);

  const dashboard = useQuery(dashboardDataQuery);
  const conflicts = useQuery(conflictDataQuery);
  const audit = useQuery(auditLogQuery);

  const notifications = useMemo<SystemNotification[]>(() => {
    if (!dashboard.data || !conflicts.data) return [];
    return buildNotifications({
      dashboard: dashboard.data,
      conflictInput: conflicts.data,
      auditEntries: audit.data ?? [],
      thresholdDays: threshold,
    });
  }, [dashboard.data, conflicts.data, audit.data, threshold]);

  const seenSet = useMemo(() => new Set(seen), [seen]);
  const unread = notifications.filter((n) => !seenSet.has(n.id));

  function markAllRead() {
    const ids = notifications.map((n) => n.id);
    writeSeenIds(ids);
    setSeen(ids);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && notifications.length > 0) markAllRead();
  }

  function go(n: SystemNotification) {
    setOpen(false);
    markAllRead();
    if (n.target.route === "/cases/$caseId") {
      navigate({ to: "/cases/$caseId", params: { caseId: n.target.caseId } });
    } else if (n.target.route === "/judges/$judgeId") {
      navigate({ to: "/judges/$judgeId", params: { judgeId: n.target.judgeId } });
    } else {
      navigate({ to: n.target.route });
    }
  }

  const loading = dashboard.isLoading || conflicts.isLoading;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications (${unread.length} unread)`}
          className="relative"
        >
          <Bell className="size-4" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-primary">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0 sm:w-[26rem]">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Checking the registry…"
                : `${notifications.length} item(s) need attention`}
            </p>
          </div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <Separator />

        <ScrollArea className="max-h-[22rem]">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading system events…
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing needs attention — no conflicts, overdue high-priority cases, or pending
              simulations.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const Icon = kindIcon[n.kind] ?? Gavel;
                const isUnread = !seenSet.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => go(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                        isUnread && "bg-muted/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          n.kind === "conflict" ? "text-destructive" : "text-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {n.title}
                          </span>
                          {isUnread && <span className="size-1.5 shrink-0 rounded-full bg-gold" />}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {n.detail}
                        </span>
                        <Badge variant="outline" className="mt-1.5 text-[10px] font-normal">
                          {notificationKindLabel[n.kind]}
                        </Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <Separator />
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Flag unscheduled high-priority cases after
          </span>
          <Select
            value={String(threshold)}
            onValueChange={(v) => {
              const days = Number(v);
              setThreshold(days);
              writeUnscheduledThreshold(days);
            }}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNSCHEDULED_THRESHOLD_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
