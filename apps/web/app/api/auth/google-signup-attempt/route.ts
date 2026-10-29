import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { allowRequestWrite } from "@/lib/supabase/request-auth";
import { GOOGLE_SIGNUP_ATTEMPT_COOKIE, GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS } from "@/lib/google-signup-attempt";

export async function POST(request: NextRequest) {
  if (!allowRequestWrite(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const attemptId = randomUUID();
  const response = NextResponse.json({ attemptId }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(GOOGLE_SIGNUP_ATTEMPT_COOKIE, `${attemptId}:${Date.now()}`, {
    httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/auth/callback",
    maxAge: GOOGLE_SIGNUP_ATTEMPT_MAX_AGE_SECONDS,
  });
  return response;
}
