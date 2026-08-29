import { useMemo, useEffect, useRef, useState } from "react";
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
  TrendingUp,
  Zap,
  Target,
  Trophy,
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { computeDashboardMetrics, dashboardDataQuery } from "@/lib/dashboard";
import { conflictDataQuery, scanSystemConflicts } from "@/lib/conflicts";
import { buildBriefingInput, composeBriefingSentences } from "@/lib/briefing";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/i18n";

function formatJudgeShortName(fullName: string): string {
  const clean = (fullName || "")
    .replace(/Hon('ble|\.)?\s*/gi, "")
    .replace(/Justice\s*/gi, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "Judge";
  const firstChar = parts[0]?.[0] ?? "";
  const lastPart = parts[parts.length - 1] ?? "";
  return firstChar && lastPart ? `${firstChar}. ${lastPart}` : parts[0] || "Judge";
}

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

function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return count;
}

function ImpactStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  const displayed = useCountUp(value);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className={cn("flex size-9 items-center justify-center rounded-sm", accent)}>
        <Icon className="size-4" />
      </span>
      <p className="text-2xl font-bold tabular-nums text-foreground">{displayed}</p>
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
    </div>
  );
}

function ImpactBanner({
  conflictsDetected,
  tier1Cases,
  recommendationsIssued,
  scheduledHearings,
  loading,
}: {
  conflictsDetected: number;
  tier1Cases: number;
  recommendationsIssued: number;
  scheduledHearings: number;
  loading: boolean;
}) {
  return (
    <Card className="registry-enter border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
      <CardContent className="py-4 px-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-primary">NyayaSetu Impact</p>
          <span className="h-px flex-1 bg-primary/20" />
          <p className="text-[10px] text-muted-foreground">Live data from this registry</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ImpactStat
              label="Conflicts Detected & Prevented"
              value={conflictsDetected}
              icon={AlertTriangle}
              accent="bg-destructive/10 text-destructive"
            />
            <ImpactStat
              label="Tier 1 Cases Prioritised"
              value={tier1Cases}
              icon={Trophy}
              accent="bg-accent text-accent-foreground"
            />
            <ImpactStat
              label="AI Recommendations Issued"
              value={recommendationsIssued}
              icon={Target}
              accent="bg-primary/10 text-primary"
            />
            <ImpactStat
              label="Active Scheduled Hearings"
              value={scheduledHearings}
              icon={TrendingUp}
              accent="bg-secondary text-secondary-foreground"
            />
          </div>
        )}
      </CardContent>
    </Card>
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
  const { t } = useLanguage();
  const recsQuery = useQuery({
    queryKey: ["dashboard", "recs-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("ai_recommendations")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

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

  const courtroomPie = useMemo(
    () => (metrics?.courtroomLoad ?? []).filter((c) => c.hearings > 0),
    [metrics?.courtroomLoad],
  );

  const totalCourtroomHearings = useMemo(
    () => courtroomPie.reduce((acc, curr) => acc + curr.hearings, 0),
    [courtroomPie],
  );

  const formattedJudgeWorkload = useMemo(() => {
    if (!metrics?.judgeWorkload) return [];
    return metrics.judgeWorkload.map((j) => ({
      ...j,
      shortName: formatJudgeShortName(j.name),
      fullName: j.name,
    }));
  }, [metrics?.judgeWorkload]);

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
            <ImpactBanner
              conflictsDetected={conflicts.length}
              tier1Cases={metrics.highPriorityCases}
              recommendationsIssued={recsQuery.data ?? 0}
              scheduledHearings={metrics.scheduledHearings}
              loading={recsQuery.isLoading}
            />
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              className="registry-enter stagger-1"
              label={t("dash.pending-cases")}
              value={metrics.pendingCases}
              hint={`${metrics.totalCases} cases on file`}
              icon={Layers}
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-2"
              label={t("dash.tier1-cases")}
              value={metrics.highPriorityCases}
              hint={`Tier 2: ${metrics.tierCounts["Tier 2"]} · Tier 3: ${metrics.tierCounts["Tier 3"]}`}
              icon={ListChecks}
              tone="gold"
              to="/cases"
            />
            <StatCard
              className="registry-enter stagger-3"
              label={t("dash.scheduled")}
              value={metrics.scheduledHearings}
              hint="Proposed or confirmed listings"
              icon={CalendarCheck}
              to="/calendar"
            />
            <StatCard
              className="registry-enter stagger-4"
              label={t("dash.conflicts")}
              value={conflictData.isLoading ? "—" : conflicts.length}
              hint="Hard-constraint violations"
              icon={AlertTriangle}
              tone={conflicts.length > 0 ? "alert" : "default"}
              to="/conflicts"
            />
            <StatCard
              className="registry-enter stagger-5"
              label={t("dash.judge-util")}
              value={`${metrics.judgeUtilisation}%`}
              hint={`Against ${metrics.judgeWorkload.length} judges × ${data.data?.maxJudgeWorkload} hearing threshold`}
              icon={Gavel}
              to="/judges"
            />
            <StatCard
              className="registry-enter stagger-1"
              label={t("dash.courtroom-util")}
              value={`${metrics.courtroomUtilisation}%`}
              hint="Booked courtroom-slot pairs of all published slots"
              icon={Building2}
              to="/courtrooms"
            />
            <StatCard
              className="registry-enter stagger-2"
              label={t("dash.awaiting")}
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

          <div className="mt-7 grid gap-6 lg:grid-cols-2 items-stretch">
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Judge workload distribution</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Active hearings per judge (Threshold: {data.data?.maxJudgeWorkload ?? 25})
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {formattedJudgeWorkload.length} Benches
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pt-2">
                {formattedJudgeWorkload.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No judges on record yet.
                  </p>
                ) : (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={formattedJudgeWorkload}
                        margin={{ top: 8, right: 8, left: -24, bottom: 24 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="shortName"
                          tick={{ fontSize: 9.5, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                          interval={0}
                          height={44}
                          angle={-40}
                          textAnchor="end"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: "var(--muted)/40" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length || !payload[0]?.payload) return null;
                            const item = payload[0].payload as { fullName?: string; hearings?: number };
                            return (
                              <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-foreground">{item.fullName ?? "Judge"}</p>
                                <p className="mt-0.5 text-muted-foreground">
                                  {item.hearings ?? 0} active hearing{item.hearings !== 1 ? "s" : ""}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="hearings"
                          radius={[3, 3, 0, 0]}
                          fill="var(--primary)"
                          maxBarSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Courtroom utilisation</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share of active listings held in each courtroom.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {courtroomPie.length} Active Halls
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center pt-2">
                {courtroomPie.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No courtroom bookings recorded yet.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 items-center">
                    <div className="h-60 w-full relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={courtroomPie}
                            dataKey="hearings"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                            stroke="var(--card)"
                          >
                            {courtroomPie.map((entry, i) => (
                              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length || !payload[0]) return null;
                              const item = payload[0];
                              const val = Number(item.value) || 0;
                              const pct =
                                totalCourtroomHearings > 0
                                  ? Math.round((val / totalCourtroomHearings) * 100)
                                  : 0;
                              return (
                                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                  <p className="font-semibold text-foreground">{item.name ?? "Courtroom"}</p>
                                  <p className="mt-0.5 text-muted-foreground">
                                    {val} hearings ({pct}%)
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-bold tabular-nums text-foreground">
                          {totalCourtroomHearings}
                        </span>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Listings
                        </span>
                      </div>
                    </div>
                    <ScrollArea className="h-60 pr-3">
                      <ul className="space-y-2.5">
                        {courtroomPie.map((c, i) => (
                          <li key={c.name} className="text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                                <span className="truncate text-foreground font-medium">{c.name}</span>
                              </span>
                              <span className="tabular-nums font-mono text-muted-foreground">
                                {c.hearings}
                              </span>
                            </div>
                            <Progress
                              className="mt-1 h-1"
                              value={Math.min(
                                100,
                                (c.hearings / Math.max(1, metrics.scheduledHearings)) * 100,
                              )}
                            />
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
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
