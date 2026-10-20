import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { accountDestination } from "@/lib/auth-destination";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/** Token-hash links (email templates using `{{ .TokenHash }}`); works across devices, unlike PKCE. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };

  if (tokenHash && isOtpType(type)) {
    // A recovery email must always open the password form, regardless of `next`.
    const next = type === "recovery" ? "/reset-password" : safeNext(searchParams.get("next"), "/auth/continue");
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }).catch((err: unknown) => ({ error: err }));
    if (!error) return redirect(next === "/auth/continue" ? await accountDestination() : next);
  }
  return redirect("/sign-in?error=link");
}
