import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { safeNext } from "../../lib/utils.ts";

const source = readFileSync(new URL("../../app/auth/callback/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function callback(exchange, destination = async (next) => next === "/auth/continue" ? "/admin" : safeNext(next)) {
  const exports = {};
  const client = { auth: { exchangeCodeForSession: exchange } };
  const mocks = {
    "next/server": { NextResponse: { redirect: (url) => new Response(null, { status: 307, headers: { Location: url.toString() } }) } },
    "@/lib/supabase/server": { getServerSupabase: async () => client },
    "@/lib/utils": { safeNext },
    "@/lib/auth-destination": { accountDestination: async (next, supplied) => { assert.equal(supplied, client); return destination(next); } },
  };
  new Function("require", "exports", compiled)((id) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports);
  return (query) => {
    const url = `https://scholau.vercel.app/auth/callback?${query}`;
    return exports.GET({ url, nextUrl: new URL(url) });
  };
}

test("Google callback exchanges the code and enters the account directly", async () => {
  const get = callback(async (code) => { assert.equal(code, "test-code"); return { error: null }; });
  const response = await get("provider=google&code=test-code&next=%2Fauth%2Fcontinue");
  assert.equal(response.headers.get("location"), "https://scholau.vercel.app/admin");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("server-timing"), /auth_exchange;dur=[\d.]+, auth_destination;dur=[\d.]+, auth_total;dur=[\d.]+/);
});

test("Google signup cancellation returns to student methods and retains the destination", async () => {
  const get = callback(() => assert.fail("cancelled OAuth must not exchange a code"));
  const response = await get("provider=google&mode=sign-up&error=access_denied&next=%2Fstudy%3Fsemester%3D1");
  const url = new URL(response.headers.get("location"));
  assert.equal(url.pathname, "/sign-up");
  assert.equal(url.searchParams.get("role"), "student");
  assert.equal(url.searchParams.get("error"), "oauth");
  assert.equal(url.searchParams.get("next"), "/study?semester=1");
});

test("Google always resolves registration and roles even with an explicit next destination", async () => {
  for (const destination of ["/complete-registration", "/onboarding", "/admin", "/lecturer", "/auth/deactivated", "/study?semester=1"]) {
    const response = await callback(async () => ({ error: null }), async (next) => {
      assert.equal(next, "/study?semester=1");
      return destination;
    })("provider=google&code=valid&next=%2Fstudy%3Fsemester%3D1");
    assert.equal(new URL(response.headers.get("location")).pathname, destination.split("?")[0]);
  }
});

test("Google cancellation and exchange failures return a generic retry message", async () => {
  for (const exchange of [async () => ({ error: new Error("private backend detail") }), async () => { throw new Error("private backend detail"); }]) {
    const response = await callback(exchange)("provider=google&code=test-code&next=%2Fcourses");
    assert.equal(response.headers.get("location"), "https://scholau.vercel.app/sign-in?error=oauth&next=%2Fcourses");
  }
  const response = await callback(() => assert.fail("must not exchange a denied request"))("provider=google&error=access_denied&code=ignored");
  assert.match(response.headers.get("location"), /error=oauth/);
});

test("email callback remains compatible and unsafe destinations are rejected", async () => {
  const get = callback(async () => ({ error: null }));
  assert.equal((await get("code=email-code")).headers.get("location"), "https://scholau.vercel.app/home");
  assert.equal((await get("provider=google&code=test-code&next=%2F%5Cevil.example")).headers.get("location"), "https://scholau.vercel.app/home");
  assert.equal((await get("")).headers.get("location"), "https://scholau.vercel.app/sign-in?error=link");
});
