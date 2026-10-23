import { type EmailOtpType } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { accountDestination } from "@/lib/auth-destination";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

function redirect(request: NextRequest, path: string) {
  const response = new NextResponse(null, { status: 303 });
  response.headers.set("Location", new URL(path, request.url).toString());
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

/**
 * Email security scanners often prefetch links. Keep GET side-effect free, then
 * let a real browser submit the one-time token to the server to create its session.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const failurePath = type === "recovery" ? "/recover?status=retry" : "/verify?status=retry";

  if (!tokenHash || !isOtpType(type)) return redirect(request, failurePath);

  const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"), "/auth/continue");
  const nonce = randomUUID().replaceAll("-", "");
  const response = new NextResponse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Confirming your email</title></head>
<body><main><h1>Confirming your email</h1><p aria-live="polite">You’ll be taken to your ScholAu account in a moment.</p>
<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}"><input type="hidden" name="type" value="${escapeHtml(type)}"><input type="hidden" name="next" value="${escapeHtml(next)}"><button type="submit">Continue to ScholAu</button></form></main>
<script nonce="${nonce}">document.forms[0].requestSubmit()</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const tokenHash = form?.get("token_hash");
  const typeValue = form?.get("type");
  const nextValue = form?.get("next");
  const type = typeof typeValue === "string" ? typeValue : null;
  const failurePath = type === "recovery" ? "/recover?status=retry" : "/verify?status=retry";

  if (typeof tokenHash !== "string" || !isOtpType(type)) return redirect(request, failurePath);

  const next = type === "recovery" ? "/reset-password" : safeNext(typeof nextValue === "string" ? nextValue : null, "/auth/continue");
  try {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return redirect(request, failurePath);
    return redirect(request, next === "/auth/continue" ? await accountDestination() : next);
  } catch {
    return redirect(request, failurePath);
  }
}
