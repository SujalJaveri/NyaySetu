import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { answerQuestion, type AssistantAnswer } from "@/lib/assistant";
import { queryLLM, getEnvVar } from "@/lib/ai.server";

const Input = z.object({ question: z.string().min(1).max(500) });

export const askRegistryAssistant = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AssistantAnswer> => {
    // 1. Run the deterministic query handler first
    const deterministicAnswer = await answerQuestion(data.question);

    // If we resolved it to a known query intent, return it directly
    if (deterministicAnswer.intent !== "unknown") {
      return deterministicAnswer;
    }

    // 2. Otherwise, check if an AI provider is configured.
    // If not, return the default deterministic fallback response.
    const hasAI =
      getEnvVar("CUSTOM_LLM_URL") ||
      getEnvVar("OPENAI_API_KEY") ||
      getEnvVar("AI_GATEWAY_API_KEY") ||
      getEnvVar("GEMINI_API_KEY");

    if (!hasAI) {
      return deterministicAnswer;
    }

    try {
      // Fetch high-level registry statistics to give the LLM actual context
      const [casesCount, judgesCount, courtroomsCount, schedulesCount] = await Promise.all([
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .neq("status", "disposed"),
        supabase.from("judges").select("id", { count: "exact", head: true }),
        supabase.from("courtrooms").select("id", { count: "exact", head: true }),
        supabase
          .from("schedules")
          .select("id", { count: "exact", head: true })
          .in("status", ["proposed", "confirmed"]),
      ]);

      const statsText = `
Active Pending Cases: ${casesCount.count ?? 0}
Judges on the Bench: ${judgesCount.count ?? 0}
Available Courtrooms: ${courtroomsCount.count ?? 0}
Active Scheduled Hearings: ${schedulesCount.count ?? 0}
`;

      const systemPrompt = `
You are the NyayaSetu AI Registry Assistant. You help court administrators, judges, and litigants with scheduling, case tracking, and general registry information.

Here is the current real-time state of the court registry:
${statsText}

The user asked: "${data.question}"

Answer the user politely, neutrally, and briefly based on the statistics above or general court procedures.
If the user wants specific queries (like showing specific schedules, conflicts, or availability), explain that you cannot perform custom queries for that yet, but they can ask one of the following exact questions to get live registry data:
- "Which judges are free tomorrow afternoon?"
- "Show me high-priority pending cases"
- "How many conflicts are open right now?"
- "Which judges are nearing their workload?"
- "Which cases are still unscheduled?"
- "What hearings are listed today?"

Keep your response under 100 words. Keep it strictly focused on court administration, case management, and NyayaSetu features.
`;

      const aiResponse = await queryLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: data.question },
      ]);

      if (aiResponse) {
        return {
          intent: "unknown",
          summary: aiResponse,
          source: "AI Conversational Fallback (using real-time registry statistics)",
          rows: [],
        };
      }
    } catch (e) {
      console.error("Assistant AI fallback failed:", e);
    }

    // Default fallback if query fails
    return deterministicAnswer;
  });
