import { supabase } from "@/integrations/supabase/client";

export type HolidayType =
  | "gazetted"
  | "court_vacation"
  | "restricted"
  | "second_saturday"
  | "sunday";

export type CourtHoliday = {
  id?: string;
  date: string;
  name: string;
  type: HolidayType;
  jurisdiction?: string;
};

/**
 * Standard Indian Court Gazette Holidays and Vacations for 2026.
 * Used as immediate fallback if offline or before database table is populated.
 */
export const DEFAULT_COURT_HOLIDAYS_2026: CourtHoliday[] = [
  { date: "2026-01-26", name: "Republic Day", type: "gazetted" },
  { date: "2026-03-04", name: "Holi", type: "gazetted" },
  { date: "2026-03-20", name: "Eid-ul-Fitr", type: "gazetted" },
  { date: "2026-04-03", name: "Good Friday", type: "gazetted" },
  { date: "2026-04-14", name: "Dr. B.R. Ambedkar Jayanti", type: "gazetted" },
  { date: "2026-05-01", name: "Maharashtra Day / May Day", type: "gazetted" },
  { date: "2026-05-27", name: "Eid-ul-Adha (Bakrid)", type: "gazetted" },
  { date: "2026-08-15", name: "Independence Day", type: "gazetted" },
  { date: "2026-09-04", name: "Janmashtami", type: "gazetted" },
  { date: "2026-09-17", name: "Milad-un-Nabi", type: "gazetted" },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti", type: "gazetted" },
  { date: "2026-10-20", name: "Maha Navami / Dussehra", type: "gazetted" },
  { date: "2026-10-21", name: "Vijaya Dashami", type: "gazetted" },
  { date: "2026-11-08", name: "Diwali (Lakshmi Puja)", type: "gazetted" },
  { date: "2026-11-09", name: "Govardhan Puja", type: "gazetted" },
  { date: "2026-11-10", name: "Bhai Dooj", type: "gazetted" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", type: "gazetted" },
  { date: "2026-12-21", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-22", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-23", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-24", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-25", name: "Christmas Day", type: "gazetted" },
  { date: "2026-12-26", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-28", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-29", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-30", name: "Court Winter Vacation", type: "court_vacation" },
  { date: "2026-12-31", name: "Court Winter Vacation", type: "court_vacation" },
];

/**
 * Checks if a given date is a Sunday or a 2nd/4th Saturday (standard Indian court non-sitting days).
 */
export function isWeekendCourtClosure(dateStr: string): { isClosed: boolean; reason?: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sun, 6 = Sat

  if (day === 0) {
    return { isClosed: true, reason: "Sunday (Court Closed)" };
  }

  if (day === 6) {
    const dayOfMonth = d.getDate();
    // 2nd Saturday falls between 8th and 14th
    if (dayOfMonth >= 8 && dayOfMonth <= 14) {
      return { isClosed: true, reason: "Second Saturday (Non-sitting Day)" };
    }
    // 4th Saturday falls between 22nd and 28th
    if (dayOfMonth >= 22 && dayOfMonth <= 28) {
      return { isClosed: true, reason: "Fourth Saturday (Non-sitting Day)" };
    }
  }

  return { isClosed: false };
}

/**
 * Checks whether a given ISO date string is a court holiday or closed sitting day.
 */
export function checkCourtHoliday(
  dateStr: string,
  holidaysList: CourtHoliday[] = DEFAULT_COURT_HOLIDAYS_2026,
): { isHoliday: boolean; holidayName?: string | undefined; holidayType?: HolidayType | undefined } {
  // 1. Check explicit gazetted holidays / vacations
  const match = holidaysList.find((h) => h.date === dateStr);
  if (match) {
    return {
      isHoliday: true,
      holidayName: match.name,
      holidayType: match.type,
    };
  }

  // 2. Check weekend non-sitting days (Sunday / 2nd & 4th Sat)
  const weekend = isWeekendCourtClosure(dateStr);
  if (weekend.isClosed) {
    return {
      isHoliday: true,
      holidayName: weekend.reason ?? "Weekend Closure",
      holidayType: weekend.reason?.includes("Second") ? "second_saturday" : "sunday",
    };
  }

  return { isHoliday: false };
}

/**
 * Supabase query for court holidays.
 */
export const courtHolidaysQuery = {
  queryKey: ["court-holidays"],
  queryFn: async (): Promise<CourtHoliday[]> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("court_holidays")
        .select("id, date, name, type, jurisdiction")
        .order("date");

      if (error || !data || data.length === 0) {
        return DEFAULT_COURT_HOLIDAYS_2026;
      }
      return data as unknown as CourtHoliday[];
    } catch {
      return DEFAULT_COURT_HOLIDAYS_2026;
    }
  },
};
