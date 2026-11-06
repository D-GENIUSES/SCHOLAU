import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";

const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const web = createRequire(resolve("apps/web/package.json"));
const { chromium } = runtime("playwright");
const { webpack } = web("next/dist/compiled/webpack/webpack");
const dir = resolve(".lecturer-verification/profile");
await mkdir(dir, { recursive: true });
const now = "2026-11-06T12:00:00Z";
const profile = { id: "86000000-0000-4000-8000-000000000001", server_time: now, username: "amara_o", display_name: "Amara Okafor", avatar_path: "presets/person-0", xp_total: 1280, roles: ["student", "admin"], leaderboard_visible: true,
  streak: { current: 7, longest: 9, active_today: true }, learning_totals: { lessons_completed: 24, battles_completed: 12 }, academic: {
    university: { id: "u", name: "Augustine University" }, faculty: { id: "f", name: "Science" }, department: { id: "d", name: "Computer Science" }, level: { id: "l", label: "200 Level" }, semester: { id: "s", label: "First semester" }, academic_period: { id: "p", label: "2026/2027" }, self_change_used_this_period: false,
  } };
const person = { user_id: "friend", display_name: "Chidi Eze", username: "chidi_e", avatar_path: null, state: "pending", incoming: true };
const data = {
  get_my_profile_v1: profile,
  get_friends_v1: { server_time: now, username: "amara_o", people: [person] },
  get_learning_insights_v1: { server_time: now, strengths: [{ lesson_id: "strong", title: "Cell biology", course_code: "BIO 101", accuracy: 95 }], weaknesses: Array.from({ length: 4 }, (_, i) => ({ lesson_id: `lesson-${i}`, title: ["Sets and functions", "Logic gates", "Boolean algebra", "Hidden fourth topic"][i], course_code: "CSC 203", accuracy: 60 + i })) },
  get_xp_progress_v1: { server_time: now, xp_total: 1280, badges: [{ code: "first_steps", awarded_at: now }], history: Array.from({ length: 5 }, (_, i) => ({ id: `xp-${i}`, activity: i === 1 ? "battle" : "practice", reason: `Quiz ${i + 1}`, date: now, amount: 10 + i })), reviews: [{ lesson_id: "review-lesson", title: "Cell biology", stage: 1, due_at: now, available: true, completed: false }] },
  get_notification_preferences_v1: { server_time: now, preferences: { activity: true, academic: true, announcement: true, account: true, reminder: true, timezone: "Africa/Lagos", reminder_time: "18:00", quiet_start: "22:00", quiet_end: "08:00", updated_at: null }, push_available: false, vapid_public_key: "", devices: [] },
};
await writeFile(resolve(dir, "loader.cjs"), `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`);
await writeFile(resolve(dir, "navigation.ts"), `export function useRouter(){return {push:path=>{window.lastRoute=path},refresh:()=>{},replace:()=>{}}}`);
await writeFile(resolve(dir, "image.tsx"), `export default function Image({unoptimized,priority,fill,...props}){return <img {...props}/>}`);
await writeFile(resolve(dir, "supabase.ts"), `export const client={auth:{signOut:async()=>({error:null})},rpc:async(name,args)=>{const res=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,empty:location.search.includes('empty')})});return res.json()}};export const getBrowserSupabase=()=>client;`);
await writeFile(resolve(dir, "entry.tsx"), `import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{createScholauApi}from'@scholau/api';import{ScholauApiProvider}from'@scholau/api/react';import{ProfileView}from'@/components/profile/profile-view';import{client}from'./supabase';const api=createScholauApi(client);const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><ScholauApiProvider api={api}><ProfileView email="amara@example.invalid"/></ScholauApiProvider></QueryClientProvider>);`);
await new Promise((done, reject) => webpack({ mode: "development", devtool: false, entry: resolve(dir, "entry.tsx"), output: { path: dir, filename: "bundle.js", publicPath: "/" }, resolve: { extensions: [".tsx", ".ts", ".js", ".mjs"], modules: [resolve("apps/web/node_modules"), "node_modules"], alias: { "next/link": resolve(dir, "link.tsx"), "next/navigation": resolve(dir, "navigation.ts"), "next/image": resolve(dir, "image.tsx"), "@/lib/supabase/browser": resolve(dir, "supabase.ts"), "@": resolve("apps/web") } }, module: { rules: [{ test: /\.tsx?$/, use: [resolve(dir, "loader.cjs")] }] } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : done()));
const css = readdirSync("apps/web/.next/static", { recursive: true }).filter(n => n.endsWith(".css")).map(n => readFileSync(resolve("apps/web/.next/static", n), "utf8")).join("\n");
const calls = [], errors = [];
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/rpc") {
      let body = ""; for await (const chunk of req) body += chunk;
      const { name, args, empty } = JSON.parse(body); calls.push(name);
      let result = structuredClone(data[name]);
      if (name === "start_topic_review_v1") result = { attempt_id: "scheduled-review" };
      if (name === "update_profile_v2") { profile.username = args.p_username; profile.leaderboard_visible = args.p_leaderboard_visible; result = profile; }
      if (!result) throw Error(`Unexpected RPC: ${name}`);
      if (empty) {
        if (name === "get_my_profile_v1") { result.xp_total = 0; result.display_name = "A student with an exceptionally long profile name that must wrap safely"; result.streak.current = 0; result.learning_totals = { lessons_completed: 0, battles_completed: 0 }; result.academic = null; }
        if (name === "get_friends_v1") result.people = [];
        if (name === "get_learning_insights_v1") { result.strengths = []; result.weaknesses = []; }
        if (name === "get_xp_progress_v1") { result.history = []; result.badges = []; result.reviews = []; }
      }
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ data: result, error: null, status: 200 })); return;
    }
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.endsWith(".js")) { const file = resolve(dir, "." + url.pathname); assert.ok(file.startsWith(dir + "/") || file.startsWith(dir + "\\")); res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(file)); return; }
    if (url.pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); res.end(css); return; }
    if (url.pathname.startsWith("/avatars/")) { res.setHeader("Content-Type", "image/svg+xml"); res.end(await readFile(resolve("apps/web/public", "." + url.pathname))); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-surface-page text-ink"><main style="max-width:900px;margin:auto;padding:16px"><div id="root"></div></main><script src="/bundle.js"></script></body></html>`);
  } catch (error) { errors.push(error.message); res.statusCode = 500; res.end(error.message); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage(); page.setDefaultTimeout(12000); page.on("pageerror", e => errors.push(e.message));
let checks = 0; const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const url = `http://127.0.0.1:${server.address().port}`;
try {
  await page.goto(url); await page.getByRole("heading", { name: "Amara Okafor", exact: true }).waitFor();
  await page.getByText("Sets and functions", { exact: true }).waitFor();
  eq(await page.locator("[data-profile-xp] svg").count(), 0);
  eq(await page.getByRole("button", { name: "Settings", exact: true }).locator("svg.lucide-settings").count(), 1);
  eq(await page.getByRole("radio").count(), 3);
  eq(await page.getByText("Hidden fourth topic", { exact: true }).count(), 0);
  eq(calls.includes("get_notification_preferences_v1"), false);
  eq(await page.getByRole("img", { name: /XP/ }).count(), 0);
  await page.getByRole("button", { name: "View activity", exact: true }).click();
  await page.getByRole("heading", { name: "Last 7 days", exact: true }).waitFor(); checks++;
  await page.getByText("Scheduled reviews · Review due", { exact: true }).click();
  await page.getByRole("button", { name: "Start review", exact: true }).click();
  await page.waitForFunction(() => window.lastRoute === "/attempts/scheduled-review"); checks++;
  await page.getByRole("button", { name: "Show less", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ["Overview", "Badges", "Friends (1)"]) {
      await page.getByRole("radio", { name: tab, exact: true }).check();
      if (tab === "Badges") await page.getByRole("heading", { name: "Your achievements", exact: true }).waitFor();
      if (tab === "Friends (1)") await page.getByRole("button", { name: "Accept", exact: true }).waitFor();
      eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.waitForTimeout(180);
      await page.screenshot({ path: resolve(dir, `${tab.replaceAll(/\W/g, "-")}-${width}.png`), fullPage: true });
    }
  }
  await page.getByRole("radio", { name: "Badges", exact: true }).check();
  eq(await page.getByText("Perfect Practice", { exact: true }).isVisible(), false);
  await page.getByText("View locked badges", { exact: true }).click(); eq(await page.getByText("Perfect Practice", { exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await page.getByRole("button", { name: "Account", exact: true }).click(); await page.getByText("amara@example.invalid", { exact: true }).waitFor(); checks++;
  await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  await page.getByRole("button", { name: "Academic details", exact: true }).click(); await page.getByRole("button", { name: "Request a change", exact: true }).waitFor(); checks++;
  await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  await page.getByRole("button", { name: "Notifications", exact: true }).click(); await page.getByRole("switch", { name: "Notifications on this device" }).waitFor(); eq(calls.includes("get_notification_preferences_v1"), true);
  await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  await page.getByRole("button", { name: "Security & privacy", exact: true }).click(); eq(await page.getByRole("link", { name: "Change password", exact: true }).getAttribute("href"), "/change-password");
  await page.getByRole("button", { name: "Manage visibility", exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Username", { exact: true }).fill("amara_updated"); await dialog.getByRole("button", { name: "Save changes", exact: true }).click(); await dialog.getByText("Saved", { exact: true }).waitFor(); checks++;
  await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Back to settings", exact: true }).click();
  await page.getByRole("button", { name: "Support", exact: true }).click(); eq(await page.getByRole("link", { name: "Admin", exact: true }).count(), 1);
  await page.getByRole("button", { name: "Back to settings", exact: true }).click(); await page.getByRole("button", { name: "Back to profile", exact: true }).click(); await page.getByRole("button", { name: "Settings", exact: true }).waitFor(); eq(await page.getByRole("button", { name: "Settings", exact: true }).evaluate(el => el === document.activeElement), true);
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto(url + "?empty=1"); await page.getByRole("heading", { name: /exceptionally long/ }).waitFor();
  eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByText("Your learning activity will appear here.", { exact: true }).waitFor(); checks++;
  await page.screenshot({ path: resolve(dir, "empty-320.png"), fullPage: true });
  eq(errors, []); console.log(`Profile browser: ${checks} checks passed, including real edit/save hooks, review actions and responsive layouts.`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
