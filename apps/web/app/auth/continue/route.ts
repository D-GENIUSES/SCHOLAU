import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { accountDestination } from "@/lib/auth-destination";

/** Resolve the post-login destination from fresh database roles, never form metadata. */
export async function GET(request: NextRequest) {
  const client = await getServerSupabase();
  const { data } = await client.auth.getClaims().catch(() => ({ data: null }));
  let destination = "/sign-in";
  if (data?.claims?.sub) {
    destination = await accountDestination();
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
