import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { safeNext } from "../../lib/utils.ts";
import { param } from "./params.ts";

function load(file, mocks, window = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", "window", compiled)((id) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports, window);
  return exports;
}

test("method links retain safe destinations and auth notices without carrying unrelated query data", () => {
  const { authContext, authHref } = load("./auth-navigation.ts", { "@/lib/utils": { safeNext }, "./params": { param } });
  const context = authContext({ next: "/study?semester=1#lessons", error: "oauth", deactivated: "1", code: "never-copy" });
  const email = new URL(authHref("/sign-up", context, { role: "student", method: "email" }), "https://scholau.com");
  assert.equal(email.searchParams.get("next"), "/study?semester=1#lessons");
  assert.equal(email.searchParams.get("method"), "email");
  assert.equal(email.searchParams.get("role"), "student");
  assert.equal(email.searchParams.get("error"), "oauth");
  assert.equal(email.searchParams.get("deactivated"), "1");
  assert.equal(email.searchParams.has("code"), false);
  assert.equal(new URL(authHref("/sign-in", context), email).searchParams.has("method"), false);
  assert.equal(authHref("/sign-in", { next: "https://evil.example", error: "private-error" }), "/sign-in?next=%2Fauth%2Fcontinue");
});

/** Exercise the component's event handlers with deterministic hooks and provider promises. */
function googleHarness(signInWithOAuth) {
  const slots = [];
  let cursor = 0;
  let mounted = false;
  let cleanup;
  const events = new Map();
  const timers = new Map();
  let timerId = 0;
  const redirects = [];
  const window = {
    location: { origin: "https://scholau.com", assign: (url) => redirects.push(url) },
    addEventListener: (event, handler) => events.set(event, handler),
    removeEventListener: (event) => events.delete(event),
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  };
  const hooks = {
    useRef: (value) => { const id = cursor++; return slots[id] ??= { current: value }; },
    useState: (value) => { const id = cursor++; if (!(id in slots)) slots[id] = value; return [slots[id], (next) => { slots[id] = next; }]; },
    useEffect: (effect) => { if (!mounted) { cleanup = effect(); mounted = true; } },
  };
  const { GoogleSignIn } = load("./google-sign-in.tsx", {
    react: hooks, "react/jsx-runtime": jsx, "lucide-react": { LoaderCircle: "spinner" },
    "@/components/ui/alert": { Alert: "alert" }, "@/components/ui/button": { Button: "button" },
    "@/lib/utils": { safeNext }, "@/lib/supabase/browser": { getBrowserSupabase: () => ({ auth: { signInWithOAuth } }) },
    "@/lib/auth-timing": { measureAuth() {}, markGoogleDeparture() {} },
  }, window);
  const render = (props = {}) => { cursor = 0; return GoogleSignIn(props).props.children; };
  return { render, redirects, back: () => events.get("pageshow")({ persisted: true }), load: () => events.get("pageshow")({ persisted: false }), timeout: () => { for (const callback of timers.values()) callback(); timers.clear(); }, unmount: () => cleanup() };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("Google immediately loads, ignores duplicate clicks and requests same-tab account selection", async () => {
  let finish;
  const calls = [];
  const app = googleHarness((args) => { calls.push(args); return new Promise((resolve) => { finish = resolve; }); });
  const click = app.render({ mode: "sign-up", next: "/study?semester=1", label: "Sign up with Google" })[1].props.onClick;
  click(); click();
  app.load();
  assert.equal(calls.length, 1);
  const pending = app.render();
  assert.equal(pending[1].props.loading, true);
  assert.equal(pending[2].props.role, "status");
  assert.match(pending[2].props.children, /Opening Google/);
  assert.deepEqual(calls[0].options.queryParams, { prompt: "select_account" });
  assert.equal(calls[0].options.skipBrowserRedirect, true);
  const callback = new URL(calls[0].options.redirectTo);
  assert.equal(callback.origin, "https://scholau.com");
  assert.equal(callback.searchParams.get("mode"), "sign-up");
  assert.equal(callback.searchParams.get("next"), "/study?semester=1");
  finish({ data: { url: "https://provider.example/authorize" }, error: null }); await flush();
  assert.deepEqual(app.redirects, ["https://provider.example/authorize"]);
  app.back();
  assert.equal(app.render()[1].props.loading, false);
  app.render()[1].props.onClick();
  assert.equal(calls.length, 2);
  app.unmount(); finish({ data: { url: "https://provider.example/stale" }, error: null }); await flush();
  assert.equal(app.redirects.length, 1);
});

test("failed or stalled Google starts allow retries and cannot redirect from an expired attempt", async () => {
  let finish;
  let calls = 0;
  const app = googleHarness(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  app.render()[1].props.onClick();
  const expired = finish;
  app.timeout();
  assert.equal(app.render()[1].props.loading, false);
  assert.match(app.render()[0].props.children, /longer than expected/);
  app.render()[1].props.onClick();
  assert.equal(calls, 2);
  expired({ data: { url: "https://provider.example/stale" }, error: null }); await flush();
  assert.equal(app.redirects.length, 0);
  finish({ data: {}, error: new Error("private-detail") }); await flush();
  assert.equal(app.render()[1].props.loading, false);
  assert.match(app.render()[0].props.children, /could not start/);
  assert.doesNotMatch(app.render()[0].props.children, /private-detail/);
  app.render({ disabled: true })[1].props.onClick();
  assert.equal(calls, 2);
  app.unmount();
});
