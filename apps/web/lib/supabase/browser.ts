import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, webClientHeaders } from "@/lib/env";

let client: SupabaseClient | undefined;

/** Singleton browser client (anon key + user session cookies). Never a service-role key. */
export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-anon-key", {
      global: { headers: webClientHeaders },
    });
  }
  return client;
}
