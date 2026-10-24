import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { accountDestination } from "@/lib/auth-destination";

/** PKCE return from email links and Google OAuth. Never expose provider errors. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/home");
  const google = searchParams.get("provider") === "google";
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  if (code && !searchParams.has("error")) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => ({ error: err }));
    if (!error) return redirect(next === "/auth/continue" ? await accountDestination() : next);
  }
  const failure = new URLSearchParams({ error: google ? "oauth" : "link" });
  if (google) failure.set("next", next);
  return redirect(`/sign-in?${failure}`);
}
