import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createScholauApi } from "@scholau/api";
import { ServerClock } from "@scholau/core";
import { SUPABASE_ANON_KEY, SUPABASE_URL, webClientHeaders } from "@/lib/env";

/** Per-request SSR client bound to the user's auth cookies. */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-anon-key", {
    global: { headers: webClientHeaders },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes sessions instead.
        }
      },
    },
  });
}

export async function getServerApi() {
  return createScholauApi(await getServerSupabase(), { clock: new ServerClock() });
}
