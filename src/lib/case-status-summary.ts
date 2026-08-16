import type { PublicCaseStatus } from "@/lib/case-status.functions";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
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

/**
 * Deterministic, public-safe plain-language summary. Outcome information only —
 * never priority score, tier, statutory flags or internal reasoning.
 */
export function buildPublicSummary(result: PublicCaseStatus): string {
  const parts: string[] = [];
  const hearing = result.nextHearing;

  if (hearing) {
    const where = hearing.courtroomName ? ` in ${hearing.courtroomName}` : "";
    const before = hearing.judgeName ? ` before ${hearing.judgeName}` : "";
    parts.push(
      `Your case ${result.caseNumber} is listed for hearing on ${formatDate(hearing.date)} at ${formatTime(hearing.startTime)}${where}${before}.`,
    );
    if (hearing.causeListPosition && hearing.causeListTotal) {
      parts.push(
        `It is item ${hearing.causeListPosition} of ${hearing.causeListTotal} on the cause list for that day, so please reach the court well before your turn.`,
      );
    } else {
      parts.push("Please reach the court well before the scheduled time.");
    }
  } else {
    parts.push(
      `Your case ${result.caseNumber} has not yet been given a hearing date. The current status is: ${result.status.toLowerCase()}.`,
    );
    parts.push(
      "Please check this page again later, or contact the registry counter for assistance.",
    );
  }

  parts.push("Listing details may change on the direction of the court.");
  return parts.join(" ");
}
