import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Info, ListOrdered, Lock, Scale, Search } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { prioritySettingsQuery } from "@/lib/priority";
import { causeListQuery, formatSlotTime } from "@/lib/cause-list";
import { formatSlot, isActive, schedulesQuery, MAX_JUDGE_WORKLOAD } from "@/lib/registry";
import { checkCourtHoliday } from "@/lib/holidays";
import { casesQuery } from "@/lib/cases";
import { PriorityBadge } from "@/components/priority-badge";
import { CustomJudicialScheduleModal } from "@/components/custom-judicial-schedule-modal";

export const Route = createFileRoute("/_authenticated/bench")({
  head: () => ({
    meta: [
      { title: "My Bench — NyayaSetu" },
      {
        name: "description",
        content:
          "A judge's own hearing calendar, daily cause list and workload summary, with the recorded reasoning behind each listing.",
      },
      { property: "og:title", content: "My Bench — NyayaSetu" },
      {
        property: "og:description",
        content:
          "A judge's own hearing calendar, daily cause list and workload summary, with the recorded reasoning behind each listing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BenchPage,
});

const today = () => new Date().toISOString().slice(0, 10);

const tierStyles: Record<string, string> = {
  "Tier 1": "border-destructive/30 bg-destructive/10 text-destructive",
  "Tier 2": "border-accent/40 bg-accent text-accent-foreground",
  "Tier 3": "border-border bg-muted text-muted-foreground",
};

function BenchPage() {
  const staff = useCurrentStaff();
  const [date, setDate] = useState(today);

  const settings = useQuery(prioritySettingsQuery);
  const schedules = useQuery(schedulesQuery);
  const listing = useQuery(causeListQuery(date, settings.data ?? null));
  const cases = useQuery(casesQuery);
  const [pendingSearch, setPendingSearch] = useState("");

  const judgeId = staff.data?.judgeId ?? null;

  const pendingCases = useMemo(() => {
    return (cases.data ?? [])
      .filter((c) => ["filed", "adjourned"].includes(c.status))
      .filter((c) => {
        if (!pendingSearch.trim()) return true;
        const q = pendingSearch.toLowerCase();
        return (
          c.case_number.toLowerCase().includes(q) ||
          c.parties.toLowerCase().includes(q) ||
          (c.case_categories?.name ?? "").toLowerCase().includes(q)
        );
      });
  }, [cases.data, pendingSearch]);

  const mine = useMemo(
    () => (schedules.data ?? []).filter((s) => !judgeId || s.judge_id === judgeId),
    [schedules.data, judgeId],
  );

  const active = mine.filter((s) => isActive(s.status));
  const upcoming = useMemo(
    () =>
      active
        .filter((s) => s.hearing_slots && s.hearing_slots.date >= today())
        .sort((a, b) =>
          `${a.hearing_slots!.date}${a.hearing_slots!.start_time}`.localeCompare(
            `${b.hearing_slots!.date}${b.hearing_slots!.start_time}`,
          ),
        ),
    [active],
  );

  const dayEntries = useMemo(
    () =>
      (listing.data ?? [])
        .filter((e) => !judgeId || e.judgeId === judgeId)
        .sort(
          (a, b) =>
            (a.position ?? 999) - (b.position ?? 999) || a.startTime.localeCompare(b.startTime),
        ),
    [listing.data, judgeId],
  );

  const workloadPct = Math.min(100, Math.round((active.length / MAX_JUDGE_WORKLOAD) * 100));

  if (staff.isLoading) return <LoadingState label="Loading your bench…" />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My Bench"
        description={
          staff.data?.judgeName
            ? `Listings, cause list and workload for ${staff.data.judgeName}.`
            : "Listings, cause list and workload for your bench."
        }
      />

      {!judgeId && (
        <Card className="border-accent/40 bg-accent/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Your login is not yet linked to a judge record. Ask the registry administrator to link
              your account on the Judges screen; until then no listings can be shown.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active listings"
          value={String(active.length)}
          hint="Proposed and confirmed"
        />
        <SummaryCard
          label="Upcoming hearings"
          value={String(upcoming.length)}
          hint="Today onwards"
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">
              {active.length}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {MAX_JUDGE_WORKLOAD}
              </span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={workloadPct >= 90 ? "h-full bg-destructive" : "h-full bg-primary"}
                style={{ width: `${workloadPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {workloadPct}% of the registry ceiling
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cause-list">
        <TabsList>
          <TabsTrigger value="cause-list" className="gap-2">
            <ListOrdered className="size-4" /> Cause list
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="size-4" /> My calendar
          </TabsTrigger>
          <TabsTrigger value="direct-scheduling" className="gap-2">
            <Scale className="size-4 text-primary" /> Direct Bench Listing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cause-list" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <Label htmlFor="bench-date">Hearing date</Label>
              <Input
                id="bench-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Read-only — the order is settled by the registrar.
            </p>
          </div>

          {checkCourtHoliday(date).isHoliday && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span className="font-semibold">Court Closure:</span>
              <span>
                {date} is a non-sitting court day ({checkCourtHoliday(date).holidayName || "Gazetted Holiday"}).
              </span>
            </div>
          )}

          {listing.isLoading || settings.isLoading ? (
            <LoadingState label="Loading the cause list…" />
          ) : listing.error ? (
            <ErrorState title="The cause list could not be loaded." error={listing.error} />
          ) : dayEntries.length === 0 ? (
            <EmptyState
              title="No listings for this date"
              description="Nothing is listed before your bench on the selected date."
            />
          ) : (
            <div className="space-y-3">
              {dayEntries.map((entry, index) => (
                <Card key={entry.scheduleId}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/cases/$caseId"
                            params={{ caseId: entry.caseId ?? "" }}
                            className="font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {entry.caseNumber}
                          </Link>
                          <Badge variant="outline" className={tierStyles[entry.tier]}>
                            {entry.tier}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatSlotTime(entry.startTime)}–{formatSlotTime(entry.endTime)} ·{" "}
                          {entry.courtroomName}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{entry.parties}</p>
                      <p className="mt-2 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <Info className="mt-0.5 size-3.5 shrink-0" />
                        <span>Why this order: {entry.reason}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          {schedules.isLoading ? (
            <LoadingState label="Loading your calendar…" />
          ) : schedules.error ? (
            <ErrorState title="Your calendar could not be loaded." error={schedules.error} />
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming hearings"
              description="Nothing is currently listed before your bench."
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((row) => (
                <Card key={row.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {row.cases?.case_number ?? "Unlinked listing"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{row.cases?.parties}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-foreground">{formatSlot(row.hearing_slots)}</p>
                      <p className="text-muted-foreground">
                        {row.courtrooms?.name ?? "Courtroom to be allotted"} · {row.status}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="direct-scheduling" className="mt-4 space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Scale className="size-4 text-primary" />
                Judicial Directive & Direct Bench Scheduling
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select any pending or unlisted case from the registry to schedule directly on your bench with a judicial directive note.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search case or parties…"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {cases.isLoading ? (
            <LoadingState label="Loading registry cases…" />
          ) : pendingCases.length === 0 ? (
            <EmptyState
              title="No pending cases found"
              description="No open cases match your search query."
            />
          ) : (
            <div className="space-y-3">
              {pendingCases.map((c) => (
                <Card key={c.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/cases/$caseId"
                          params={{ caseId: c.id }}
                          className="font-semibold text-foreground hover:text-primary hover:underline text-sm"
                        >
                          {c.case_number}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {c.case_categories?.name ?? "Uncategorised"}
                        </Badge>
                        <PriorityBadge score={c.priority_score} />
                        <span className="text-xs text-muted-foreground">
                          {c.estimated_duration_minutes} min est.
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.parties || "Parties on record"}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <CustomJudicialScheduleModal
                        caseRow={c}
                        preselectedJudgeId={judgeId ?? undefined}
                        triggerButton={
                          <Button size="sm" className="gap-1.5 text-xs">
                            <Scale className="size-3.5" />
                            Fix Hearing on My Bench
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
