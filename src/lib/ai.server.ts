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
 * Prioritises CUSTOM_LLM_URL, falls back to OpenAI/AI Gateway, and then Gemini.
 */
export async function queryLLM(messages: ChatMessage[]): Promise<string | null> {
  const customUrl = getEnvVar("CUSTOM_LLM_URL");
  const customKey = getEnvVar("CUSTOM_LLM_KEY");
  const customModel = getEnvVar("CUSTOM_LLM_MODEL");
  const openaiKey = getEnvVar("OPENAI_API_KEY") || getEnvVar("AI_GATEWAY_API_KEY");
  const geminiKey = getEnvVar("GEMINI_API_KEY");

  // 1. Custom / Local LLM (e.g. Ollama, LM Studio, vLLM, custom proxy)
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
      console.error(`Local LLM API returned status ${res.status}: ${res.statusText}`);
    } catch (e) {
      console.error("Local LLM API request failed:", e);
    }
  }

  // 2. OpenAI or AI Gateway (OpenAI compatible schema)
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
      console.error(`OpenAI API returned status ${res.status}: ${res.statusText}`);
    } catch (e) {
      console.error("OpenAI API request failed:", e);
    }
  }

  // 3. Google Gemini API
  if (geminiKey) {
    try {
      const systemInstruction = messages.find((m) => m.role === "system")?.content;
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const body: {
        contents: typeof contents;
        systemInstruction?: { parts: { text: string }[] };
      } = { contents };

      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        return text || null;
      }
      console.error(`Gemini API returned status ${res.status}: ${res.statusText}`);
    } catch (e) {
      console.error("Gemini API request failed:", e);
    }
  }

  return null;
}
