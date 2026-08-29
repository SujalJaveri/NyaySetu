import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Printer,
  ShieldCheck,
  Clock,
  MapPin,
  Gavel,
  FileText,
  Calendar,
  AlertCircle,
  QrCode,
  Info,
} from "lucide-react";

import { lookupCaseStatus, type PublicCaseStatus } from "@/lib/case-status.functions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicCaseSummary } from "@/components/public-case-summary";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  filed: "Filed — awaiting listing",
  scheduled: "Listed for hearing",
  in_progress: "Hearing in progress",
  adjourned: "Adjourned — awaiting re-listing",
  disposed: "Disposed",
};

async function clientSideLookup(caseNum: string): Promise<PublicCaseStatus | null> {
  const query = caseNum.trim().toUpperCase();
  if (query.length < 2) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: row } = await (supabase.from("cases") as any)
    .select("id, case_number, status, filing_date, case_categories(name)")
    .ilike("case_number", query)
    .limit(1)
    .maybeSingle();

  if (!row) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fuzzyRow } = await (supabase.from("cases") as any)
      .select("id, case_number, status, filing_date, case_categories(name)")
      .ilike("case_number", `%${query}%`)
      .limit(1)
      .maybeSingle();
    row = fuzzyRow;
  }

  if (!row) return null;

  const { data: schedules } = await supabase
    .from("schedules")
    .select(
      "id, status, case_id, cause_list_position, hearing_slots(date, start_time, end_time), judges(name), courtrooms(name)",
    )
    .in("status", ["proposed", "confirmed"]);

  type SchedRow = {
    id: string;
    case_id: string | null;
    cause_list_position: number | null;
    hearing_slots: { date: string; start_time: string; end_time: string } | null;
    judges: { name: string } | null;
    courtrooms: { name: string } | null;
  };

  const today = new Date().toISOString().slice(0, 10);
  const rows = ((schedules ?? []) as unknown as SchedRow[]).filter((s) => s.hearing_slots);

  const mine = rows
    .filter((s) => s.case_id === row.id && s.hearing_slots!.date >= today)
    .sort(
      (a, b) =>
        a.hearing_slots!.date.localeCompare(b.hearing_slots!.date) ||
        a.hearing_slots!.start_time.localeCompare(b.hearing_slots!.start_time),
    )[0];

  let nextHearing: PublicCaseStatus["nextHearing"] = null;
  if (mine) {
    const sameDay = rows.filter(
      (s) =>
        s.hearing_slots!.date === mine.hearing_slots!.date &&
        (s.judges?.name ?? null) === (mine.judges?.name ?? null),
    );
    const idx = sameDay.findIndex((s) => s.id === mine.id);
    nextHearing = {
      date: mine.hearing_slots!.date,
      startTime: mine.hearing_slots!.start_time,
      endTime: mine.hearing_slots!.end_time,
      judgeName: mine.judges?.name ?? null,
      courtroomName: mine.courtrooms?.name ?? null,
      causeListPosition: idx >= 0 ? idx + 1 : null,
      causeListTotal: sameDay.length || null,
    };
  }

  return {
    caseNumber: row.case_number,
    cnrNumber: null,
    status: STATUS_LABELS[row.status] ?? row.status,
    categoryName: (row.case_categories as { name: string } | null)?.name ?? null,
    filingDate: row.filing_date ?? null,
    nextHearing,
  };
}

