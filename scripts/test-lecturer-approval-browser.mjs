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
const dir = resolve(".lecturer-verification/approval");
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, "loader.cjs"), `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
await writeFile(resolve(dir, "supabase.ts"), `export const getBrowserSupabase=()=>({});`);
await writeFile(resolve(dir, "api.ts"), `export const registrationError=()=>"Test error";export const lecturerApi=()=>({list:async()=>({items:[window.fixture.application],total:1,pending_count:1}),detail:async()=>({application:window.fixture.application}),offerings:async()=>({items:window.fixture.offerings}),review:async args=>{window.review=args;return {application:{...window.fixture.application,status:args.decision,revision:2,assigned_offering_ids:args.decision==='approved'?args.offeringIds:[]}}},assign:async(id,ids,revision,key)=>{window.assignment={id,ids,revision,key};return {application:{...window.fixture.application,status:'approved',revision:revision+1,assigned_offering_ids:ids}}}});`);
await writeFile(resolve(dir, "entry.tsx"), `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {AdminLecturerApplications} from '@/components/admin/admin-lecturer-applications';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><AdminLecturerApplications/></QueryClientProvider>);`);
await new Promise((done, reject) => webpack({ mode: "development", devtool: false, entry: resolve(dir, "entry.tsx"), output: { path: dir, filename: "bundle.js" }, resolve: {
  extensions: [".tsx", ".ts", ".js", ".json"], modules: ["node_modules", resolve("apps/web/node_modules"), resolve("node_modules")],
  alias: { "@/lib/supabase/browser": resolve(dir, "supabase.ts"), "@/lib/lecturer-api": resolve(dir, "api.ts"), "next/link": resolve(dir, "link.tsx"), "@": resolve("apps/web"), "@scholau/core": resolve("packages/core/src/index.ts"), "@scholau/api$": resolve("packages/api/src/index.ts") },
}, module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: resolve(dir, "loader.cjs") }] } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : done()));
const id = n => `86000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const app = { id: id(1), full_name: "Lecturer Test", email: "lecturer@example.invalid", email_verified: true, university: "Test University", faculty: "Science", department: "Computing", position: "Lecturer", requested_courses: "CSC 101 — Computing\nCustom course", verification_note: "", institutional_profile_url: "", status: "pending", revision: 1, assigned_offering_ids: [], history: [], course_assignment_plan: { offering_ids: [id(2), id(3)], unmatched_requests: ["Custom course"] } };
const offerings = [2, 3, 4].map(n => ({ id: id(n), code: n === 4 ? "CSC 201" : "CSC 101", title: n === 4 ? "Manual extra course" : "Computing", university: "Test University", department: "Computing", period: "2026/2027", semester: n === 3 ? "Second semester" : "First semester" }));
const staticDir = resolve("apps/web/.next/static");
const css = readdirSync(staticDir, { recursive: true }).filter(name => name.endsWith(".css")).map(name => readFileSync(resolve(staticDir, name), "utf8")).join("\n");
const server = http.createServer(async (req, res) => {
  if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(await readFile(resolve(dir, "bundle.js"))); return; }
  if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(css); return; }
  const fixture = { application: { ...app, email_verified: !req.url.includes("unverified") }, offerings };
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main style="max-width:1100px;margin:auto;padding:16px"><div id="root"></div></main><script>window.fixture=${JSON.stringify(fixture)}</script><script src="/bundle.js"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const errors = [], dialogs = [];
page.on("pageerror", error => errors.push(error.message));
page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
const url = `http://127.0.0.1:${server.address().port}`;
let checks = 0;
try {
  await page.goto(url); await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByText("Some course requests need manual assignment", { exact: true }).waitFor(); checks++;
  const automatic = page.getByRole("checkbox").filter({ visible: true });
  assert.equal(await automatic.count(), 3); checks++;
  for (let n = 0; n < 2; n++) { assert.equal(await automatic.nth(n).isChecked(), true); assert.equal(await automatic.nth(n).isDisabled(), true); checks += 2; }
  await automatic.nth(2).check();
  await page.getByRole("button", { name: "Approve application", exact: true }).click();
  await page.getByText("Application saved.", { exact: false }).waitFor();
  const review = await page.evaluate(() => window.review);
  assert.deepEqual(review.offeringIds, [id(2), id(3), id(4)]); checks++;
  assert.equal(review.decision, "approved"); checks++;
  assert.match(dialogs[0], /Some requested entries could not be matched/); checks++;
  assert.equal(await page.getByRole("checkbox").first().isDisabled(), false); checks++;
  await page.getByRole("checkbox").first().uncheck();
  await page.getByRole("button", { name: "Save course assignments", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.assignment));
  assert.deepEqual(await page.evaluate(() => window.assignment.ids), [id(3), id(4)]); checks++;
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
    await page.screenshot({ path: resolve(dir, `admin-${width}.png`), fullPage: true });
  }
  await page.goto(url); await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByLabel("Decision", { exact: true }).selectOption("changes_requested");
  assert.equal(await page.getByRole("checkbox").count(), 0); checks++;
  await page.getByLabel("Message visible to the applicant", { exact: true }).fill("Please confirm the custom course.");
  await page.getByRole("button", { name: "Request changes", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.review));
  assert.equal(await page.evaluate(() => window.review.decision), "changes_requested"); checks++;
  await page.goto(url + "?unverified=1"); await page.getByRole("button", { name: "Review", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Approve application", exact: true }).isDisabled(), true); checks++;
  assert.deepEqual(errors, []); checks++;
  console.log(JSON.stringify({ checks, pageErrors: errors }));
} finally { await browser.close(); server.close(); }
