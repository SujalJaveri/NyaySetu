import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  Gavel,
  Layers,
  ListChecks,
  Building2,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { computeDashboardMetrics, dashboardDataQuery } from "@/lib/dashboard";
import { conflictDataQuery, scanSystemConflicts } from "@/lib/conflicts";
import { buildBriefingInput, composeBriefingSentences } from "@/lib/briefing";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NyayaSetu" },
      {
        name: "description",
        content:
          "Live registry snapshot: pending cases, high-priority listings, scheduled hearings, conflicts and utilisation.",
      },
      { property: "og:title", content: "Dashboard — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Live registry snapshot: pending cases, high-priority listings, scheduled hearings, conflicts and utilisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type ChartTipProps = {
  active?: boolean;
  payload?: { name?: string; value?: string | number }[];
  label?: string;
  unit?: string;
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  to,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "gold" | "alert";
  to?: string;
  className?: string;
}) {
  const body = (
    <Card className={cn("registry-interactive h-full", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={
            tone === "alert"
              ? "flex size-9 shrink-0 items-center justify-center rounded-sm bg-destructive/10 text-destructive"
              : tone === "gold"
                ? "flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground"
                : "flex size-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground"
          }
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function ChartTip({ active, payload, label, unit }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-foreground">{label ?? payload[0]?.name}</p>
      <p className="text-muted-foreground">
        {payload[0]?.value} {unit}
      </p>
    </div>
  );
}

function RegistryBriefing({ sentences, pending }: { sentences: string[]; pending: boolean }) {
  return (
    <Card className="registry-enter border-l-4 border-l-primary bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
            <ClipboardCheck className="size-4" />
          </span>
          Registry briefing
        </CardTitle>
      </CardHeader>
      <CardContent>
        {pending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : sentences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to summarise yet — register cases and listings to build the daily briefing.
          </p>
        ) : (
          <p className="text-[0.95rem] leading-relaxed text-foreground">{sentences.join(" ")}</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Composed from live case, schedule and conflict records using fixed wording.
        </p>
      </CardContent>
    </Card>
  );
}

function CourtReadiness({
  conflicts,
  awaiting,
  tierOne,
  judgeUtilisation,
  courtroomUtilisation,
}: {
  conflicts: number;
  awaiting: number;
  tierOne: number;
  judgeUtilisation: number;
  courtroomUtilisation: number;
}) {
  const checks = [
    {
      label: "Conflict review",
      status: conflicts === 0 ? "Clear" : `${conflicts} open`,
      tone: conflicts === 0 ? "ok" : "alert",
    },
    {
      label: "Unlisted open cases",
      status: awaiting === 0 ? "Clear" : `${awaiting} pending`,
      tone: awaiting === 0 ? "ok" : "watch",
    },
    {
      label: "Tier 1 attention",
      status: tierOne === 0 ? "No Tier 1 backlog" : `${tierOne} case(s)`,
      tone: tierOne === 0 ? "ok" : "watch",
    },
    {
      label: "Bench capacity",
      status: `${judgeUtilisation}% used`,
      tone: judgeUtilisation >= 90 ? "alert" : judgeUtilisation >= 70 ? "watch" : "ok",
    },
    {
      label: "Courtroom slots",
      status: `${courtroomUtilisation}% booked`,
      tone: courtroomUtilisation >= 90 ? "alert" : courtroomUtilisation >= 70 ? "watch" : "ok",
    },
  ] as const;

  return (
    <Card className="registry-enter bg-secondary/45">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-sm bg-card text-primary">
            <ClipboardCheck className="size-4" />
          </span>
          Court readiness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {checks.map((check) => (
            <div
              key={check.label}
              className="registry-interactive border border-border bg-card px-3 py-3"
            >
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                {check.label}
              </p>
              <p
                className={
                  check.tone === "alert"
                    ? "mt-1 text-sm font-semibold text-destructive"
                    : check.tone === "watch"
                      ? "mt-1 text-sm font-semibold text-accent-foreground"
                      : "mt-1 text-sm font-semibold text-foreground"
                }
              >
                {check.status}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const data = useQuery(dashboardDataQuery);
  const conflictData = useQuery(conflictDataQuery);

  const metrics = useMemo(
    () => (data.data ? computeDashboardMetrics(data.data) : null),
    [data.data],
  );
  const conflicts = useMemo(
    () => (conflictData.data ? scanSystemConflicts(conflictData.data) : []),
    [conflictData.data],
  );

  const refreshing = data.isFetching || conflictData.isFetching;

  const briefing = useMemo(() => {
    if (!data.data || !metrics || conflictData.isLoading) return null;
    return composeBriefingSentences(buildBriefingInput(data.data, metrics, conflicts));
  }, [data.data, metrics, conflicts, conflictData.isLoading]);

  const courtroomPie = (metrics?.courtroomLoad ?? []).filter((c) => c.hearings > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 sm:py-9">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Live registry status counted directly from current case, schedule and availability records."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void data.refetch();
              void conflictData.refetch();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      />

      {data.isError ? (
        <ErrorState
          title="Could not load the registry snapshot"
          error={data.error}
          onRetry={() => {
            void data.refetch();
            void conflictData.refetch();
          }}
          retrying={refreshing}
        />
      ) : data.isLoading || !metrics ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-4">
            <CourtReadiness
              conflicts={conflicts.length}
              awaiting={metrics.awaitingScheduling}
              tierOne={metrics.highPriorityCases}
              judgeUtilisation={metrics.judgeUtilisation}
              courtroomUtilisation={metrics.courtroomUtilisation}
            />
            <RegistryBriefing sentences={briefing ?? []} pending={briefing === null} />
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              className="registry-enter stagger-1"
              label="Pending cases"
              value={metrics.pendingCases}
              hint={`${metrics.totalCases} cases on file`}
              icon={Layers}
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-2"
              label="Tier 1 cases"
              value={metrics.highPriorityCases}
              hint={`Tier 2: ${metrics.tierCounts["Tier 2"]} · Tier 3: ${metrics.tierCounts["Tier 3"]}`}
              icon={ListChecks}
              tone="gold"
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-3"
              label="Scheduled hearings"
              value={metrics.scheduledHearings}
              hint="Proposed or confirmed listings"
              icon={CalendarCheck}
              to="/calendar"
            />
            <StatCard
              className="registry-enter stagger-4"
              label="Conflicts detected"
              value={conflictData.isLoading ? "—" : conflicts.length}
              hint="Hard-constraint violations"
              icon={AlertTriangle}
              tone={conflicts.length > 0 ? "alert" : "default"}
              to="/conflicts"
            />
            <StatCard
              className="registry-enter stagger-5"
              label="Judge utilisation"
              value={`${metrics.judgeUtilisation}%`}
              hint={`Against ${metrics.judgeWorkload.length} judges × ${data.data?.maxJudgeWorkload} hearing threshold`}
              icon={Gavel}
              to="/judges"
            />
            <StatCard
              className="registry-enter stagger-1"
              label="Courtroom utilisation"
              value={`${metrics.courtroomUtilisation}%`}
              hint="Booked courtroom-slot pairs of all published slots"
              icon={Building2}
              to="/courtrooms"
            />
            <StatCard
              className="registry-enter stagger-2"
              label="Awaiting scheduling"
              value={metrics.awaitingScheduling}
              hint="Open cases with no active listing"
              icon={Clock}
              to="/smart-scheduling"
            />
            <StatCard
              label="Disposed cases"
              value={metrics.disposedCases}
              hint="Closed and off the pending list"
              icon={ListChecks}
              to="/cases"
            />
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Judge workload distribution</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Active hearings per judge against the configured workload threshold of{" "}
                  {data.data?.maxJudgeWorkload}.
                </p>
              </CardHeader>
              <CardContent>
                {metrics.judgeWorkload.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No judges on record yet.
                  </p>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.judgeWorkload}
                        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                          interval={0}
                          height={48}
                          angle={-20}
                          textAnchor="end"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)" }}
                          content={<ChartTip unit="hearings" />}
                        />
                        <Bar dataKey="hearings" radius={[4, 4, 0, 0]} fill="var(--chart-1)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courtroom utilisation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Share of active listings held in each courtroom.
                </p>
              </CardHeader>
              <CardContent>
                {courtroomPie.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No courtroom bookings recorded yet.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={courtroomPie}
                            dataKey="hearings"
                            nameKey="name"
                            innerRadius={44}
                            outerRadius={70}
                            paddingAngle={2}
                            stroke="var(--card)"
                          >
                            {courtroomPie.map((entry, i) => (
                              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTip unit="hearings" />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="space-y-3 self-center">
                      {courtroomPie.map((c, i) => (
                        <li key={c.name} className="text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                              />
                              <span className="truncate text-foreground">{c.name}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">{c.hearings}</span>
                          </div>
                          <Progress
                            className="mt-1.5 h-1.5"
                            value={Math.min(
                              100,
                              (c.hearings / Math.max(1, metrics.scheduledHearings)) * 100,
                            )}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
