import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Globe2,
  Landmark,
  LayoutDashboard,
  Network,
  Server,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture Preview — NyayaSetu" },
      {
        name: "description",
        content:
          "How NyayaSetu scales from a single district court to a state-level and national judicial network.",
      },
    ],
  }),
  component: Page,
});

/* ─────────────────────── tier node data ──────────────────────── */

const tiers = [
  {
    id: "district",
    label: "Tier 1 — District / Taluka Court",
    sublabel: "Current Prototype",
    badge: "Deployed",
    badgeVariant: "default" as const,
    icon: Landmark,
    color: "border-primary/40 bg-primary/5",
    iconColor: "text-primary",
    description:
      "A single registrar-facing web app handles case registration, scheduling, conflict detection, cause list generation, What-If Simulation, and the AI Copilot. All data lives in a Supabase PostgreSQL instance with RLS policies.",
    capabilities: [
      "Multi-constraint scheduling engine",
      "8-factor priority scoring",
      "What-If Simulation sandbox",
      "Batch cause list optimizer",
      "Conflict Detection (8 types)",
      "AI Registry Copilot (Gemini / Groq)",
      "Governance & audit trail",
      "PDF export",
    ],
    courts: ["District Court Pune", "District Court Nagpur", "Taluka Court Thane"],
  },
  {
    id: "state",
    label: "Tier 2 — State High Court Coordination",
    sublabel: "Planned — Phase 2",
    badge: "Roadmap",
    badgeVariant: "secondary" as const,
    icon: Building2,
    color: "border-accent/40 bg-accent/5",
    iconColor: "text-accent-foreground",
    description:
      "A read-only coordination layer aggregates anonymised scheduling telemetry from all district courts in a state. The High Court registry uses this to identify judicial vacancies, bench composition gaps, and cross-district cause list conflicts.",
    capabilities: [
      "Cross-district conflict scanning",
      "Judicial vacancy alerts",
      "State-level backlog analytics",
      "Cause list de-duplication across courts",
      "Bench composition recommendations",
      "Anonymised data federation (no PII shared)",
    ],
    courts: ["Bombay High Court", "Madras High Court", "Delhi High Court"],
  },
  {
    id: "national",
    label: "Tier 3 — National NJDG Integration",
    sublabel: "Planned — Phase 3",
    badge: "Vision",
    badgeVariant: "outline" as const,
    icon: Globe2,
    color: "border-border bg-muted/20",
    iconColor: "text-muted-foreground",
    description:
      "NyayaSetu exposes a secure API compatible with the NJDG (National Judicial Data Grid) schema. District and state scheduling decisions can be pushed to NJDG for national pendency dashboards, eliminating manual data entry by court staff.",
    capabilities: [
      "NJDG API push integration",
      "National pendency dashboard feeds",
      "Cross-HC cause list coordination",
      "Supreme Court reporting feeds",
      "NIC security audit compliance",
      "On-premise deployment option",
    ],
    courts: ["Supreme Court of India", "24 High Courts", "24,000+ District Courts"],
  },
];

/* ─────────────────────── data flow lines ──────────────────────── */

const dataFlows = [
  {
    from: "district",
    to: "state",
    label: "Anonymised scheduling telemetry",
    detail: "Case counts, slot utilisation, conflict rates — no PII",
  },
  {
    from: "state",
    to: "national",
    label: "Aggregated state analytics",
    detail: "Pendency trends, disposal rates, HC recommendations",
  },
  {
    from: "national",
    to: "district",
    label: "Policy updates & judicial allocations",
    detail: "National-level priority mandates propagate downward",
  },
];

/* ─────────────────────── tech stack per tier ─────────────────── */

