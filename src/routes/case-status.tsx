import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { lookupCaseStatus, type PublicCaseStatus } from "@/lib/case-status.functions";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PublicCaseSummary } from "@/components/public-case-summary";

export const Route = createFileRoute("/case-status")({
  head: () => ({
    meta: [
      { title: "Check Case Status — NyayaSetu Public Portal" },
      {
        name: "description",
        content:
          "Enter your case number to see the current status, category, next hearing date, judge, courtroom and cause list position. No login required.",
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

function CaseStatusPage() {
  const lookup = useServerFn(lookupCaseStatus);
  const [caseNumber, setCaseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicCaseStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setNotFound(false);
    try {
      const data = await lookup({ data: { caseNumber } });
      if (!data) setNotFound(true);
      else setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not complete the enquiry. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b-4 border-accent bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-6">
          <BrandMark className="size-14 bg-primary-foreground p-1" showLabel />
          <div className="min-w-0">
            <p className="text-xs tracking-[0.14em] text-primary-foreground/70 uppercase">
              NyayaSetu public portal
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Check Case Status</h1>
            <p className="text-sm text-primary-foreground/80">
              A public enquiry service for litigants and advocates. No login required.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <section
          aria-labelledby="enquiry-heading"
          className="rounded-lg border bg-card p-5 shadow-sm"
        >
          <h2 id="enquiry-heading" className="text-lg font-semibold text-foreground">
            Enter your case number or CNR
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the Case Number or 16-digit CNR printed on your acknowledgement, for example CASE-2026-0012 or DLCT01-002415-2026.
          </p>
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="case-number" className="sr-only">
                Case number or CNR
              </label>
              <Input
                id="case-number"
                name="case-number"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="CASE-2026-0012 or DLCT01-002415-2026"
                autoComplete="off"
                className="h-11 text-base font-mono"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 px-6 text-base">
              {loading ? "Searching…" : "Check status"}
            </Button>
          </form>
        </section>

        <div className="mt-6 space-y-6" aria-live="polite">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {notFound ? (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              No case was found with that Case Number or CNR. Please check the number and try again, or contact
              the registry counter for assistance.
            </p>
          ) : null}

          {result ? <PublicCaseSummary result={result} /> : null}

          {result ? (
            <section
              aria-labelledby="result-heading"
              className="rounded-lg border bg-card shadow-sm"
            >
              <div className="border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="result-heading" className="text-lg font-semibold text-foreground">
                    {result.caseNumber}
                  </h2>
                  {result.cnrNumber && (
                    <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md">
                      CNR: {result.cnrNumber}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{result.status}</p>
              </div>
              <dl className="divide-y">
                <Row label="Case category" value={result.categoryName ?? "Not recorded"} />
                <Row
                  label="Date of filing"
                  value={result.filingDate ? formatDate(result.filingDate) : "Not recorded"}
                />
                {result.nextHearing ? (
                  <>
                    <Row label="Next hearing date" value={formatDate(result.nextHearing.date)} />
                    <Row
                      label="Hearing time"
                      value={`${formatTime(result.nextHearing.startTime)} – ${formatTime(result.nextHearing.endTime)}`}
                    />
                    <Row label="Judge" value={result.nextHearing.judgeName ?? "To be assigned"} />
                    <Row
                      label="Courtroom"
                      value={result.nextHearing.courtroomName ?? "To be assigned"}
                    />
                    {result.nextHearing.causeListPosition ? (
                      <Row
                        label="Position in cause list"
                        value={`Item ${result.nextHearing.causeListPosition} of ${result.nextHearing.causeListTotal}`}
                      />
                    ) : null}
                  </>
                ) : (
                  <Row
                    label="Next hearing"
                    value="Not yet listed. Please check again later or contact the registry counter."
                  />
                )}
              </dl>
            </section>
          ) : null}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Information shown here is provided for public convenience and reflects registry records at
          the time of enquiry. It is not a substitute for the official cause list or a certified
          copy. Listing details may change on the direction of the court.
        </p>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:col-span-2">{value}</dd>
    </div>
  );
}
