import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import http from "node:http";

const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const web = createRequire(resolve("apps/web/package.json"));
const { chromium } = runtime("playwright");
const { webpack } = web("next/dist/compiled/webpack/webpack");
const dir = resolve(".lecturer-verification/corrections");
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, "loader.cjs"), `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText};`);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({children,...props}) {return <a {...props}>{children}</a>}`);
await writeFile(resolve(dir, "supabase.ts"), `export const getBrowserSupabase=()=>({rpc(name){(window.rpcCalls??=[]).push(name);return {abortSignal(){return Promise.resolve({data:name==='get_registration_options_v1'?window.fixture.catalogue:window.fixture.courses,error:null})}}}});`);
await writeFile(resolve(dir, "api.ts"), `export const registrationError=()=>"Test error";export const lecturerApi=()=>({mine:async()=>({application:window.fixture.application}),resubmit:async(data,revision,key)=>{window.saved={data,revision,key};return {application:{...window.fixture.application,...data,status:'pending',revision:revision+1}}}});`);
await writeFile(resolve(dir, "entry.tsx"), `import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {LecturerApplicationPanel} from '@/components/auth/lecturer-application-panel';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><LecturerApplicationPanel/></QueryClientProvider>);`);
await new Promise((resolveBuild, reject) => webpack({ mode: "development", devtool: false, entry: resolve(dir, "entry.tsx"), output: { path: dir, filename: "bundle.js" },
  resolve: { extensions: [".tsx", ".ts", ".js", ".json"], alias: {
    "@/lib/supabase/browser": resolve(dir, "supabase.ts"), "@/lib/lecturer-api": resolve(dir, "api.ts"), "next/link": resolve(dir, "link.tsx"),
    "@": resolve("apps/web"), "@scholau/core": resolve("packages/core/src/index.ts"), "@scholau/api$": resolve("packages/api/src/index.ts"),
  }, modules: ["node_modules", resolve("apps/web/node_modules"), resolve("node_modules")] },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: resolve(dir, "loader.cjs") }] },
}, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(new Error(stats.toString({ all: false, errors: true }))) : resolveBuild()));
const id = n => `85000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const application = { id: id(20), user_id: id(21), full_name: "Dr Legacy Lecturer", email: "legacy@example.test", email_verified: true,
  university: "Legacy Institute", faculty: "Legacy faculty", department: "Legacy department", position: "Lecturer",
  requested_courses: "Legacy teaching request, exact punctuation.\nSecond line with code CSC 101", institutional_profile_url: "", verification_note: "",
  status: "changes_requested", revision: 2, applicant_message: "Please confirm your teaching role.", created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z", reviewed_at: null, assigned_offering_ids: [], history: [],
};
const catalogue = { university_id: id(1), faculties: [{ id: id(2), name: "Faculty of Science" }], departments: [{ id: id(4), faculty_id: id(2), name: "Computer Science" }] };
const courses = [{ id: id(7), code: "CSC 101", title: "Introduction to Computing" }];
const origin = process.env.LECTURER_TEST_ORIGIN ?? "http://127.0.0.1:3147";
const previewHtml = await (await fetch(origin + "/sign-up?role=lecturer")).text();
const styles = [...previewHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match => match[0].replace(/href="\//g, `href="${origin}/`)).join("");
const server = http.createServer(async (req, res) => {
  if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(await readFile(resolve(dir, "bundle.js"))); return; }
  const existing = new URL(req.url, "http://localhost").searchParams.get("existing");
  const fixture = { application: existing ? { ...application, university: "Adeleke University, Ede, Osun State", faculty: "faculty of science", department: "Computer Science" } : application, catalogue, courses };
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<body><main style="max-width:1100px;margin:auto;padding:16px"><div id="root"></div></main><script>window.fixture=${JSON.stringify(fixture)}</script><script src="/bundle.js"></script></body></html>`);
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const url = `http://127.0.0.1:${server.address().port}`;
let checks = 0;
try {
  await page.goto(url);
  await page.getByLabel("Other courses", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Other courses", { exact: true }).inputValue(), application.requested_courses); checks++;
  assert.equal(await page.getByLabel("University name", { exact: true }).inputValue(), application.university); checks++;
  await page.getByRole("button", { name: "Resubmit application", exact: true }).click();
  await page.getByText("Pending review", { exact: true }).waitFor();
  const saved = await page.evaluate(() => window.saved);
  for (const key of ["university", "faculty", "department", "requested_courses"]) { assert.equal(saved.data[key], application[key]); checks++; }
  assert.equal(saved.revision, 2); checks++;
  assert.match(saved.key, /^[0-9a-f-]{36}$/); checks++;
  await page.goto(url + "?existing=1");
  await page.getByRole("combobox", { name: "Faculty", exact: true }).filter({ visible: true }).waitFor();
  await page.getByRole("combobox", { name: "Faculty", exact: true }).click();
  await page.getByRole("option", { name: "Faculty of Science", exact: true }).click();
  // Reselecting the same faculty must preserve the saved text and course request.
  assert.equal(await page.getByLabel("Other courses", { exact: true }).inputValue(), application.requested_courses); checks++;
  await page.getByRole("button", { name: "Remove other courses", exact: true }).click();
  await page.getByRole("combobox", { name: "Courses you teach or wish to manage", exact: true }).click();
  await page.getByRole("option", { name: "CSC 101 — Introduction to Computing", exact: true }).click();
  await page.getByRole("button", { name: "Resubmit application", exact: true }).click();
  await page.getByText("Pending review", { exact: true }).waitFor();
  const updated = await page.evaluate(() => window.saved.data);
  assert.equal(updated.faculty, "faculty of science"); checks++;
  assert.equal(updated.requested_courses, "CSC 101 — Introduction to Computing"); checks++;
  await page.setViewportSize({ width: 320, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
  await page.screenshot({ path: resolve(dir, "submitted-320.png"), fullPage: true });
  assert.deepEqual(errors, []); checks++;
  console.log(JSON.stringify({ checks, pageErrors: errors, legacyTextPreserved: true }));
} catch (error) {
  console.error(JSON.stringify({ errors, calls: await page.evaluate(() => window.rpcCalls), text: await page.locator("body").innerText() }));
  await page.screenshot({ path: resolve(dir, "failure.png"), fullPage: true });
  throw error;
} finally { await browser.close(); server.close(); }
