import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { accountDestination } from "@/lib/auth-destination";

/** PKCE return from email links and Google OAuth. Never expose provider errors. */
export async function GET(request: NextRequest) {
  const started = performance.now();
  const timings: string[] = [];
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/home");
  const google = searchParams.get("provider") === "google";
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Server-Timing", [...timings, `auth_total;dur=${(performance.now() - started).toFixed(1)}`].join(", "));
    return response;
  };

  if (code && !searchParams.has("error")) {
    const supabase = await getServerSupabase();
    const exchangeStarted = performance.now();
    const { error } = await supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => ({ error: err }));
    timings.push(`auth_exchange;dur=${(performance.now() - exchangeStarted).toFixed(1)}`);
    if (!error) {
      const destinationStarted = performance.now();
      const destination = google || next === "/auth/continue" ? await accountDestination(next, supabase) : next;
      timings.push(`auth_destination;dur=${(performance.now() - destinationStarted).toFixed(1)}`);
      return redirect(destination);
    }
  }
  const failure = new URLSearchParams({ error: google ? "oauth" : "link" });
  if (google) failure.set("next", next);
  if (google && searchParams.get("mode") === "sign-up") {
    failure.set("role", "student");
    return redirect(`/sign-up?${failure}`);
  }
  return redirect(`/sign-in?${failure}`);
}
