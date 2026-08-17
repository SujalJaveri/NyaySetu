import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Gavel, ListOrdered, ScrollText, ShieldCheck, Timer } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import {
  computeGovernanceMetrics,
  formatDays,
  formatTimestamp,
  governanceDataQuery,
} from "@/lib/governance";
import { downloadCompliancePdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/governance")({
  head: () => ({
    meta: [
      { title: "Governance & Compliance — NyayaSetu" },
      {
        name: "description",
        content:
          "Audit evidence for Regulation 9: recommendation acceptance and override rates, manual cause list overrides, priority tier distribution and Tier 1 listing turnaround.",
      },
      { property: "og:title", content: "Governance & Compliance — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Audit evidence for Regulation 9: recommendation acceptance and override rates, manual cause list overrides, priority tier distribution and Tier 1 listing turnaround.",
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
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function Page() {
  const query = useQuery(governanceDataQuery);
  const metrics = useMemo(
    () => (query.data ? computeGovernanceMetrics(query.data) : null),
    [query.data],
  );

  const generatedFor =
    "Continuous monitoring evidence — Regulation 9, Draft Regulations for the Use of AI in Courts";

  const handleDownload = () => {
    if (!metrics) return;
    void downloadCompliancePdf({
      generatedFor,
      summaryLine: metrics.summaryLine,
      issued: metrics.issued,
      outcomes: metrics.outcomes,
      overrides: [
        { label: "Manual cause list reorders recorded", value: String(metrics.reorderCount) },
        {
          label: "Manual orders cleared (reverted to suggested order)",
          value: String(metrics.reorderResetCount),
        },
        { label: "Active listings in the system", value: String(metrics.listingsSchedulesCount) },
        {
          label: "Reorders as a share of listings",
          value:
            metrics.reorderRatePercent === null
              ? "No listings recorded"
              : `${metrics.reorderRatePercent}%`,
        },
        {
          label: "Observation window",
          value:
            metrics.reorderWindowDays === null
              ? "Insufficient audit history"
              : `${metrics.reorderWindowDays} days of audit history`,
        },
      ],

      tiers: metrics.tierCounts,
      tierOne: [
        {
          label: "Average time from Tier 1 registration to first listed hearing",
          value: formatDays(metrics.tierOneToHearingDays),
        },
        { label: "Tier 1 cases measured", value: String(metrics.tierOneSampleSize) },
        { label: "Tier 1 cases still unlisted", value: String(metrics.tierOneUnscheduled) },
      ],
      auditWindow: {
        entries: metrics.auditEntries,
        from: formatTimestamp(metrics.firstAudit),
        to: formatTimestamp(metrics.lastAudit),
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Oversight"
        title="Governance & Compliance"
        description="An aggregate audit view of this system's own assisted activity — what it recommended, what registrars did with those recommendations, and how cases moved through the priority tiers."
        actions={
          <Button onClick={handleDownload} disabled={!metrics}>
            <Download className="size-4" />
            Download Compliance Report
          </Button>
        }
      />

      <Alert>
        <ShieldCheck className="size-4" />
        <AlertTitle>Regulation 9 — continuous monitoring and periodic audits</AlertTitle>
        <AlertDescription>
          <p>
            The Supreme Court's Draft Regulations for the Use of AI in Courts require that
            AI-assisted tools be continuously monitored and periodically audited. This page is that
            monitoring surface: it reports, from live records, how often the scheduling engine's
            recommendations were followed, how often a human registrar overrode them, and how the
            case load is distributed across statutory priority tiers. Every action counted here is
            traceable to an individual entry in the{" "}
            <Link to="/activity-log" className="font-medium underline underline-offset-4">
              Activity Log
            </Link>
            . No figure on this page is estimated, projected or generated — where there is no data,
            the measure reports that instead of a number.
          </p>
        </AlertDescription>
      </Alert>

      {query.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState
          title="Compliance data unavailable"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      )}

      {metrics && (
        <>
          <Card className="border-primary/30 bg-secondary/40">
            <CardContent className="p-6">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Audit summary
              </p>
              <p className="mt-3 text-base leading-relaxed font-medium text-foreground">
                {metrics.summaryLine}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Recommendations issued"
              value={metrics.issued}
              hint="Every listing suggestion the engine has produced and stored."
              icon={Gavel}
            />
            <Metric
              label="Accepted unmodified"
              value={`${metrics.acceptedPercent}%`}
              hint={`${metrics.accepted} of ${metrics.issued} taken exactly as recommended.`}
              icon={ShieldCheck}
            />
            <Metric
              label="Overridden by a registrar"
              value={`${metrics.overriddenPercent}%`}
              hint={`${metrics.modified} modified and ${metrics.rejected} rejected.`}
              icon={ListOrdered}
            />
            <Metric
              label="Audit entries examined"
              value={metrics.auditEntries}
              hint={`${formatTimestamp(metrics.firstAudit)} to ${formatTimestamp(metrics.lastAudit)}.`}
              icon={ScrollText}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendation outcomes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {metrics.issued === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No recommendations have been issued in this environment yet.
                  </p>
                )}
                {metrics.issued > 0 &&
                  metrics.outcomes.map((o) => (
                    <div key={o.label} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground">{o.label}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {o.percent}% <span className="text-muted-foreground">({o.count})</span>
                        </span>
                      </div>
                      <Progress value={o.percent} />
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Human overrides — cause list</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Manual reorders recorded</span>
                  <span className="text-lg font-semibold tabular-nums">{metrics.reorderCount}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Manual orders cleared</span>
                  <span className="font-semibold tabular-nums">{metrics.reorderResetCount}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Reorders per listing in the system</span>
                  <span className="font-semibold tabular-nums">
                    {metrics.reorderRatePercent === null ? "—" : `${metrics.reorderRatePercent}%`}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Observation window</span>
                  <span className="font-semibold tabular-nums">
                    {metrics.reorderWindowDays === null ? "—" : `${metrics.reorderWindowDays} days`}
                  </span>
                </div>
                <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  A reorder is a registrar moving a case away from the position the engine
                  suggested. Each one is written to the audit trail with the case number and both
                  positions, and is reviewable on the{" "}
                  <Link to="/cause-list" className="underline underline-offset-4">
                    Cause List
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Priority tier distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {metrics.tierCounts.map((t) => (
                  <div key={t.tier} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <Badge variant={t.tier === "Tier 1" ? "default" : "secondary"}>
                          {t.tier}
                        </Badge>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {t.count} <span className="text-muted-foreground">({t.percent}%)</span>
                      </span>
                    </div>
                    <Progress value={t.percent} />
                  </div>
                ))}
                <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  Tiers are assigned by the deterministic priority engine from statutory categories,
                  pending duration and adjournment history. Each case's own breakdown is shown on
                  its detail page.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tier 1 responsiveness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">
                      Average time from a case entering Tier 1 to its first listed hearing
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Measured from registration, when the tier is computed, to the creation of the
                      first hearing listing for that case.
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-2xl font-semibold tabular-nums">
                    <Timer className="size-5 text-muted-foreground" />
                    {formatDays(metrics.tierOneToHearingDays)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
                  <span className="text-muted-foreground">Tier 1 cases measured</span>
                  <span className="font-semibold tabular-nums">{metrics.tierOneSampleSize}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Tier 1 cases still unlisted</span>
                  <span className="font-semibold tabular-nums">{metrics.tierOneUnscheduled}</span>
                </div>
                {metrics.tierOneToHearingDays === null && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    No Tier 1 case has yet been listed, so no average can be reported.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How this would be audited</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                An auditor can reconcile every number on this page against source records.
                Recommendation counts come from the stored recommendation register; each entry names
                the case, the suggested judge, courtroom and slot, and the reasoning shown to the
                registrar at the time. Outcome percentages come from the decision recorded against
                each of those entries.
              </p>
              <p>
                Override counts come from the audit trail, which records who reordered which case,
                from which position to which. Tier distribution and Tier 1 turnaround come from the
                case register itself, and each case's score is reproducible from its own "Why This
                Order" breakdown — the engine is deterministic, so the same inputs always produce
                the same tier.
              </p>
              <p>
                The exported report carries the same figures with a generation timestamp, so it can
                be filed as a periodic audit record.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
