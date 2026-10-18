import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "./server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";
import { createRequestAuthenticator } from "./request-auth";
export { allowRequestWrite } from "./request-auth";

/** A supplied Authorization header never falls back to browser cookies. getUser verifies the JWT. */
export const getRequestSupabase = createRequestAuthenticator({
  cookies: getServerSupabase,
  bearer: (token) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: "Bearer " + token } },
  }),
});
