import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

const { db, lecturer, offering } = await createChallengeTestDatabase();
await db.exec(readFileSync("supabase/migrations/20261108000100_lecturer_course_quizzes.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261108000200_fix_quiz_option_orders.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261109203000_lecturer_quiz_feedback_mode.sql", "utf8"));

const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const web = createRequire(resolve("apps/web/package.json"));
const { chromium } = runtime("playwright");
const { webpack } = web("next/dist/compiled/webpack/webpack");
const dir = resolve(".lecturer-verification/quizzes");
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, "loader.cjs"), `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
await writeFile(resolve(dir, "navigation.ts"), `export const useRouter=()=>({push:path=>{location.href=path},refresh:()=>{}});`);
await writeFile(resolve(dir, "supabase.ts"), `export const getBrowserSupabase=()=>({rpc:async(name,args)=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json','x-test-user':sessionStorage.getItem('user')||window.fixture.lecturer},body:JSON.stringify({name,args})});return r.json()}});`);
await writeFile(resolve(dir, "quiz-import.ts"), `export async function POST(){return new Response(JSON.stringify({error:'Forbidden test stub'}),{status:403});}`);
await writeFile(
  resolve(dir, "entry.tsx"),
  `import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuizEditor } from '@/components/lecturer-quizzes/quiz-editor';
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={new QueryClient()}><QuizEditor offering={window.fixture.offering} /></QueryClientProvider>,
);`,
);

await new Promise((done, reject) => webpack({
  mode: "development",
  devtool: false,
  entry: resolve(dir, "entry.tsx"),
  output: { path: dir, filename: "bundle.js" },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".mjs"],
    modules: [resolve("apps/web/node_modules"), "node_modules"],
    alias: {
      "next/link": resolve(dir, "link.tsx"),
      "next/navigation": resolve(dir, "navigation.ts"),
      "@/lib/supabase/browser": resolve(dir, "supabase.ts"),
      "@": resolve("apps/web"),
    },
  },
  module: { rules: [{ test: /\.tsx?$/, use: [resolve(dir, "loader.cjs")] }] },
}, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : done()));

const staticDir = resolve("apps/web/.next/static");
const css = readdirSync(staticDir, { recursive: true }).filter(n => n.endsWith(".css")).map(n => readFileSync(resolve(staticDir, n), "utf8")).join("\n");
const allowed = new Set([
  "list_course_quizzes_v1",
  "save_lecturer_quiz_v1",
  "publish_lecturer_quiz_v1",
  "cancel_lecturer_quiz_draft_v1",
  "get_course_quiz_v1",
]);
const errors = [];
let losePublishResponse = true;
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/rpc") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { name, args } = JSON.parse(body);
      if (!allowed.has(name)) throw Error(`RPC not allowed: ${name}`);
      const data = await db.transaction(async tx => {
        await tx.exec("reset role");
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [req.headers["x-test-user"]]);
        await tx.exec("set local role authenticated");
        const entries = Object.entries(args);
        return (await tx.query(
          `select public.${name}(${entries.map(([k], i) => `${k} => $${i + 1}`).join(",")}) value`,
          entries.map(([, v]) => v),
        )).rows[0].value;
      });
      res.setHeader("Content-Type", "application/json");
      if (name === "publish_lecturer_quiz_v1" && losePublishResponse) {
        losePublishResponse = false;
        res.statusCode = 503;
        res.end(JSON.stringify({ data: null, error: { message: "Connection interrupted" }, status: 503 }));
        return;
      }
      res.end(JSON.stringify({ data, error: null, status: 200 }));
      return;
    }
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.end(await readFile(resolve(dir, "bundle.js")));
      return;
    }
    if (req.url === "/style.css") {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.end(css);
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main style="max-width:900px;margin:auto;padding:16px"><div id="root"></div></main><script>window.fixture=${JSON.stringify({ lecturer: lecturer.uid, offering })}</script><script src="/bundle.js"></script></body></html>`);
  } catch (e) {
    res.statusCode = 500;
    res.end(e.message);
  }
});

await new Promise(done => server.listen(0, "127.0.0.1", done));
const executablePath = process.env.LECTURER_TEST_BROWSER;
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : { channel: "msedge" }), headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(12000);
page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => d.accept());

const url = `http://127.0.0.1:${server.address().port}`;
let checks = 0;
const bump = () => { checks++; };

await page.goto(url);
await page.evaluate(u => sessionStorage.setItem("user", u), lecturer.uid);
await page.goto(url);
await page.getByRole("heading", { name: "Create quiz", exact: true }).waitFor();

await page.getByLabel("Title", { exact: true }).fill("Midterm practice");
await page.getByLabel("Instructions", { exact: true }).fill("Answer every question.");
await page.getByRole("button", { name: "Continue to questions", exact: true }).click();
await page.getByRole("heading", { name: /Questions/, exact: true }).waitFor();
bump();

await page.getByRole("button", { name: "Add question", exact: true }).click();
await page.getByLabel("Question text", { exact: true }).fill("Pick four.");
for (let i = 0; i < 4; i++) await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(String(i + 3));
await page.getByRole("button", { name: "Review", exact: true }).click();
await page.getByRole("heading", { name: "Summary", exact: true }).waitFor();
await page.getByText("Schedule: ready", { exact: true }).waitFor();
bump();

await page.getByRole("button", { name: "Save draft", exact: true }).click();
await page.getByText("Draft saved.", { exact: true }).waitFor();
bump();

const publish = page.getByRole("button", { name: "Publish quiz", exact: true });
await publish.click();
await page.getByText(/Publication could not be confirmed/).waitFor();
await publish.click();
await page.waitForURL("**/lecturer/courses/**");
const quizId = (await db.query("select id from private.lecturer_course_quizzes where title='Midterm practice'")).rows[0].id;
assert.ok(quizId);
assert.equal((await db.query("select status from private.lecturer_course_quizzes where id=$1", [quizId])).rows[0].status, "published");
bump();

if (errors.length) throw Error(errors.join("\n"));
console.log(`Lecturer quiz browser: ${checks} checks passed.`);
await browser.close();
server.close();
