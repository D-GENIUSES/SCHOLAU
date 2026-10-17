import { NextRequest, NextResponse } from "next/server";
import { isApiError } from "@scholau/api";
import { getServerApi, getServerSupabase } from "@/lib/supabase/server";
import { lecturerApi } from "@/lib/lecturer-api";

/** Resolve the post-login destination from fresh database roles, never form metadata. */
export async function GET(request: NextRequest) {
  const client = await getServerSupabase();
  const { data } = await client.auth.getClaims().catch(() => ({ data: null }));
  let destination = "/sign-in";
  if (data?.claims?.sub) {
    try {
      const profile = await (await getServerApi()).getMyProfile();
      if (profile.roles.includes("admin")) destination = "/admin";
      else if (profile.roles.includes("lecturer")) destination = "/lecturer";
      else if (profile.roles.includes("student")) destination = "/home";
      else { const { application } = await lecturerApi(client).mine(); destination = application ? "/lecturer/application" : "/home"; }
    } catch (error) {
      destination = isApiError(error, "FORBIDDEN") ? "/auth/deactivated" : isApiError(error, "UNAUTHENTICATED") ? "/auth/deactivated?reason=unavailable" : "/home";
    }
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
