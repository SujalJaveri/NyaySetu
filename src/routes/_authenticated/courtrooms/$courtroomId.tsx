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
import { courtroomsQuery, formatSlot, isActive, schedulesQuery } from "@/lib/registry";
import { AllocationBadge } from "@/components/registry-bits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailabilityPanel } from "@/components/availability-panel";

export const Route = createFileRoute("/_authenticated/courtrooms/$courtroomId")({
  head: () => ({
    meta: [
      { title: "Courtroom detail — NyaySetu" },
      {
        name: "description",
        content: "Capacity, type and current hearing bookings for a courtroom.",
      },
      { property: "og:title", content: "Courtroom detail — NyaySetu" },
      {
        property: "og:description",
        content: "Capacity, type and current hearing bookings for a courtroom.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourtroomDetail,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Courtroom not found.</div>
  ),
});

function CourtroomDetail() {
  const { courtroomId } = Route.useParams();
  const courtrooms = useQuery(courtroomsQuery);
  const schedules = useQuery(schedulesQuery);

  const room = courtrooms.data?.find((c) => c.id === courtroomId);
  const bookings = useMemo(
    () => (schedules.data ?? []).filter((s) => s.courtroom_id === courtroomId),
    [schedules.data, courtroomId],
  );
  const active = bookings.filter((s) => isActive(s.status));

  if (courtrooms.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <ErrorState
          title="Could not load this courtroom"
          error={courtrooms.error}
          onRetry={() => void courtrooms.refetch()}
          retrying={courtrooms.isFetching}
        />
      </div>
    );
  }

  if (courtrooms.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">
          This courtroom no longer exists in the registry.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/courtrooms">Back to courtrooms</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/courtrooms">
          <ArrowLeft className="size-4" /> All courtrooms
        </Link>
      </Button>

      <PageHeader
        eyebrow="Facility"
        title={room.name}
        description={`${room.type || "general"} courtroom · seats ${room.capacity ?? 0}`}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {room.capacity ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {room.current_allocation ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationBadge bookings={active.length} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bookings" className="mt-8">
        <TabsList>
          <TabsTrigger value="bookings">Current bookings</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case number</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Hearing slot</TableHead>
                  <TableHead>Judge</TableHead>
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
                {!schedules.isLoading && bookings.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No hearings booked in this courtroom yet.
                    </TableCell>
                  </TableRow>
                )}
                {bookings.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.cases?.case_number ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {s.cases?.parties || "—"}
                    </TableCell>
                    <TableCell>{formatSlot(s.hearing_slots)}</TableCell>
                    <TableCell>{s.judges?.name ?? "—"}</TableCell>
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
          <AvailabilityPanel entityType="courtroom" entityId={room.id} entityName={room.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
