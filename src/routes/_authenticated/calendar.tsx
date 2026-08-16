import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Gavel,
  MapPin,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { downloadSchedulePdf } from "@/lib/pdf";

import { PageHeader } from "@/components/page-shell";
import { ErrorState } from "@/components/states";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDate, statusLabel } from "@/lib/cases";
import {
  addDays,
  calendarQuery,
  entryAccent,
  groupBy,
  timeRange,
  todayISO,
  type CalendarEntry,
} from "@/lib/calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — NyaySetu" },
      {
        name: "description",
        content:
          "Daily, judge-wise, courtroom-wise and case-wise views of every scheduled hearing.",
      },
      { property: "og:title", content: "Calendar — NyaySetu" },
      {
        property: "og:description",
        content:
          "Daily, judge-wise, courtroom-wise and case-wise views of every scheduled hearing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type View = "daily" | "judge" | "courtroom" | "case";
type ColourMode = "priority" | "status";

const VIEWS: { value: View; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "judge", label: "Judge-wise" },
  { value: "courtroom", label: "Courtroom-wise" },
  { value: "case", label: "Case-wise" },
];

function Page() {
  const entries = useQuery(calendarQuery);
  const [view, setView] = useState<View>("daily");
  const [colour, setColour] = useState<ColourMode>("priority");
  const [anchor, setAnchor] = useState(todayISO());
  const [focus, setFocus] = useState("all");

  const rangeEnd = addDays(anchor, 6);
  const all = entries.data ?? [];

  const focusOptions = useMemo(() => {
    if (view === "judge") return Array.from(new Set(all.map((e) => e.judgeName))).sort();
    if (view === "courtroom") return Array.from(new Set(all.map((e) => e.courtroomName))).sort();
    return [];
  }, [all, view]);

  const visible = useMemo(() => {
    const inRange =
      view === "daily"
        ? all.filter((e) => e.date === anchor)
        : all.filter((e) => e.date >= anchor && e.date <= rangeEnd);
    if (focus === "all") return inRange;
    if (view === "judge") return inRange.filter((e) => e.judgeName === focus);
    if (view === "courtroom") return inRange.filter((e) => e.courtroomName === focus);
    return inRange;
  }, [all, view, anchor, rangeEnd, focus]);

  const groups = useMemo(() => {
    if (view === "judge") return groupBy(visible, (e) => e.judgeName);
    if (view === "courtroom") return groupBy(visible, (e) => e.courtroomName);
    if (view === "case") return groupBy(visible, (e) => e.caseNumber);
    return groupBy(visible, (e) => e.startTime);
  }, [visible, view]);

  const step = view === "daily" ? 1 : 7;
  const rangeLabel =
    view === "daily" ? formatDate(anchor) : `${formatDate(anchor)} — ${formatDate(rangeEnd)}`;
  const scopeLabel =
    focus !== "all"
      ? focus
      : view === "judge"
        ? "All judges"
        : view === "courtroom"
          ? "All courtrooms"
          : "All sittings";

  const handleDownload = async () => {
    try {
      await downloadSchedulePdf({
        title: "Cause list",
        rangeLabel,
        scopeLabel,
        entries: visible,
      });
      toast.success("Schedule PDF downloaded.");
    } catch {
      toast.error("Could not generate the schedule PDF.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Scheduling"
        title="Calendar"
        description="Every scheduled hearing, viewed by day, judge, courtroom or case. Select an entry for its full listing."
        actions={
          <Button
            variant="outline"
            onClick={() => void handleDownload()}
            disabled={entries.isLoading}
          >
            <Download className="size-4" /> Download Schedule
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <Tabs
          value={view}
          onValueChange={(v) => {
            setView(v as View);
            setFocus("all");
          }}
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            {VIEWS.map((v) => (
              <TabsTrigger key={v.value} value={v.value}>
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cal-date">{view === "daily" ? "Date" : "Week starting"}</Label>
            <Input
              id="cal-date"
              type="date"
              className="w-44"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value || todayISO())}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous"
              onClick={() => setAnchor(addDays(anchor, -step))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next"
              onClick={() => setAnchor(addDays(anchor, step))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setAnchor(todayISO())}>
              Today
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-colour">Colour by</Label>
            <Select value={colour} onValueChange={(v) => setColour(v as ColourMode)}>
              <SelectTrigger id="cal-colour" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Case priority</SelectItem>
                <SelectItem value="status">Schedule status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {focusOptions.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="cal-focus">{view === "judge" ? "Judge" : "Courtroom"}</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger id="cal-focus" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {view === "judge" ? "All judges" : "All courtrooms"}
                  </SelectItem>
                  {focusOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {rangeLabel} · {scopeLabel} · {visible.length} hearing{visible.length === 1 ? "" : "s"}
        </p>
      </div>

      {entries.isError ? (
        <ErrorState
          title="Could not load the cause list"
          error={entries.error}
          onRetry={() => void entries.refetch()}
          retrying={entries.isFetching}
        />
      ) : entries.isLoading ? (
        <Card className="mt-6 shadow-panel">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading the cause list…
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="mt-6 shadow-panel">
          <CardContent className="py-16 text-center">
            <CalendarDays className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No hearings listed for this {view === "daily" ? "date" : "week"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.map(([key, rows]) => (
            <Card key={key} className="shadow-panel">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  {view === "daily" && <CalendarDays className="size-4 text-primary" />}
                  {view === "judge" && <Gavel className="size-4 text-primary" />}
                  {view === "courtroom" && <MapPin className="size-4 text-primary" />}
                  {view === "case" && <Scale className="size-4 text-primary" />}
                  {view === "daily" ? key.slice(0, 5) : key}
                </CardTitle>
                <Badge variant="secondary">
                  {rows.length} hearing{rows.length === 1 ? "" : "s"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {rows.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} view={view} colour={colour} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  view,
  colour,
}: {
  entry: CalendarEntry;
  view: View;
  colour: ColourMode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-l-4 border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
            entryAccent(entry, colour),
          )}
        >
          <span className="font-medium text-foreground">{entry.caseNumber}</span>
          <span className="text-muted-foreground">
            {view === "daily"
              ? timeRange(entry)
              : `${formatDate(entry.date)} · ${timeRange(entry)}`}
          </span>
          {view !== "judge" && <span className="text-muted-foreground">{entry.judgeName}</span>}
          {view !== "courtroom" && (
            <span className="text-muted-foreground">{entry.courtroomName}</span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {colour === "priority" ? (
              <PriorityBadge score={entry.priorityScore} />
            ) : (
              <Badge variant="outline" className="capitalize">
                {entry.status}
              </Badge>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{entry.caseNumber}</p>
            <PriorityBadge score={entry.priorityScore} />
          </div>
          <dl className="space-y-1.5 text-sm">
            <Row label="Judge" value={entry.judgeName} />
            <Row label="Courtroom" value={entry.courtroomName} />
            <Row label="Time" value={`${formatDate(entry.date)} · ${timeRange(entry)}`} />
            <Row label="Category" value={entry.categoryName ?? "Uncategorised"} />
            <Row
              label="Case status"
              value={entry.caseStatus ? statusLabel[entry.caseStatus] : "—"}
            />
            <Row label="Listing" value={entry.status} />
            {entry.parties && <Row label="Parties" value={entry.parties} />}
          </dl>
          {entry.caseId && (
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link to="/cases/$caseId" params={{ caseId: entry.caseId }}>
                Open case detail
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-foreground">{value}</dd>
    </div>
  );
}
