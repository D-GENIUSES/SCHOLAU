import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { safeNext } from "../../lib/utils.ts";

const source = readFileSync(new URL("../../app/auth/callback/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function callback(exchange) {
  const exports = {};
  const mocks = {
    "next/server": { NextResponse: { redirect: (url) => new Response(null, { status: 307, headers: { Location: url.toString() } }) } },
    "@/lib/supabase/server": { getServerSupabase: async () => ({ auth: { exchangeCodeForSession: exchange } }) },
    "@/lib/utils": { safeNext },
    "@/lib/auth-destination": { accountDestination: async () => "/admin" },
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
  assert.equal((await get("")).headers.get("location"), "https://scholau.vercel.app/verify?status=retry");
});
