import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// NyayaSetu - Fullstack SSR Vite Configuration
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env["GEMINI_API_KEY"] || ""),
      "process.env.GEMINI_MODEL": JSON.stringify(env["GEMINI_MODEL"] || "gemini-3.6-flash"),
      "process.env.SUPABASE_URL": JSON.stringify(
        env["SUPABASE_URL"] || "https://keqlhaerxaliqljyibzx.supabase.co",
      ),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env["SUPABASE_PUBLISHABLE_KEY"] || "sb_publishable_FZvKCCOsCUtbS9qP7v2XAw_xblsYT8d",
      ),
      "process.env.CUSTOM_LLM_URL": JSON.stringify(env["CUSTOM_LLM_URL"] || ""),
      "process.env.OPENAI_API_KEY": JSON.stringify(env["OPENAI_API_KEY"] || ""),
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
      }),
      react(),
      nitro({
        preset: "cloudflare-module",
      }),
    ],
  };
});
