import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { adminUserSchema } from "@/lib/admin-users-schema";
import { getServerSupabase } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/env";
import { isSameOriginRequest } from "@/lib/supabase/request-auth";

export const runtime = "nodejs";
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // Cookie-authenticated mutations must come from this application's origin.
  if (!isSameOriginRequest(request)) return reply("Request origin is not allowed.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply("Use JSON for this request.", 415);
  if (Number(request.headers.get("content-length")) > 8192) return reply("Request is too large.", 413);
  try {
    const client = await getServerSupabase();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply("Sign in again to continue.", 401);
    // This RPC checks the active admin role afresh and proves the migration is installed.
    const { data: access, error: accessError } = await client.rpc("admin_user_creation_access_v1");
    if (accessError) return reply("User creation is unavailable or administrator access is required.", 403);
    if (access?.actor_id !== auth.user.id) return reply("Administrator access required.", 403);
    const body = await request.text();
    if (body.length > 8192) return reply("Request is too large.", 413);
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return reply("Invalid JSON.", 400); }
    const parsed = adminUserSchema.safeParse(raw);
    if (!parsed.success) return reply(parsed.error.issues[0]?.message ?? "Check the account details.", 400);
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return reply("User creation has not been configured on the server. Contact the site administrator.", 503);
    const { displayName, email, password, role, requestKey } = parsed.data;
    // Independent client: never replace the administrator's session with the new account.
    const admin = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: displayName, signup_kind: "admin_managed", managed_role: role },
      app_metadata: { scholau_provision: { actor_id: auth.user.id, role, request_key: requestKey } },
    });
    if (error) {
      if (["email_exists", "user_already_exists"].includes(error.code ?? "")) return reply("An account with this email already exists. Its details and password have not been changed.", 409);
      if (error.code === "weak_password") return reply("Choose a stronger password that meets the site's password policy.", 400);
      return reply("The account could not be created. Check whether it already exists before retrying.", 502);
    }
    if (!data.user) return reply("Account creation could not be confirmed. Check before retrying.", 502);
    return NextResponse.json({ user: { id: data.user.id, email, displayName, role } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never log request bodies, credentials, or raw Auth errors.
    return reply("Account creation could not be confirmed. Check before retrying.", 503);
  }
}
