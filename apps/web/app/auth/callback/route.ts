import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { accountDestination } from "@/lib/auth-destination";
import { GOOGLE_SIGNUP_ATTEMPT_COOKIE, isNewGoogleSignup } from "@/lib/google-signup-attempt";

/** PKCE return from email links and Google OAuth. Never expose provider errors. */
export async function GET(request: NextRequest) {
  const started = performance.now();
  const timings: string[] = [];
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/home");
  const google = searchParams.get("provider") === "google";
  const googleSignup = google && searchParams.get("mode") === "sign-up";
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    if (googleSignup) response.cookies.set(GOOGLE_SIGNUP_ATTEMPT_COOKIE, "", { path: "/auth/callback", maxAge: 0 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Server-Timing", [...timings, `auth_total;dur=${(performance.now() - started).toFixed(1)}`].join(", "));
    return response;
  };

  if (code && !searchParams.has("error")) {
    const supabase = await getServerSupabase();
    const exchangeStarted = performance.now();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => ({ data: null, error: err }));
    timings.push(`auth_exchange;dur=${(performance.now() - exchangeStarted).toFixed(1)}`);
    if (!error) {
      if (googleSignup && !isNewGoogleSignup(data?.user?.created_at, request.cookies.get(GOOGLE_SIGNUP_ATTEMPT_COOKIE)?.value, searchParams.get("attempt"))) {
        await supabase.auth.signOut({ scope: "local" });
        const failure = new URLSearchParams({ error: "account-exists", role: "student" });
        if (next !== "/home") failure.set("next", next);
        return redirect(`/sign-up?${failure}`);
      }
      const destinationStarted = performance.now();
      const destination = google || next === "/auth/continue" ? await accountDestination(next, supabase) : next;
      timings.push(`auth_destination;dur=${(performance.now() - destinationStarted).toFixed(1)}`);
      return redirect(destination);
    }
  }
  const failure = new URLSearchParams({ error: google ? "oauth" : "link" });
  if (google) failure.set("next", next);
  if (googleSignup) {
    failure.set("role", "student");
    return redirect(`/sign-up?${failure}`);
  }
  return redirect(`/sign-in?${failure}`);
}
