import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { safeNext } from "./utils.ts";
import { createRequestAuthenticator } from "./supabase/request-auth.ts";

function load(file, mocks) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((id) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}

test("confirmation works without a PKCE cookie and goes directly to the account", async () => {
  let received;
  const { GET } = load("../app/auth/confirm/route.ts", {
    "next/server": { NextResponse },
    "@/lib/utils": { safeNext },
    "@/lib/auth-destination": { accountDestination: async () => "/lecturer/application" },
    "@/lib/supabase/server": { getServerSupabase: async () => ({ auth: { verifyOtp: async (value) => { received = value; return { error: null }; } } }) },
  });
  const result = await GET(new NextRequest("https://scholau.vercel.app/auth/confirm?type=email&token_hash=one-use-token"));
  assert.deepEqual(received, { type: "email", token_hash: "one-use-token" });
  assert.equal(result.headers.get("location"), "https://scholau.vercel.app/lecturer/application");
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
});

test("recovery always reaches the password form; invalid and expired links fail safely", async () => {
  let fail = false;
  let calls = 0;
  const { GET } = load("../app/auth/confirm/route.ts", {
    "next/server": { NextResponse }, "@/lib/utils": { safeNext },
    "@/lib/auth-destination": { accountDestination: () => assert.fail("recovery must not resolve an account destination") },
    "@/lib/supabase/server": { getServerSupabase: async () => ({ auth: { verifyOtp: async () => { calls++; if (fail) throw Error("private detail"); return { error: null }; } } }) },
  });
  const get = (query) => GET(new NextRequest(`https://scholau.vercel.app/auth/confirm?${query}`));
  assert.equal((await get("type=recovery&token_hash=token&next=/admin")).headers.get("location"), "https://scholau.vercel.app/reset-password");
  assert.equal((await get("type=invalid&token_hash=token")).headers.get("location"), "https://scholau.vercel.app/sign-in?error=link");
  assert.equal(calls, 1);
  fail = true;
  const expired = await get("type=email&token_hash=token");
  assert.equal(expired.headers.get("location"), "https://scholau.vercel.app/sign-in?error=link");
  assert.equal(expired.headers.get("cache-control"), "private, no-store");
});

test("session refresh cookies survive redirects and query/hash destinations stay intact", async () => {
  let authenticated = true;
  const { updateSession } = load("./supabase/proxy.ts", {
    "next/server": { NextResponse }, "@/lib/utils": { safeNext },
    "./request-auth": { isBearerApiRequest: () => false },
    "@/lib/env": { SUPABASE_URL: "https://backend.example", SUPABASE_ANON_KEY: "public-key" },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () => {
      options.cookies.setAll([{ name: "session", value: authenticated ? "rotated" : "", options: { path: "/", secure: true, sameSite: "lax", maxAge: authenticated ? 3600 : 0 } }]);
      return { data: authenticated ? { claims: { sub: "account-id" } } : null };
    } } }) },
  });
  const get = (path) => updateSession(new NextRequest(`https://scholau.vercel.app${path}`));
  const result = await get("/sign-in?next=%2Fstudy%3Fsemester%3D1%23lessons");
  assert.equal(result.headers.get("location"), "https://scholau.vercel.app/study?semester=1#lessons");
  assert.equal(result.cookies.get("session").value, "rotated");
  assert.equal(result.cookies.get("session").secure, true);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  for (const next of ["/sign-in", "/sign-up?next=/sign-in", "/a/../sign-in", "/\\evil.example"]) {
    assert.equal((await get(`/sign-in?next=${encodeURIComponent(next)}`)).headers.get("location"), "https://scholau.vercel.app/auth/continue");
  }
  authenticated = false;
  const expired = await get("/admin");
  assert.equal(expired.cookies.get("session").maxAge, 0);
  assert.equal(expired.headers.get("location"), "https://scholau.vercel.app/sign-in?next=%2Fadmin");
});

test("invalid bearer credentials cannot inherit authenticated cookies", async () => {
  let cookies = 0;
  const authenticate = createRequestAuthenticator({
    cookies: async () => { cookies++; return {}; },
    bearer: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: Error("invalid") }) } }),
  });
  for (const authorization of ["Basic abc", "Bearer bad-token", "Bearer two tokens"]) {
    await assert.rejects(authenticate(new Request("https://scholau.vercel.app/api/account/photo", { headers: { authorization } })), /INVALID_BEARER_TOKEN/);
  }
  assert.equal(cookies, 0);
});

test("account destination uses database roles and honors blocked accounts", async () => {
  let roles = ["student"];
  let failure;
  let onboarding = false;
  const { accountDestination } = load("./auth-destination.ts", {
    "server-only": {},
    "@scholau/api": { isApiError: (error, code) => error.code === code },
    "@scholau/core": { readRegistrationAcademic: () => null },
    "@/lib/supabase/server": { getServerApi: async () => ({ getMyProfile: async () => { if (failure) throw { code: failure, field_errors: { registration_required: true } }; return { roles, needs_onboarding: onboarding }; } }), getServerSupabase: async () => ({ auth: { getClaims: async () => ({ data: { claims: {} } }) } }) },
    "@/lib/lecturer-api": { lecturerApi: () => ({ mine: async () => ({ application: { status: "pending" } }) }) },
  });
  for (const [value, destination] of [[["admin", "student"], "/admin"], [["lecturer"], "/lecturer"], [["student"], "/home"], [[], "/lecturer/application"]]) {
    roles = value;
    assert.equal(await accountDestination(), destination);
  }
  failure = "FORBIDDEN";
  assert.equal(await accountDestination(), "/auth/deactivated");
  failure = "UNAUTHENTICATED";
  assert.equal(await accountDestination(), "/auth/deactivated?reason=unavailable");
  failure = "INVALID_STATE";
  assert.equal(await accountDestination(), "/complete-registration");
  failure = undefined;
  roles = ["student"];
  onboarding = true;
  assert.equal(await accountDestination(), "/onboarding");
});
