import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Ends the session of a deactivated account before showing the notice. Redirecting a signed-in user
 * straight to /sign-in would loop, because the proxy sends signed-in users away from auth pages.
 */
export async function GET(request: NextRequest) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut().catch(() => undefined);
  const destination = request.nextUrl.searchParams.get("reason") === "unavailable" ? "/sign-in" : "/sign-in?deactivated=1";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
