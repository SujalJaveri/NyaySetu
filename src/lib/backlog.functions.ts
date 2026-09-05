import { createServerFn } from "@tanstack/react-start";
import type { BacklogCase } from "@/lib/backlog-simulation";

/**
 * Server function to fetch active cases for the Backlog Simulator.
 * Uses service-role supabaseAdmin so that Row Level Security (RLS)
 * does not block public or unauthenticated simulation runs.
 */
export const getBacklogSimulationCases = createServerFn({ method: "GET" })
  .handler(async (): Promise<BacklogCase[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("cases")
        .select(
          "id, case_number, filing_date, priority_score, priority_tier, statutory_limitation_deadline",
        )
        .neq("status", "disposed")
        .order("filing_date", { ascending: true });

      if (error) {
        console.error("Database query error in getBacklogSimulationCases:", error);
        return [];
      }
      return (data ?? []) as BacklogCase[];
    } catch (err) {
      console.error("Failed to load backlog cases via server admin:", err);
      return [];
    }
  });
