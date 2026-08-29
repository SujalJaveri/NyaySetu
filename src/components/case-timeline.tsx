import { Calendar, CheckCircle2, Clock, FileText, Gavel, HelpCircle, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, type AdjournmentRow, type CaseRow } from "@/lib/cases";

export type TimelineEvent = {
  id: string;
  title: string;
  date: string;
  type: "filing" | "adjournment" | "hearing" | "disposal" | "statutory";
  detail: string;
  badge?: string | undefined;
  badgeVariant?: "default" | "destructive" | "outline" | "secondary" | undefined;
};

type CaseTimelineProps = {
  caseData: CaseRow;
  adjournments?: AdjournmentRow[];
  nextHearingSlot?: {
    date: string;
    start_time: string;
    end_time: string;
    judge_name?: string | null;
    courtroom_name?: string | null;
  } | null;
};

export function CaseTimeline({ caseData, adjournments = [], nextHearingSlot }: CaseTimelineProps) {
  const events: TimelineEvent[] = [];

  // 1. Initial Filing
  events.push({
    id: "filing",
    title: "Case Instituted & Registered",
    date: caseData.filing_date,
    type: "filing",
    detail: `Filed under ${caseData.case_categories?.name || "General Category"}. Case Reference: ${caseData.case_number}`,
    badge: caseData.cnr_number ? `CNR: ${caseData.cnr_number}` : undefined,
    badgeVariant: "outline",
  });

  // 2. Statutory limitation if present
  if (caseData.statutory_limitation_deadline) {
    events.push({
      id: "limitation",
      title: "Statutory Limitation Bar Date",
      date: caseData.statutory_limitation_deadline,
      type: "statutory",
      detail: "Limitation Act deadline for statutory disposal/listing.",
      badge: "Statutory Horizon",
      badgeVariant: "destructive",
    });
  }

  // 3. Past Adjournments
  adjournments.forEach((adj, idx) => {
    const slotInfo = adj.hearing_slots
      ? ` (${formatDate(adj.hearing_slots.date)} at ${adj.hearing_slots.start_time.slice(0, 5)})`
      : "";
    events.push({
      id: `adj-${adj.id}`,
      title: `Adjournment #${adjournments.length - idx}`,
      date: adj.created_at.slice(0, 10),
      type: "adjournment",
      detail: adj.reason || "Adjourned on request of counsel/parties." + slotInfo,
      badge: "Deferred",
      badgeVariant: "secondary",
    });
  });

  // 4. Next scheduled hearing
  if (nextHearingSlot) {
    events.push({
      id: "next-hearing",
      title: "Next Scheduled Hearing",
      date: nextHearingSlot.date,
      type: "hearing",
      detail: `Listed before ${nextHearingSlot.judge_name || "Assigned Bench"} in ${nextHearingSlot.courtroom_name || "Court Hall"} (${nextHearingSlot.start_time.slice(0, 5)}–${nextHearingSlot.end_time.slice(0, 5)})`,
      badge: "Active Listing",
      badgeVariant: "default",
    });
  }

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  const getIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "filing":
        return <FileText className="h-4 w-4 text-primary" />;
      case "adjournment":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "hearing":
        return <Gavel className="h-4 w-4 text-emerald-500" />;
      case "statutory":
        return <CheckCircle2 className="h-4 w-4 text-destructive" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4 text-primary" />
            Procedural Case Timeline
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {events.length} Event{events.length === 1 ? "" : "s"} Recorded
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-border">
          {events.map((event) => (
            <div key={event.id} className="relative mb-6 last:mb-0">
              <div className="absolute -left-[30px] top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-xs">
                {getIcon(event.type)}
              </div>
              <div className="rounded-lg border bg-card/60 p-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-foreground text-sm">{event.title}</span>
                  <div className="flex items-center gap-2">
                    {event.badge && (
                      <Badge variant={event.badgeVariant ?? "outline"} className="text-[11px]">
                        {event.badge}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
