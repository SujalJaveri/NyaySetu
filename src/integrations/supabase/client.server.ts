// Server-side Supabase client with service role key - bypasses RLS when configured.
// Reads service role key from environment variables; falls back to publishable key.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const DEFAULT_SUPABASE_URL = "https://keqlhaerxaliqljyibzx.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_FZvKCCOsCUtbS9qP7v2XAw_xblsYT8d";

function createSupabaseAdminClient() {
  const SUPABASE_URL =
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    DEFAULT_SUPABASE_URL;

  const rawServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const SUPABASE_KEY =
    rawServiceKey &&
    rawServiceKey !== "placeholder-service-role-key" &&
    rawServiceKey.trim().length > 10
      ? rawServiceKey
      : (process.env["SUPABASE_PUBLISHABLE_KEY"] ||
         process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
         DEFAULT_ANON_KEY);

  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
