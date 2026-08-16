import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Info, RefreshCw, ShieldCheck, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { conflictDataQuery, scanSystemConflicts } from "@/lib/conflicts";
import { computeReportsMetrics, formatDuration, reportsDataQuery } from "@/lib/reports";
import { computeUtilisation, utilisationDataQuery } from "@/lib/utilisation";
import { UtilisationHeatmap } from "@/components/utilisation-heatmap";

type ChartTipProps = {
  active?: boolean;
  payload?: { value?: string | number }[];
  label?: string;
};

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — NyaySetu" },
      {
        name: "description",
        content:
          "Impact metrics for the scheduling engine — conflicts avoided, decision outcomes and scheduling turnaround, based on current demo data.",
      },
      { property: "og:title", content: "Reports — NyaySetu" },
      {
        property: "og:description",
        content:
          "Impact metrics for the scheduling engine — conflicts avoided, decision outcomes and scheduling turnaround, based on current demo data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function Tip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0]?.value} decisions</p>
    </div>
  );
}

function Page() {
  const reports = useQuery(reportsDataQuery);
  const conflictData = useQuery(conflictDataQuery);
  const utilisation = useQuery(utilisationDataQuery);

  const heatmaps = useMemo(
    () => (utilisation.data ? computeUtilisation(utilisation.data) : null),
    [utilisation.data],
  );

  const liveConflicts = useMemo(
    () => (conflictData.data ? scanSystemConflicts(conflictData.data).length : 0),
    [conflictData.data],
  );
  const metrics = useMemo(
    () => (reports.data ? computeReportsMetrics(reports.data, liveConflicts) : null),
    [reports.data, liveConflicts],
  );

  const refreshing = reports.isFetching || conflictData.isFetching || utilisation.isFetching;

  const outcomeData = metrics
    ? [
        { name: "Accepted", value: metrics.accepted },
        { name: "Modified", value: metrics.modified },
        { name: "Rejected", value: metrics.rejected },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Impact of the deterministic scheduling engine on the records currently held in this environment."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/governance">
                <ShieldCheck className="size-4" />
                Governance & Compliance
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void reports.refetch();
                void conflictData.refetch();
                void utilisation.refetch();
              }}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
          </div>
        }
      />

      <Alert className="mt-6">
        <Info className="size-4" />
        <AlertTitle>Based on current demo data</AlertTitle>
        <AlertDescription>
          Every figure below is measured from the cases, schedules and decision records presently in
          this environment. They describe this dataset only and are not real-world performance
          claims or benchmarks.
        </AlertDescription>
      </Alert>

      {reports.isError ? (
        <ErrorState
          title="Could not compile these reports"
          error={reports.error}
          onRetry={() => {
            void reports.refetch();
            void conflictData.refetch();
          }}
          retrying={refreshing}
        />
      ) : reports.isLoading || !metrics ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Conflicts avoided"
              value={metrics.conflictsAvoided}
              hint="Listings committed only after passing every hard-constraint check immediately before writing."
              icon={ShieldCheck}
            />
            <Metric
              label="Average scheduling time"
              value={formatDuration(metrics.averageSchedulingMinutes)}
              hint={`Median-free mean from case registration to listing, across ${metrics.schedulingSampleSize} scheduled cases.`}
              icon={Timer}
            />
            <Metric
              label="Conflict Detection — open"
              value={metrics.liveConflicts}
              hint="Conflict Detection violations currently flagged across live schedules."
              icon={FlaskConical}
            />
            <Metric
              label="Recommendations issued"
              value={metrics.recommendationsIssued}
              hint="Scheduling recommendations reviewed by a registrar or administrator."
              icon={CheckCircle2}
            />
            <Metric
              label="Acceptance rate"
              value={`${metrics.acceptanceRate}%`}
              hint="Recommendations accepted as-is or after a human modification."
              icon={CheckCircle2}
            />
            <Metric
              label="Average adjournments"
              value={metrics.averageAdjournments}
              hint="Adjournments recorded per case across the dataset."
              icon={Timer}
            />
          </div>

          <div className="mt-8 grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Judge utilisation — weekly heatmap</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hours booked per judge on each weekday, from active listings in the schedules
                  table.
                </p>
              </CardHeader>
              <CardContent>
                {utilisation.isLoading || !heatmaps ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <UtilisationHeatmap
                    rows={heatmaps.judges}
                    peak={heatmaps.peak}
                    emptyLabel="No judges on the register yet."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Courtroom utilisation — weekly heatmap</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hours booked per courtroom on each weekday, from active listings in the schedules
                  table.
                </p>
              </CardHeader>
              <CardContent>
                {utilisation.isLoading || !heatmaps ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <UtilisationHeatmap
                    rows={heatmaps.courtrooms}
                    peak={heatmaps.peak}
                    emptyLabel="No courtrooms on the register yet."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Human decisions on recommendations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  A registrar always makes the final call; this is the split of what they decided.
                </p>
              </CardHeader>
              <CardContent>
                {metrics.recommendationsIssued === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No scheduling recommendations recorded yet. Run Smart Scheduling to populate
                    this report.
                  </p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={outcomeData}
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
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip cursor={{ fill: "var(--muted)" }} content={<Tip />} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-2)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coverage and activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  How much of the current caseload the registry has listed.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">Open cases with an active listing</span>
                    <span className="tabular-nums text-muted-foreground">
                      {metrics.scheduledCoverage}%
                    </span>
                  </div>
                  <Progress className="mt-2 h-2" value={metrics.scheduledCoverage} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Simulations applied
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {metrics.simulationsApplied}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Audited actions
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {metrics.decisionsLogged}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-normal">
                  Deterministic engine; every figure is counted from registry records
                </Badge>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
