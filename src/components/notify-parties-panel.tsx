import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, Loader2, Mail, MessageSquare, Signal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import type { CaseRow } from "@/lib/cases";
import type { Candidate } from "@/lib/scheduling";
import {
  buildNotifications,
  logNotifications,
  primaryParty,
  type DraftNotification,
} from "@/lib/notifications-log";

/**
 * Simulated notification dispatch. The registry composes the notice exactly as
 * the court's SMS/email pipeline would receive it, previews it, and records it
 * in the notifications log. Nothing is transmitted from this application.
 */
export function NotifyPartiesPanel({
  caseRow,
  candidate,
}: {
  caseRow: CaseRow;
  candidate: Candidate;
}) {
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [loggedAt, setLoggedAt] = useState<string | null>(null);

  const drafts = buildNotifications(caseRow, candidate);

  async function generate() {
    setBusy(true);
    try {
      const rows = await logNotifications(caseRow, drafts, staff.data?.id);
      setLoggedAt(rows[0]?.sent_at ?? new Date().toISOString());
      queryClient.invalidateQueries({ queryKey: ["notifications-log", caseRow.id] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      toast.success("Hearing notice generated and recorded in the notification log.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the notification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-panel">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="secondary" className="mb-2">
              <BellRing className="size-3" />
              Notify parties
            </Badge>
            <CardTitle className="text-base">Hearing notice for {caseRow.case_number}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Addressed to {primaryParty(caseRow)} on the contact details on record.
            </p>
          </div>
          <Button onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {loggedAt ? "Regenerate notice" : "Generate notice"}
          </Button>
        </div>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">Simulation.</strong> These drafts are
          formatted for the court's existing SMS and email dispatch pipeline. This system composes
          and records the notice; it does not transmit messages itself.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <SmsPreview draft={drafts[0]!} />
          <EmailPreview draft={drafts[1]!} />
        </div>
        {loggedAt && (
          <p className="text-xs text-muted-foreground">
            Recorded in the notification log at{" "}
            {new Date(loggedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            — SMS and email queued for dispatch by the court messaging service.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SmsPreview({ draft }: { draft: DraftNotification }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Signal className="size-3" /> Registered mobile
        </span>
        <span>
          {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
        <MessageSquare className="size-3.5 text-primary" />
        DC-REGSTRY
      </div>
      <div className="max-w-[92%] rounded-2xl rounded-tl-sm border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm">
        {draft.content}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {draft.content.length} characters · {Math.ceil(draft.content.length / 160)} SMS segment(s) ·{" "}
        {draft.recipient}
      </p>
    </div>
  );
}

function EmailPreview({ draft }: { draft: DraftNotification }) {
  const body = draft.content.replace(/^Subject:.*\n\n/, "");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Mail className="size-3.5 text-primary" />
          {draft.subject}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          From: no-reply@districtcourt.registry · To: {draft.recipient}
        </p>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3 py-3 font-sans text-sm leading-relaxed text-foreground">
        {body}
      </pre>
    </div>
  );
}
