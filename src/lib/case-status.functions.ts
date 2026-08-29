import { createServerFn } from "@tanstack/react-start";
import { checkRateLimit } from "@/lib/rate-limit.server";

export type PublicCaseStatus = {
  caseNumber: string;
  cnrNumber?: string | null;
  status: string;
  categoryName: string | null;
  filingDate: string | null;
  nextHearing: {
    date: string;
    startTime: string;
    endTime: string;
    judgeName: string | null;
    courtroomName: string | null;
    causeListPosition: number | null;
    causeListTotal: number | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  filed: "Filed — awaiting listing",
  scheduled: "Listed for hearing",
  in_progress: "Hearing in progress",
  adjourned: "Adjourned — awaiting re-listing",
  disposed: "Disposed",
};

export const lookupCaseStatus = createServerFn({ method: "POST" })
  .validator((input: { caseNumber: string }) => {
    const raw = (input?.caseNumber ?? "").trim().toUpperCase();
    if (raw.length < 2 || raw.length > 50) {
      throw new Error("Please enter a valid Case Number.");
    }
    return { caseNumber: raw };
  })
  .handler(async ({ data }): Promise<PublicCaseStatus | null> => {
    try {
      // Rate limit public lookups to 60 per minute
      const rateCheck = checkRateLimit("public-case-lookup", {
        maxRequests: 60,
        windowMs: 60_000,
      });
      if (!rateCheck.allowed) {
        throw new Error("Too many lookup requests. Please wait a few seconds before trying again.");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Exact match on case_number (case-insensitive)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: row } = await (supabaseAdmin.from("cases") as any)
        .select("id, case_number, status, filing_date, case_categories(name)")
        .ilike("case_number", data.caseNumber)
        .limit(1)
        .maybeSingle();

      // 2. If not found, try flexible partial/contains match
      if (!row) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: partialRow } = await (supabaseAdmin.from("cases") as any)
          .select("id, case_number, status, filing_date, case_categories(name)")
          .ilike("case_number", `%${data.caseNumber}%`)
          .limit(1)
          .maybeSingle();
        row = partialRow;
      }

      if (!row) return null;

      const { data: schedules } = await supabaseAdmin
        .from("schedules")
        .select(
          "id, status, case_id, cause_list_position, hearing_slots(date, start_time, end_time), judges(name), courtrooms(name)",
        )
        .in("status", ["proposed", "confirmed"]);

      type Row = {
        id: string;
        case_id: string | null;
        cause_list_position: number | null;
        hearing_slots: { date: string; start_time: string; end_time: string } | null;
        judges: { name: string } | null;
        courtrooms: { name: string } | null;
      };

      const today = new Date().toISOString().slice(0, 10);
      const rows = ((schedules ?? []) as unknown as Row[]).filter((s) => s.hearing_slots);

      const mine = rows
        .filter((s) => s.case_id === row.id && s.hearing_slots!.date >= today)
        .sort(
          (a, b) =>
            a.hearing_slots!.date.localeCompare(b.hearing_slots!.date) ||
            a.hearing_slots!.start_time.localeCompare(b.hearing_slots!.start_time),
        )[0];

      let nextHearing: PublicCaseStatus["nextHearing"] = null;
      if (mine) {
        const sameDay = rows
          .filter(
            (s) =>
              s.hearing_slots!.date === mine.hearing_slots!.date &&
              (s.judges?.name ?? null) === (mine.judges?.name ?? null),
          )
          .sort((a, b) => {
            const pa = a.cause_list_position ?? Number.MAX_SAFE_INTEGER;
            const pb = b.cause_list_position ?? Number.MAX_SAFE_INTEGER;
            return pa - pb || a.hearing_slots!.start_time.localeCompare(b.hearing_slots!.start_time);
          });
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
    } catch (err) {
      console.error("Public lookupCaseStatus error:", err);
      return null;
    }
  });
