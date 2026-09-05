import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Info } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/states";
import { HORIZONS, backlogCasesQuery, runBacklogProjection } from "@/lib/backlog-simulation";

type ChartPayload = {
  dataKey?: string | number;
  color?: string;
  name?: string;
  value?: string | number;
};

type ChartTipProps = {
  active?: boolean;
  payload?: ChartPayload[];
  label?: string;
};

export const Route = createFileRoute("/_authenticated/backlog-simulator")({
  head: () => ({
    meta: [
      { title: "Backlog Simulator — NyayaSetu" },
      {
        name: "description",
        content:
          "Simulated pendency projections over 6 and 12 months comparing filing-date order with the proposed priority order, using the demo dataset.",
      },
      { property: "og:title", content: "Backlog Simulator — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Simulated pendency projections over 6 and 12 months comparing filing-date order with the proposed priority order, using the demo dataset.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Tip({ active, payload, label }: ChartTipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-panel">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function AssumptionBlock({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col justify-between gap-4 rounded-sm border border-border bg-background p-4">
      <Label className="text-xs leading-tight font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Page() {
  const casesQuery = useQuery(backlogCasesQuery);
  const [rate, setRate] = useState(8);
  const [horizonKey, setHorizonKey] = useState<(typeof HORIZONS)[number]["key"]>("6m");
  const [metric, setMetric] = useState<"all" | "tier1">("all");

  const horizon = HORIZONS.find((h) => h.key === horizonKey) ?? HORIZONS[0];

  const projection = useMemo(
    () => runBacklogProjection(casesQuery.data ?? [], rate, horizon.weeks),
    [casesQuery.data, rate, horizon.weeks],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Backlog Simulator"
        description="A projection of how pendency declines under two hearing orders, run on the demo dataset."
      />

      <Alert className="registry-enter">
        <FlaskConical className="size-4" />
        <AlertTitle>Simulation on the demo dataset — not a real-world claim</AlertTitle>
        <AlertDescription>
          This model plays the currently pending demo cases through a fixed weekly disposal rate. It
          assumes a constant disposal rate, no new filings, no adjournments and no vacations.
          Figures illustrate the effect of hearing order alone.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assumptions</CardTitle>
        </CardHeader>
        <CardContent className="grid items-stretch gap-4 lg:grid-cols-3">
          <AssumptionBlock label={`Disposal rate — ${rate} cases / week`}>
            <Slider
              value={[rate]}
              min={1}
              max={30}
              step={1}
              onValueChange={(v) => setRate(v[0] ?? 8)}
            />
          </AssumptionBlock>
          <AssumptionBlock label="Horizon">
            <Tabs value={horizonKey} onValueChange={(v) => setHorizonKey(v as typeof horizonKey)}>
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-sm">
                {HORIZONS.map((h) => (
                  <TabsTrigger key={h.key} value={h.key} className="rounded-sm text-xs sm:text-sm">
                    {h.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </AssumptionBlock>
          <AssumptionBlock label="Starting case count">
            <div>
              <p className="text-3xl leading-none font-semibold tabular-nums text-foreground">
                {projection ? projection.startingCaseCount : "—"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {projection
                  ? `${projection.startingTier1Count} of these are Tier 1`
                  : "Pending cases in the dataset"}
              </p>
            </div>
          </AssumptionBlock>
        </CardContent>
      </Card>

      {casesQuery.isError ? (
        <ErrorState
          title="Could not load the case dataset for the simulation."
          error={casesQuery.error}
          onRetry={() => {
            void casesQuery.refetch();
          }}
        />
      ) : !projection ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="grid gap-4 pb-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <CardTitle className="max-w-2xl text-base leading-snug">
                Projected pendency over {horizon.label} at {projection.disposalRatePerWeek}{" "}
                cases/week
              </CardTitle>
              <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
                <TabsList className="grid h-auto w-full grid-cols-2 rounded-sm sm:w-[360px]">
                  <TabsTrigger value="all" className="min-h-9 rounded-sm text-xs sm:text-sm">
                    All pending cases
                  </TabsTrigger>
                  <TabsTrigger value="tier1" className="min-h-9 rounded-sm text-xs sm:text-sm">
                    Tier 1 pending
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="h-[340px] w-full min-h-[320px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                  <LineChart
                    data={projection.series}
                    margin={{ top: 12, right: 24, bottom: 12, left: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      strokeOpacity={0.6}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      interval={Math.ceil(horizon.weeks / 13)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      stroke="var(--border)"
                      allowDecimals={false}
                    />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line
                      type="monotone"
                      dataKey={metric === "all" ? "fifoPending" : "fifoTier1"}
                      name="Filing-date order (FIFO)"
                      stroke="#64748b"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: "#64748b" }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric === "all" ? "priorityPending" : "priorityTier1"}
                      name="Proposed order (tier + score)"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 3.5, fill: "#2563eb" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {metric === "all"
                  ? "Total pendency falls at the same rate under both orders — the disposal rate is fixed. The difference shows in which cases are heard first: switch to “Tier 1 pending” to see it."
                  : "Under the proposed order, statutory Tier 1 matters clear the list far earlier, while total pendency is unchanged."}
              </p>
            </CardContent>
          </Card>

          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            {[projection.fifo, projection.priority].map((o) => (
              <Card key={o.key} className="h-full">
                <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
                  <CardTitle className="text-base">{o.label}</CardTitle>
                  {o.key === "priority" ? (
                    <Badge>This system</Badge>
                  ) : (
                    <Badge variant="secondary">Baseline</Badge>
                  )}
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-sm border border-border bg-background p-3">
                    <p className="text-xs leading-tight tracking-wide text-muted-foreground uppercase">
                      Avg wait, Tier 1
                    </p>
                    <p className="mt-2 text-2xl leading-none font-semibold tabular-nums">
                      {o.averageTier1WaitWeeks} wks
                    </p>
                  </div>
                  <div className="rounded-sm border border-border bg-background p-3">
                    <p className="text-xs leading-tight tracking-wide text-muted-foreground uppercase">
                      Avg wait, all heard
                    </p>
                    <p className="mt-2 text-2xl leading-none font-semibold tabular-nums">
                      {o.averageWaitWeeks} wks
                    </p>
                  </div>
                  <div className="rounded-sm border border-border bg-background p-3">
                    <p className="text-xs leading-tight tracking-wide text-muted-foreground uppercase">
                      Heard in horizon
                    </p>
                    <p className="mt-2 text-2xl leading-none font-semibold tabular-nums">
                      {o.heardInHorizon}
                    </p>
                  </div>
                  <div className="rounded-sm border border-border bg-background p-3">
                    <p className="text-xs leading-tight tracking-wide text-muted-foreground uppercase">
                      Heard past deadline
                    </p>
                    <p className="mt-2 text-2xl leading-none font-semibold tabular-nums">
                      {o.deadlineBreaches}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Alert>
            <Info className="size-4" />
            <AlertTitle>How to read this</AlertTitle>
            <AlertDescription>
              Starting count {projection.startingCaseCount} cases · disposal rate{" "}
              {projection.disposalRatePerWeek} cases/week · horizon {horizon.label} ({horizon.weeks}{" "}
              weeks). Under the proposed order, the average Tier 1 wait is{" "}
              {projection.priority.averageTier1WaitWeeks} weeks against{" "}
              {projection.fifo.averageTier1WaitWeeks} weeks in filing-date order, and{" "}
              {projection.fifo.deadlineBreaches - projection.priority.deadlineBreaches} fewer cases
              are heard after their statutory limitation deadline.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
