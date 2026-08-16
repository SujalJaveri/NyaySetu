import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSlot, isActive, judgesQuery, schedulesQuery } from "@/lib/registry";
import { WorkloadMeter } from "@/components/registry-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityPanel } from "@/components/availability-panel";

export const Route = createFileRoute("/_authenticated/judges/$judgeId")({
  head: () => ({
    meta: [
      { title: "Judge profile — NyaySetu" },
      {
        name: "description",
        content: "Assigned cases, sitting workload and availability for a judicial officer.",
      },
      { property: "og:title", content: "Judge profile — NyaySetu" },
      {
        property: "og:description",
        content: "Assigned cases, sitting workload and availability for a judicial officer.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JudgeDetail,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Judge not found.</div>
  ),
});

function JudgeDetail() {
  const { judgeId } = Route.useParams();
  const judges = useQuery(judgesQuery);
  const schedules = useQuery(schedulesQuery);

  const judge = judges.data?.find((j) => j.id === judgeId);
  const assigned = useMemo(
    () => (schedules.data ?? []).filter((s) => s.judge_id === judgeId),
    [schedules.data, judgeId],
  );
  const active = assigned.filter((s) => isActive(s.status));

  if (judges.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <ErrorState
          title="Could not load this judge"
          error={judges.error}
          onRetry={() => void judges.refetch()}
          retrying={judges.isFetching}
        />
      </div>
    );
  }

  if (judges.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!judge) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">
          This judge no longer exists in the registry.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/judges">Back to judges</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/judges">
          <ArrowLeft className="size-4" /> All judges
        </Link>
      </Button>

      <PageHeader
        eyebrow="Judicial officer"
        title={judge.name}
        description={
          judge.specialisation ? `${judge.specialisation} bench` : "Specialisation not recorded"
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkloadMeter value={judge.current_workload ?? 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{active.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total scheduled
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {assigned.length}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cases" className="mt-8">
        <TabsList>
          <TabsTrigger value="cases">Assigned cases</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="cases">
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case number</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Hearing slot</TableHead>
                  <TableHead>Courtroom</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                )}
                {!schedules.isLoading && assigned.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No cases assigned to this judge yet.
                    </TableCell>
                  </TableRow>
                )}
                {assigned.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.cases?.case_number ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {s.cases?.parties || "—"}
                    </TableCell>
                    <TableCell>{formatSlot(s.hearing_slots)}</TableCell>
                    <TableCell>{s.courtrooms?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={isActive(s.status) ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityPanel entityType="judge" entityId={judge.id} entityName={judge.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