export const Route = createFileRoute("/case-status")({
  head: () => ({
    meta: [
      { title: "Check Case Status — NyayaSetu Public Portal" },
      {
        name: "description",
        content:
          "Enter your case number to see current status, next hearing date, judge, courtroom and cause list position. Compliant with eCourts standards.",
      },
      { property: "og:title", content: "Check Case Status — NyayaSetu Public Portal" },
      {
        property: "og:description",
        content:
          "Public case status enquiry: current status, next hearing date, court and cause list position.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaseStatusPage,
});

function formatDate(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(value: string) {
  const [h, m] = value.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

const SAMPLE_CASES = [
  { label: "Labour Dispute", num: "LAB-2026-0037" },
  { label: "Bail Application", num: "BAI-2026-0010" },
  { label: "Priority Trial", num: "CASE-2026-0001" },
  { label: "Commercial Suit", num: "COM-2026-0005" },
];

function CaseStatusPage() {
  const lookup = useServerFn(lookupCaseStatus);
  const [caseNumber, setCaseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicCaseStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function executeSearch(targetNumber: string) {
    const trimmed = targetNumber.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setNotFound(false);

    try {
      let data: PublicCaseStatus | null = null;
      try {
        data = await lookup({ data: { caseNumber: trimmed } });
      } catch (serverErr) {
        console.warn("Server lookup failed, falling back to client query:", serverErr);
      }

      if (!data) {
        data = await clientSideLookup(trimmed);
      }

      if (!data) {
        setNotFound(true);
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    executeSearch(caseNumber);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      {/* Top Banner */}
      <header className="border-b-4 border-accent bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6">
          <div className="flex items-center gap-4">
            <BrandMark className="size-14 bg-white p-0.5 shadow-xs" showLabel />
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.14em] text-primary-foreground/70 uppercase">
                NyayaSetu Public Portal • District & Taluka Courts
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl tracking-tight">Check Case Status</h1>
              <p className="text-sm text-primary-foreground/80">
                Official public enquiry service for litigants, advocates, and citizens. No login required.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        {/* Search Box Card */}
        <section
          aria-labelledby="enquiry-heading"
          className="rounded-xl border bg-card p-6 shadow-sm ring-1 ring-border/50"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="enquiry-heading" className="text-lg font-semibold text-foreground">
              Search by Case Number or Keyword
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live CIS Synchronized
            </span>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Enter your Case Number (e.g., <code className="font-mono text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">LAB-2026-0037</code> or <code className="font-mono text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">0037</code>) as printed on your registry filing slip.
          </p>

          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="case-number" className="sr-only">
                Case number
              </label>
              <Input
                id="case-number"
                name="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="e.g. LAB-2026-0037, BAI-2026-0010, CASE-2026-0001"
                autoComplete="off"
                className="h-12 text-base font-mono bg-background"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 px-7 text-base font-semibold shadow-sm"
            >
              {loading ? "Searching CIS…" : "Check Status"}
            </Button>
          </form>

          {/* Quick Demo Case Chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Try sample cases:</span>
            {SAMPLE_CASES.map((sample) => (
              <button
                key={sample.num}
                type="button"
                onClick={() => {
                  setCaseNumber(sample.num);
                  executeSearch(sample.num);
                }}
                className="inline-flex items-center gap-1 rounded-md border bg-muted/60 hover:bg-muted px-2.5 py-1 text-xs font-mono transition-colors text-foreground"
              >
                <span>{sample.num}</span>
                <span className="text-[10px] text-muted-foreground">({sample.label})</span>
              </button>
            ))}
          </div>
        </section>

        {/* Results Area */}
        <div className="mt-6 space-y-6" aria-live="polite">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Enquiry Interrupted</p>
                <p className="mt-0.5 text-xs text-destructive/90">{error}</p>
              </div>
            </div>
          )}

          {notFound && (
            <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <FileText className="size-6 text-muted-foreground" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-foreground">No Case Record Found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                No active registry case matched <code className="font-mono font-medium text-foreground">{caseNumber}</code>. Please double-check your case number format or enquire at the District Court registry counter.
              </p>
            </div>
          )}

          {/* Multilingual Plain Language Summary */}
          {result && <PublicCaseSummary result={result} />}

          {/* Main Case Dossier Card */}
          {result && (
            <section
              aria-labelledby="result-heading"
              className="rounded-xl border bg-card shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="border-b bg-muted/30 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 id="result-heading" className="text-xl font-bold font-mono text-foreground">
                      {result.caseNumber}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                      {result.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.categoryName ?? "General Civil / Criminal Matter"} • Filed on {result.filingDate ? formatDate(result.filingDate) : "Official Registry Record"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2 text-xs font-medium"
                >
                  <Printer className="size-3.5" />
                  Print / Save Pass
                </Button>
              </div>

              {/* Next Hearing Highlight Banner (if scheduled) */}
              {result.nextHearing ? (
                <div className="bg-primary/5 border-b border-primary/15 px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Next Listed Hearing
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-start gap-2.5">
                      <Calendar className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Hearing Date</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatDate(result.nextHearing.date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sitting Time</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatTime(result.nextHearing.startTime)} – {formatTime(result.nextHearing.endTime)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Courtroom & Bench</p>
                        <p className="text-sm font-semibold text-foreground">
                          {result.nextHearing.courtroomName ?? "Assigned Hall"} ({result.nextHearing.judgeName ?? "Presiding Judge"})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3.5 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="size-4 shrink-0" />
                  <span>
                    This matter is currently in registry intake queue and has not been listed on a daily cause list yet. Please check back after 5:00 PM when the daily board is finalized.
                  </span>
                </div>
              )}

              {/* Complete Case Details Grid */}
              <dl className="divide-y text-sm">
                <DetailRow label="Case Type / Category" value={result.categoryName ?? "General Jurisdiction"} />
                <DetailRow
                  label="Filing Date"
                  value={result.filingDate ? formatDate(result.filingDate) : "Official Registry Record"}
                />
                {result.nextHearing && (
                  <>
                    <DetailRow
                      label="Presiding Judge"
                      value={result.nextHearing.judgeName ?? "Designated Judicial Officer"}
                    />
                    <DetailRow
                      label="Courtroom Hall"
                      value={result.nextHearing.courtroomName ?? "To be designated"}
                    />
                    {result.nextHearing.causeListPosition && (
                      <DetailRow
                        label="Daily Cause List Position"
                        value={`Item #${result.nextHearing.causeListPosition} on Today's Board (${result.nextHearing.causeListTotal} total listed cases)`}
                      />
                    )}
                  </>
                )}
                <DetailRow
                  label="Statutory Jurisdiction"
                  value="District & Sessions Court, Central Registry Division"
                />
              </dl>
            </section>
          )}

          {/* Litigant Courtroom Entry Pass & Guidelines Card */}
          {result && result.nextHearing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Printable Digital Gate Pass */}
              <div className="rounded-xl border bg-card p-5 shadow-sm ring-1 ring-border/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div className="flex items-center gap-2">
                      <QrCode className="size-5 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">
                        Digital Court Gate Pass
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      PASS-{result.caseNumber}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    {/* Visual QR Code Pattern */}
                    <div className="size-20 shrink-0 rounded-lg border bg-white p-1.5 flex items-center justify-center shadow-xs">
                      <svg viewBox="0 0 100 100" className="size-full text-zinc-900 fill-current">
                        <rect x="5" y="5" width="25" height="25" fill="black" />
                        <rect x="9" y="9" width="17" height="17" fill="white" />
                        <rect x="13" y="13" width="9" height="9" fill="black" />
                        <rect x="70" y="5" width="25" height="25" fill="black" />
                        <rect x="74" y="9" width="17" height="17" fill="white" />
                        <rect x="78" y="13" width="9" height="9" fill="black" />
                        <rect x="5" y="70" width="25" height="25" fill="black" />
                        <rect x="9" y="74" width="17" height="17" fill="white" />
                        <rect x="13" y="78" width="9" height="9" fill="black" />
                        <rect x="38" y="10" width="8" height="15" fill="black" />
                        <rect x="50" y="18" width="12" height="8" fill="black" />
                        <rect x="38" y="38" width="24" height="24" fill="black" />
                        <rect x="42" y="42" width="16" height="16" fill="white" />
                        <rect x="46" y="46" width="8" height="8" fill="black" />
                        <rect x="10" y="38" width="8" height="18" fill="black" />
                        <rect x="22" y="45" width="8" height="12" fill="black" />
                        <rect x="70" y="38" width="18" height="8" fill="black" />
                        <rect x="78" y="52" width="12" height="18" fill="black" />
                        <rect x="38" y="70" width="12" height="18" fill="black" />
                        <rect x="55" y="78" width="18" height="12" fill="black" />
                        <rect x="78" y="78" width="14" height="14" fill="black" />
                      </svg>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-foreground">{result.caseNumber}</p>
                      <p className="text-muted-foreground">{result.nextHearing.courtroomName}</p>
                      <p className="font-medium text-primary">
                        {formatTime(result.nextHearing.startTime)} • {formatDate(result.nextHearing.date)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Show this pass at the court complex security checkpost.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handlePrint} className="w-full text-xs gap-2">
                    <Printer className="size-3.5" />
                    Print Entry Pass
                  </Button>
                </div>
              </div>

              {/* Instructions & Decorum */}
              <div className="rounded-xl border bg-card p-5 shadow-sm ring-1 ring-border/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 pb-3 border-b">
                    <Gavel className="size-5 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Hearing Appearance Guidelines
                    </h3>
                  </div>

                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span><strong>Arrival Time:</strong> Litigants and advocates must report 20 minutes prior to {formatTime(result.nextHearing.startTime)}.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span><strong>Vakalatnama:</strong> Ensure authorized legal representation is filed on registry record.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span><strong>Court Decorum:</strong> Mobile devices must remain on silent mode inside the courtroom hall.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                  <span>Authorized District Court Registry Information</span>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Protection Notice */}
          <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Statutory Privacy & Protection Compliance
              </p>
              <p className="leading-relaxed">
                In strict compliance with Supreme Court of India directives (<em>Nipun Saxena v. Union of India</em>) and Section 33(7) of the POCSO Act, personal details and sensitive records are redacted from public indexing.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-6 py-3.5 sm:grid-cols-3 sm:gap-4 hover:bg-muted/10 transition-colors">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground sm:col-span-2">{value}</dd>
    </div>
  );
}
