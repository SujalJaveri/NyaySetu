import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Fullstack SSR Vite Configuration for TanStack Start & Nitro Engine
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start bundled server entry to src/server.ts for SSR error resilience
    server: { entry: "server" },
  },
});
