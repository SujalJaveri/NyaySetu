export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getEnvVar(key: string): string | undefined {
  const g = globalThis as Record<string, unknown>;
  const envObj = g["__env__"] as Record<string, string> | undefined;
  const procEnv = (g["process"] as { env?: Record<string, string> } | undefined)?.env;

  if (key === "GEMINI_API_KEY") {
    return (
      envObj?.["GEMINI_API_KEY"] || procEnv?.["GEMINI_API_KEY"] || process.env["GEMINI_API_KEY"]
    );
  }

  if (key === "GEMINI_MODEL") {
    return (
      envObj?.["GEMINI_MODEL"] || procEnv?.["GEMINI_MODEL"] || process.env["GEMINI_MODEL"]
    );
  }

  if (key === "GROQ_API_KEY") {
    return (
      envObj?.["GROQ_API_KEY"] || procEnv?.["GROQ_API_KEY"] || process.env["GROQ_API_KEY"]
    );
  }

  if (key === "OPENAI_API_KEY") {
    return (
      envObj?.["OPENAI_API_KEY"] || procEnv?.["OPENAI_API_KEY"] || process.env["OPENAI_API_KEY"]
    );
  }

  if (key === "CUSTOM_LLM_URL") {
    return (
      envObj?.["CUSTOM_LLM_URL"] || procEnv?.["CUSTOM_LLM_URL"] || process.env["CUSTOM_LLM_URL"]
    );
  }

  return (
    process.env[key] ||
    envObj?.[key] ||
    procEnv?.[key] ||
    (typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string> }).env?.[key]
      : undefined)
  );
}

/**
 * Universal utility to query the active LLM based on environment configuration.
 * Prioritises Gemini 3.5 Flash, cascades to Groq ultra-fast backup, OpenAI, and custom LLM.
 */
export async function queryLLM(messages: ChatMessage[]): Promise<string | null> {
  const customUrl = getEnvVar("CUSTOM_LLM_URL");
  const customKey = getEnvVar("CUSTOM_LLM_KEY");
  const customModel = getEnvVar("CUSTOM_LLM_MODEL");
  const geminiKey = getEnvVar("GEMINI_API_KEY");
  const groqKey = getEnvVar("GROQ_API_KEY");
  const openaiKey = getEnvVar("OPENAI_API_KEY") || getEnvVar("AI_GATEWAY_API_KEY");

  // 1. Google Gemini API (Primary — Powered by Gemini 3.5 Flash)
  if (geminiKey) {
    const candidateModels = [
      getEnvVar("GEMINI_MODEL") || "gemini-3.5-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3-flash-preview",
    ].filter(Boolean) as string[];

    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: {
      contents: typeof contents;
      systemInstruction?: { parts: { text: string }[] };
      generationConfig?: { maxOutputTokens: number };
    } = { contents, generationConfig: { maxOutputTokens: 512 } };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const payload = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const parts = payload.candidates?.[0]?.content?.parts ?? [];
          const text = parts
            .map((p) => p.text)
            .filter(Boolean)
            .join("\n")
            .trim();
          if (text) return text;
        } else {
          console.warn(
            `Gemini model ${model} returned HTTP ${res.status}, cascading to next candidate...`,
          );
        }
      } catch (e) {
        console.warn(`Gemini model ${model} request error:`, e);
      }
    }
  }

  // 2. Groq Ultra-Fast Backup (High Performance Fallback)
  if (groqKey) {
    const groqModels = [
      "openai/gpt-oss-120b",
      "groq/compound-mini",
      "openai/gpt-oss-20b",
      "qwen/qwen3.6-27b",
    ];

    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 512,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const payload = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = payload.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } else {
          console.warn(`Groq model ${model} returned HTTP ${res.status}, cascading...`);
        }
      } catch (e) {
        console.warn(`Groq model ${model} request error:`, e);
      }
    }
  }

  // 3. Custom / Local LLM (e.g. Ollama, LM Studio, vLLM)
  if (customUrl) {
    try {
      const url = customUrl.endsWith("/chat/completions")
        ? customUrl
        : `${customUrl.replace(/\/+$/, "")}/chat/completions`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customKey) {
        headers["Authorization"] = `Bearer ${customKey}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: customModel || "local-model",
          messages,
        }),
      });

      if (res.ok) {
        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return payload.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch (e) {
      console.error("Local LLM API request failed:", e);
    }
  }

  // 4. OpenAI or AI Gateway
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
        }),
      });

      if (res.ok) {
        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return payload.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch (e) {
      console.error("OpenAI API request failed:", e);
    }
  }

  return null;
}
