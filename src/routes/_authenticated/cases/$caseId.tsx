import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";

import { downloadCaseReportPdf } from "@/lib/pdf";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adjournmentsQuery,
  casesQuery,
  formatDate,
  statusLabel,
  type CaseStatus,
} from "@/lib/cases";
import { formatSlot, isActive, schedulesQuery } from "@/lib/registry";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { recordAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { WhyThisOrderPanel } from "@/components/why-this-order";
import { CaseTimeline } from "@/components/case-timeline";
import { buildCaseTimeline } from "@/lib/case-timeline";
import { StoredReasoning } from "@/components/reasoning-list";
import { CaseSchedulingPanel, SCHEDULABLE_STATUSES } from "@/components/case-scheduling-panel";

import { ErrorState } from "@/components/states";
import { scheduleRecommendationQuery } from "@/lib/recommendations";
import {
  computePriority,
  prioritySettingsQuery,
  recomputeCasePriority,
  priorityInputFromCase,
} from "@/lib/priority";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — NyayaSetu" },
      {
        name: "description",
        content: "Full case particulars, adjournment history and current hearing schedule.",
      },
      { property: "og:title", content: "Case detail — NyayaSetu" },
      {
        property: "og:description",
        content: "Full case particulars, adjournment history and current hearing schedule.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseDetail,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Case not found.</div>,
});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function CaseDetail() {
  const { caseId } = Route.useParams();
  const cases = useQuery(casesQuery);
  const schedules = useQuery(schedulesQuery);
  const adjournments = useQuery(adjournmentsQuery(caseId));
  const settings = useQuery(prioritySettingsQuery);
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const isAdmin = staff.data?.role === "admin";

  const rescore = useMutation({
    mutationFn: async (flag?: boolean) => {
      if (flag !== undefined) {
        const { error } = await supabase
          .from("cases")
          .update({ legal_priority_flag: flag })
          .eq("id", caseId);
        if (!error)
          await recordAudit(
            `${flag ? "Applied" : "Removed"} legal/administrative priority boost on case ${record?.case_number ?? caseId}`,
            `case:${record?.case_number ?? caseId}`,
          );
        if (error) throw error;
      }
      return recomputeCasePriority(caseId);
    },
    onSuccess: (breakdown) => {
      toast.success(`Priority recalculated — ${breakdown.score}/100.`);
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStatutory = useMutation({
    mutationFn: async (patch: {
      is_ftsc_pocso?: boolean;
      senior_citizen_litigant?: boolean;
      property_dispute_5yr_plus?: boolean;
      statutory_limitation_deadline?: string | null;
    }) => {
      const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
      if (error) throw error;
      await recordAudit(
        `Updated statutory priority categories on case ${record?.case_number ?? caseId}`,
        `case:${record?.case_number ?? caseId}`,
      );
      return recomputeCasePriority(caseId);
    },
    onSuccess: (breakdown) => {
      toast.success(
        `Statutory category updated — Priority ${breakdown.score}/100 (${breakdown.tier}).`,
      );
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const record = cases.data?.find((c) => c.id === caseId);
  const caseSchedules = (schedules.data ?? []).filter((s) => s.cases?.id === caseId);
  const current = caseSchedules.find((s) => isActive(s.status));
  const recommendation = useQuery({ ...scheduleRecommendationQuery(current?.id) });

  if (cases.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <ErrorState
          title="Could not load this case"
          error={cases.error}
          onRetry={() => void cases.refetch()}
          retrying={cases.isFetching}
        />
      </div>
    );
  }

  if (cases.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8 sm:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">This case is no longer in the registry.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/cases">Back to cases</Link>
        </Button>
      </div>
    );
  }

  const handleDownloadReport = async () => {
    try {
      await downloadCaseReportPdf({
        caseNumber: record.case_number,
        category: record.case_categories?.name ?? "Uncategorised",
        status: record.status,
        filingDate: record.filing_date,
        pendingDays: record.pending_duration_days,
        estimatedMinutes: record.estimated_duration_minutes,
        adjournments: record.previous_adjournments,
        priorityScore: record.priority_score,
        parties: record.parties,
        breakdown: settings.data
          ? computePriority(priorityInputFromCase(record), settings.data)
          : null,
        schedule: current
          ? {
              slot: formatSlot(current.hearing_slots),
              judge: current.judges?.name ?? "Unassigned",
              courtroom: current.courtrooms?.name ?? "Unassigned",
              status: current.status,
            }
          : null,
        adjournmentHistory: (adjournments.data ?? []).map((a) => ({
          recorded: formatDate(a.created_at),
          reason: a.reason || "—",
          slot: formatSlot(a.hearing_slots),
        })),
      });
      toast.success("Case report downloaded.");
    } catch {
      toast.error("Could not generate the case report PDF.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/cases">
          <ArrowLeft className="size-4" /> All cases
        </Link>
      </Button>

      <PageHeader
        eyebrow={record.case_categories?.name ?? "Uncategorised"}
        title={record.case_number}
        description={record.parties || "Parties not recorded"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={record.status === "disposed" ? "secondary" : "default"}>
              {statusLabel[record.status as CaseStatus] ?? record.status}
            </Badge>
            <PriorityBadge score={record.priority_score} />
            <Button variant="outline" size="sm" onClick={() => void handleDownloadReport()}>
              <Download className="size-4" /> Download Case Report
            </Button>
          </div>
        }
      />

      {record.is_example && (
        <div className="mt-6 rounded-lg border border-accent/50 bg-accent/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-accent text-accent">
              Example
            </Badge>
            <p className="text-sm font-semibold text-foreground">
              {record.example_label ?? "Walkthrough case"}
            </p>
          </div>
          {record.example_note && (
            <p className="mt-2 text-sm text-muted-foreground">{record.example_note}</p>
          )}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Case particulars</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Field label="Case number">{record.case_number}</Field>
          <Field label="Category">{record.case_categories?.name ?? "—"}</Field>
          <Field label="Status">{statusLabel[record.status as CaseStatus] ?? record.status}</Field>
          <Field label="Filing date">{formatDate(record.filing_date)}</Field>
          <Field label="Pending duration">{record.pending_duration_days} days</Field>
          <Field label="Estimated hearing">{record.estimated_duration_minutes} minutes</Field>
          <Field label="Previous adjournments">{record.previous_adjournments}</Field>
          <Field label="Priority Score">
            <PriorityBadge score={record.priority_score} />
          </Field>
          <Field label="Priority tier">
            <Badge variant={record.priority_tier === "Tier 1" ? "default" : "secondary"}>
              {record.priority_tier ?? "Not scored"}
            </Badge>
          </Field>
          <Field label="Registered">{formatDate(record.created_at)}</Field>
          <div className="sm:col-span-3">
            <Field label="Parties involved">{record.parties || "—"}</Field>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Statutory Priority Categories</CardTitle>
          <p className="text-sm text-muted-foreground">
            Entered by the registrar from documented case facts. Changing any of these rescores the
            case immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              {
                key: "is_ftsc_pocso",
                label: "Fast Track Special Court / POCSO matter",
                value: record.is_ftsc_pocso,
              },
              {
                key: "senior_citizen_litigant",
                label: "Senior citizen litigant",
                value: record.senior_citizen_litigant,
              },
              {
                key: "property_dispute_5yr_plus",
                label: "Property dispute pending 5 years or more",
                value: record.property_dispute_5yr_plus,
              },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <Label htmlFor={item.key} className="text-sm font-normal">
                {item.label}
              </Label>
              <Switch
                id={item.key}
                checked={item.value}
                disabled={updateStatutory.isPending}
                onCheckedChange={(checked) => updateStatutory.mutate({ [item.key]: checked })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <Label htmlFor="limitation-deadline" className="text-sm font-normal">
              Statutory limitation deadline
            </Label>
            <Input
              id="limitation-deadline"
              type="date"
              className="w-48"
              disabled={updateStatutory.isPending}
              defaultValue={record.statutory_limitation_deadline ?? ""}
              onChange={(e) =>
                updateStatutory.mutate({ statutory_limitation_deadline: e.target.value || null })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <CaseTimeline
          steps={buildCaseTimeline(record, schedules.data ?? [], adjournments.data ?? [])}
        />
      </div>

      {settings.data && (
        <div className="mt-8">
          <WhyThisOrderPanel
            caseNumber={record.case_number}
            breakdown={computePriority(priorityInputFromCase(record), settings.data)}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="priority-flag"
                    checked={record.legal_priority_flag}
                    disabled={!isAdmin || rescore.isPending}
                    onCheckedChange={(checked) => rescore.mutate(checked)}
                  />
                  <Label htmlFor="priority-flag" className="text-sm font-normal">
                    Legal / administrative priority
                    {!isAdmin && <span className="text-muted-foreground"> — admins only</span>}
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rescore.isPending}
                  onClick={() => rescore.mutate(undefined)}
                >
                  <RefreshCw className="size-4" /> Recalculate
                </Button>
              </div>
            }
          />
          {record.priority_score !== null &&
            Math.abs(
              (record.priority_score ?? 0) -
                computePriority(priorityInputFromCase(record), settings.data).score,
            ) > 0.05 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Stored score is {record.priority_score}; recalculate to store the figure shown
                above.
              </p>
            )}
        </div>
      )}

      <h2 className="mt-8 text-base font-semibold text-foreground">Current schedule</h2>
      <Card className="mt-3">
        <CardContent className="pt-6">
          {current ? (
            <div className="grid gap-5 sm:grid-cols-4">
              <Field label="Hearing slot">{formatSlot(current.hearing_slots)}</Field>
              <Field label="Judge">{current.judges?.name ?? "Unassigned"}</Field>
              <Field label="Courtroom">{current.courtrooms?.name ?? "Unassigned"}</Field>
              <Field label="Schedule status">
                <Badge>{current.status}</Badge>
              </Field>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              This case has no active hearing scheduled yet. Use “Schedule This Case” below to run
              the scheduling engine without leaving this page.
            </p>
          )}
        </CardContent>
      </Card>

      {!current && SCHEDULABLE_STATUSES.includes(record.status) && (
        <CaseSchedulingPanel caseRow={record} />
      )}

      {current && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Scheduling recommendation</CardTitle>
            <p className="text-sm text-muted-foreground">
              The deterministic reasoning recorded when a registrar decided on this listing —
              decision support only, a human always makes the final call.
            </p>
          </CardHeader>
          <CardContent>
            {recommendation.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : recommendation.isError ? (
              <p className="text-sm text-destructive">
                Could not load the recommendation reasoning.
              </p>
            ) : recommendation.data ? (
              <div className="space-y-3">
                <Badge variant="secondary" className="capitalize">
                  Decision: {recommendation.data.status}
                </Badge>
                <StoredReasoning text={recommendation.data.reasoning ?? ""} heading="Reasoning" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This listing was recorded without a scheduling recommendation; no reasoning is
                stored against it.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <h2 className="mt-8 text-base font-semibold text-foreground">Adjournment history</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recorded</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Previous slot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjournments.isLoading && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!adjournments.isLoading && (adjournments.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-12 text-center text-sm text-muted-foreground">
                  No adjournments recorded for this case.
                </TableCell>
              </TableRow>
            )}
            {(adjournments.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>{formatDate(a.created_at)}</TableCell>
                <TableCell>{a.reason || "—"}</TableCell>
                <TableCell>{formatSlot(a.hearing_slots)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
