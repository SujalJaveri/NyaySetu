import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Gavel,
  ClipboardList,
  Search,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Landmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "NyayaSetu — Choose How You Sign In" },
      {
        name: "description",
        content:
          "Entry portal for NyayaSetu: bench access for judges, registry access for administrators, and public case status lookup for litigants.",
      },
      { property: "og:title", content: "NyayaSetu — Choose How You Sign In" },
      {
        property: "og:description",
        content:
          "Bench access for judges, registry access for staff, and public case status lookup for litigants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

const entries = [
  {
    key: "judge",
    icon: Gavel,
    eyebrow: "Judicial officers",
    title: "Judge access",
    description:
      "View your own cause list for a selected date, the reasoning behind the listing order, your bench calendar and your current workload against the registry ceiling.",
    points: [
      "Read-only cause list with listing rationale",
      "Personal hearing calendar",
      "Accounts are issued by the registry; no self-registration",
    ],
    cta: "Sign in to my bench",
    to: "/auth" as const,
    search: { role: "judge" as const },
  },
  {
    key: "registrar",
    icon: ClipboardList,
    eyebrow: "Registry staff & administrators",
    title: "Registrar access",
    description:
      "Register cases, run smart scheduling, resolve conflicts, publish cause lists, notify parties and review governance reporting.",
    points: [
      "Case registration and scheduling engine",
      "Conflict detection and what-if simulation",
      "Judges, courtrooms, reports and audit trail",
    ],
    cta: "Sign in to the registry",
    to: "/auth" as const,
    search: { role: "registrar" as const },
  },
  {
    key: "public",
    icon: Search,
    eyebrow: "Litigants & members of the public",
    title: "Public case status",
    description:
      "Enter the case number printed on your filing acknowledgement to see the current status and the next hearing date — no account required.",
    points: [
      "Next hearing date, judge and courtroom",
      "Position in that day's cause list",
      "Available in English, हिन्दी and मराठी",
    ],
    cta: "Check case status",
    to: "/case-status" as const,
    search: undefined,
  },
];

function PortalPage() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<null | { isJudge: boolean }>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (!active) return;
      setSignedIn({ isJudge: !!roles?.some((r) => r.role === "judge") });
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-primary/20 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="size-11 bg-primary-foreground p-1" showLabel />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">NyayaSetu</p>
              <p className="text-xs text-primary-foreground/70">AI powered court scheduling</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 border-l border-primary-foreground/20 pl-4 text-xs text-primary-foreground/70 sm:flex">
            <Landmark className="size-4" />
            <span>Authorised court use</span>
          </div>
        </div>
      </header>

      <section className="registry-enter border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-eyebrow">NyayaSetu digital registry portal</p>
            <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold text-foreground sm:text-5xl">
              Schedule hearings with clear priority, capacity and audit control.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              A court operations workspace for registrars, judges and litigants. It helps the
              registry list cases, prevent avoidable conflicts and keep every assisted decision
              traceable.
            </p>
          </div>
          <div className="registry-interactive border border-border bg-background p-5">
            <BrandMark
              className="mx-auto h-48 w-full max-w-sm bg-card p-4 sm:h-56"
              imageClassName="drop-shadow-sm"
              showLabel
            />
          </div>
          <div className="grid gap-3 border-l-0 border-border text-sm sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
            {[
              ["01", "Priority scoring"],
              ["02", "Conflict-safe listing"],
              ["03", "Public status lookup"],
            ].map(([number, label], index) => (
              <div
                key={number}
                className="registry-enter flex items-center gap-3 border-b border-border pb-3"
                style={{ animationDelay: `${120 + index * 80}ms` }}
              >
                <span className="font-serif text-2xl text-primary">{number}</span>
                <span className="font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="registry-enter mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-eyebrow">Choose workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Continue by role</h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Judges and registry staff sign in with court-issued accounts. Litigants can view hearing
            status without an account.
          </p>
        </div>

        {signedIn && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
            <ShieldCheck className="size-4 text-primary" />
            <p className="text-sm text-foreground">You are already signed in.</p>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: signedIn.isJudge ? "/bench" : "/dashboard", replace: true })
              }
            >
              Continue to workspace
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            return (
              <article
                key={entry.key}
                className="registry-enter registry-interactive flex min-h-80 flex-col border border-border bg-card p-5"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-sm border border-border bg-secondary text-primary">
                    <Icon className="size-5" />
                  </span>
                  <FileCheck2 className="size-4 text-muted-foreground" />
                </div>
                <p className="text-eyebrow mt-5">{entry.eyebrow}</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">{entry.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {entry.description}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-muted-foreground">
                  {entry.points.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 h-px w-4 shrink-0 bg-gold" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  <Button asChild className="w-full justify-between">
                    {entry.search ? (
                      <Link to={entry.to} search={entry.search}>
                        {entry.cta}
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : (
                      <Link to={entry.to}>
                        {entry.cta}
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          Authorised personnel only for bench and registry access. Activity may be monitored and
          recorded. The public case status service shows hearing information only and does not
          disclose internal registry scoring or listing logic.
        </p>
      </section>
    </main>
  );
}
