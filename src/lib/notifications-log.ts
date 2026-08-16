import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import type { CaseRow } from "@/lib/cases";
import type { Candidate } from "@/lib/scheduling";

/**
 * Simulated hearing-notice generation. Nothing is actually transmitted — the
 * registry composes the SMS and email exactly as CIS 4.0's notification
 * pipeline would receive them, previews them, and stores a copy in
 * notifications_log for the record.
 */

export type NotificationChannel = "sms" | "email";

export type DraftNotification = {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
};

export type NotificationLogRow = {
  id: string;
  case_id: string;
  channel: NotificationChannel;
  recipient: string;
  content: string;
  sent_at: string;
};

function longDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function timeRange(start: string, end: string) {
  return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
}

/** First named party, used as the notional addressee on the preview. */
export function primaryParty(caseRow: CaseRow) {
  const first = (caseRow.parties ?? "").split(/ vs\.? | v\.? |,|\//i)[0]?.trim();
  return first && first.length > 1 ? first : "Registered litigant";
}

export function buildNotifications(caseRow: CaseRow, candidate: Candidate): DraftNotification[] {
  const { slot, judge, courtroom } = candidate;
  const party = primaryParty(caseRow);

  const sms =
    `DISTRICT COURT REGISTRY: ${caseRow.case_number} listed on ` +
    `${shortDate(slot.date)} at ${slot.start_time.slice(0, 5)} hrs before ${judge.name}, ` +
    `${courtroom.name}. Do not reply.`;

  const email =
    `Dear ${party},\n\n` +
    `This is an automated notice from the District Court Registry.\n\n` +
    `Your case ${caseRow.case_number} (${caseRow.parties || "parties as on record"}) has been listed for hearing as follows:\n\n` +
    `  Date        : ${longDate(slot.date)}\n` +
    `  Time        : ${timeRange(slot.start_time, slot.end_time)} hrs\n` +
    `  Before      : ${judge.name}\n` +
    `  Courtroom   : ${courtroom.name}\n\n` +
    `Parties and their advocates are requested to remain present. The listing is subject to the official cause list ` +
    `published for that day and to any direction of the Court.\n\n` +
    `You may verify the current status of this case at any time using the public case status service, quoting the ` +
    `case number above.\n\n` +
    `This is a system-generated message. Please do not reply to this email.\n\n` +
    `Registry\nDistrict Court`;

  return [
    { channel: "sms", recipient: "+91 •••••  ••210 (registered mobile)", content: sms },
    {
      channel: "email",
      recipient: "•••••@•••• (registered email)",
      subject: `Hearing notice — ${caseRow.case_number} listed on ${shortDate(slot.date)}`,
      content: `Subject: Hearing notice — ${caseRow.case_number} listed on ${shortDate(slot.date)}\n\n${email}`,
    },
  ];
}

export async function logNotifications(
  caseRow: CaseRow,
  drafts: DraftNotification[],
  userId?: string,
): Promise<NotificationLogRow[]> {
  const { data, error } = await supabase
    .from("notifications_log")
    .insert(
      drafts.map((d) => ({
        case_id: caseRow.id,
        channel: d.channel,
        recipient: d.recipient,
        content: d.content,
      })),
    )
    .select("id, case_id, channel, recipient, content, sent_at");
  if (error) throw error;

  await recordAudit(
    `Hearing notice generated (${drafts.map((d) => d.channel.toUpperCase()).join(" + ")})`,
    `case:${caseRow.case_number}`,
    userId,
  );

  return (data ?? []) as unknown as NotificationLogRow[];
}

export const caseNotificationsQuery = (caseId: string) => ({
  queryKey: ["notifications-log", caseId],
  queryFn: async (): Promise<NotificationLogRow[]> => {
    const { data, error } = await supabase
      .from("notifications_log")
      .select("id, case_id, channel, recipient, content, sent_at")
      .eq("case_id", caseId)
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as NotificationLogRow[];
  },
});
