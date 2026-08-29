import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { answerQuestion, type AssistantAnswer } from "@/lib/assistant";
import { queryLLM, getEnvVar } from "@/lib/ai.server";
import { DEFAULT_COURT_HOLIDAYS_2026 } from "@/lib/holidays";

const Input = z.object({ question: z.string().min(1).max(1000) });

export const askRegistryAssistant = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AssistantAnswer> => {
    // 1. Check if AI provider is available
    const hasAI =
      getEnvVar("CUSTOM_LLM_URL") ||
      getEnvVar("OPENAI_API_KEY") ||
      getEnvVar("AI_GATEWAY_API_KEY") ||
      getEnvVar("GEMINI_API_KEY");

    // 2. Fetch live database snapshot for grounding
    const todayStr = new Date().toISOString().slice(0, 10);
    const [
      casesRes,
      judgesRes,
      courtroomsRes,
      schedulesRes,
      conflictsRes,
      settingsRes,
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("cases") as any)
        .select(
          "id, case_number, cnr_number, status, priority_score, priority_tier, filing_date, pending_duration_days, case_categories(name)",
        )
        .neq("status", "disposed")
        .order("priority_score", { ascending: false })
        .limit(25),
      supabase.from("judges").select("id, name, specialisation, current_workload"),
      supabase.from("courtrooms").select("id, name, capacity"),
      supabase
        .from("schedules")
        .select(
          "id, status, judge_id, courtroom_id, cases(case_number, parties), hearing_slots(date, start_time, end_time), judges(name), courtrooms(name)",
        )
        .in("status", ["proposed", "confirmed"])
        .gte("hearing_slots.date", todayStr)
        .limit(20),
      supabase.from("notifications_log").select("id, kind, message").limit(10),
      supabase.from("priority_settings").select("max_judge_workload").limit(1).maybeSingle(),
    ]);

    const activeCases = casesRes.data ?? [];
    const judgesList = judgesRes.data ?? [];
    const courtroomsList = courtroomsRes.data ?? [];
    const upcomingSchedules = schedulesRes.data ?? [];
    const maxWorkload = settingsRes.data?.max_judge_workload ?? 25;

    // Check if deterministic handler gives a quick high-confidence answer with interactive row buttons
    const deterministicAnswer = await answerQuestion(data.question);

    if (!hasAI) {
      return deterministicAnswer;
    }

    try {
      const judgesSummary = judgesList
        .map(
          (j) =>
            `- ${j.name} (${j.specialisation || "General"}): ${j.current_workload}/${maxWorkload} active hearings`,
        )
        .join("\n");

      const courtroomsSummary = courtroomsList
        .map((c) => `- ${c.name} (Capacity: ${c.capacity})`)
        .join("\n");

      const topCasesSummary = activeCases
        .slice(0, 10)
        .map(
          (c: { case_number: string; cnr_number?: string; priority_score?: number; priority_tier?: string; case_categories?: { name: string } }) =>
            `- ${c.case_number} ${c.cnr_number ? `[CNR: ${c.cnr_number}]` : ""} (${c.case_categories?.name || "General"}): Priority Score ${c.priority_score ?? 50} (${c.priority_tier || "Tier 2"})`,
        )
        .join("\n");

      const upcomingSchedulesSummary = upcomingSchedules
        .slice(0, 10)
        .map((s) => {
          const slot = s.hearing_slots;
          const timeStr = slot ? `(${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)})` : "";
          const dateStr = slot?.date ?? "Upcoming";
          const judgeStr = s.judges?.name ?? "Unassigned";
          const roomStr = s.courtrooms?.name ?? "Room";
          return `- ${s.cases?.case_number ?? "Case"}: ${dateStr} ${timeStr} before ${judgeStr} in ${roomStr}`;
        })
        .join("\n");

      const holidaysSummary = DEFAULT_COURT_HOLIDAYS_2026
        .slice(0, 6)
        .map((h) => `- ${h.date}: ${h.name} (${h.type})`)
        .join("\n");

      const systemPrompt = `
You are the **NyayaSetu AI Judicial Copilot & Registry Assistant**, built for Indian district and taluka court registries.
You help judges, registrars, advocates, and administrative staff by answering questions, giving operational insights, explaining court scheduling rules, and analyzing registry data.

=== REAL-TIME COURT REGISTRY CONTEXT (TODAY: ${todayStr}) ===
Active Pending Cases Count: ${activeCases.length}
Judges on the Bench:
${judgesSummary || "None recorded"}

Courtrooms:
${courtroomsSummary || "None recorded"}

Top Priority Cases in Registry:
${topCasesSummary || "None recorded"}

Upcoming Scheduled Hearings:
${upcomingSchedulesSummary || "No upcoming hearings currently listed"}

Upcoming Court Gazetted Holidays:
${holidaysSummary}

=== DOMAIN & LEGAL KNOWLEDGE ===
- **Indian Statutory Enactments**: Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA) replace the IPC, CrPC, and IEA respectively.
- **National CNR Format**: 16-character unique identifier for Indian courts (e.g. DLCT01-002415-2026).
- **Procedural Staging**: NyayaSetu organizes cause lists into Morning Urgent Mentions & Bail (10:30–11:30 AM), Contested Arguments & Heavy Trials (11:30 AM–03:30 PM), and Afternoon Orders & Disposals (03:30–04:30 PM).
- **Decision-Support**: All scheduling outputs require registrar approval. You provide explainable decision-support, adhering to Supreme Court of India AI guidelines.

=== INSTRUCTIONS ===
1. Directly and comprehensively answer the user's question, prompt, or command with precision.
2. You can handle ANY custom query — including statistical inquiries, procedural guidance, case lookups, judge workload analysis, scheduling advice, or legal summaries.
3. Use the real-time context above to give factual numbers, case details, or judge assignments where applicable.
4. Keep your answer helpful, well-structured (using bullet points or concise paragraphs), and professional.
`;

      const aiResponse = await queryLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: data.question },
      ]);

      if (aiResponse) {
        return {
          intent: deterministicAnswer.intent !== "unknown" ? deterministicAnswer.intent : "unknown",
          summary: aiResponse,
          source: "Gemini 2.5 Flash AI Copilot (grounded on live registry database)",
          rows: deterministicAnswer.rows ?? [],
        };
      }
    } catch (e) {
      console.error("Assistant AI response error:", e);
    }

    return deterministicAnswer;
  });