const stackItems = [
  {
    icon: LayoutDashboard,
    label: "Frontend",
    value: "React 19 + TanStack Start",
  },
  { icon: Server, label: "Backend", value: "Nitro + Cloudflare Workers" },
  { icon: ShieldCheck, label: "Database", value: "Supabase PostgreSQL + RLS" },
  { icon: Network, label: "Auth", value: "Supabase Auth (JWT)" },
  { icon: Workflow, label: "AI Layer", value: "Gemini 3.5 Flash → Groq fallback" },
  { icon: Globe2, label: "Hosting", value: "Cloudflare global edge (150+ PoPs)" },
];

/* ─────────────────────── page component ────────────────────────── */

function TierNode({ tier }: { tier: (typeof tiers)[number] }) {
  const Icon = tier.icon;
  return (
    <Card className={cn("border shadow-panel", tier.color)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-card",
                tier.iconColor,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold leading-tight">
                {tier.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{tier.sublabel}</p>
            </div>
          </div>
          <Badge variant={tier.badgeVariant} className="shrink-0 text-xs">
            {tier.badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{tier.description}</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Capabilities
            </p>
            <ul className="space-y-1">
              {tier.capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-2 text-xs text-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Example Courts
            </p>
            <ul className="space-y-1">
              {tier.courts.map((court) => (
                <li key={court} className="text-xs text-muted-foreground">
                  {court}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArrowDown({ flow }: { flow: (typeof dataFlows)[number] }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="h-px w-24 bg-border" />
        <div className="h-4 w-px bg-border" />
        {/* arrow */}
        <svg width="12" height="8" viewBox="0 0 12 8" className="text-muted-foreground" fill="currentColor">
          <path d="M6 8L0 0h12L6 8z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{flow.label}</p>
        <p className="text-[11px] text-muted-foreground">{flow.detail}</p>
      </div>
    </div>
  );
}

function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        eyebrow="Administration"
        title="Architecture Preview"
        description="How NyayaSetu scales from a single district court registry to a nationwide judicial scheduling network integrated with NJDG."
      />

      {/* Scale indicator */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-primary">Scale</span>
        <span className="text-xs text-muted-foreground">1 District Court</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-xs font-semibold text-foreground">All District Courts in a State</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-xs font-semibold text-foreground">24,000+ Courts Nationally</span>
        <span className="ml-auto text-[10px] text-muted-foreground italic">
          Same codebase · different deployment scope
        </span>
      </div>

      {/* Tier diagram */}
      <div className="mt-6 space-y-2">
        {tiers.map((tier, i) => (
          <div key={tier.id}>
            <TierNode tier={tier} />
            {i < tiers.length - 1 && (
              <div className="flex justify-center py-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-4 w-px bg-border" />
                  <div className="rounded-sm border border-border bg-card px-3 py-1.5 text-center">
                    <p className="text-[11px] font-semibold text-foreground">
                      {dataFlows[i]?.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{dataFlows[i]?.detail}</p>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  {/* down arrow */}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor" className="text-muted-foreground">
                    <path d="M5 6L0 0h10L5 6z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Technology Stack</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stackItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5"
              >
                <Icon className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integration roadmap */}
      <div className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Workflow className="size-4 text-primary" />
          NJDG Integration Roadmap
        </h2>
        <div className="space-y-3">
          {[
            {
              phase: "Phase 1 (Complete)",
              desc: "Standalone district court prototype with full scheduling engine, Supabase backend, and AI Copilot",
              done: true,
            },
            {
              phase: "Phase 2 (3–6 months)",
              desc: "Pilot at 3 district courts in one state; data federation API; Hindi + regional language UI",
              done: false,
            },
            {
              phase: "Phase 3 (6–12 months)",
              desc: "NJDG push API integration; NIC security audit; on-premise deployment option for sensitive registries",
              done: false,
            },
            {
              phase: "Phase 4 (12–24 months)",
              desc: "State-level High Court coordination layer; national pendency dashboard feeds; ML-based duration prediction (replaces rule-based)",
              done: false,
            },
          ].map((item) => (
            <div key={item.phase} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  item.done
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted text-muted-foreground",
                )}
              >
                {item.done ? "✓" : "○"}
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">{item.phase}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
