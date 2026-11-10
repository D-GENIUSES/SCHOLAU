/**
 * Smoke: QuizEditor shows Generate questions on the Questions step and opens the dialog.
 * Serves a webpack fixture on 127.0.0.1 and prints the URL for browser verification.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";

const offering = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const dir = resolve(".lecturer-verification/generate-smoke");
await mkdir(dir, { recursive: true });

const web = createRequire(resolve("apps/web/package.json"));
const { webpack } = web("next/dist/compiled/webpack/webpack");

await writeFile(
  resolve(dir, "loader.cjs"),
  `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`,
);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
await writeFile(resolve(dir, "navigation.ts"), `export const useRouter=()=>({push:()=>{},refresh:()=>{}});`);
await writeFile(
  resolve(dir, "supabase.ts"),
  `export const getBrowserSupabase=()=>({rpc:async(name)=>{
    if(name==='get_lecturer_course_curriculum_v1'){
      return {data:{
        offering_id: window.fixture.offering,
        course:{id:window.fixture.offering,code:'TST 101',title:'Test course'},
        modules:[{id:'11111111-1111-4111-8111-111111111111',title:'Module one',position:1,lessons:[{lesson_id:'22222222-2222-4222-8222-222222222222',position:1,title:'Lesson one',has_published:true}]}]
      }, error:null};
    }
    return {data:null,error:{message:'stub'}};
  }});`,
);
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

await new Promise((done, reject) =>
  webpack(
    {
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
    },
    (error, stats) =>
      error
        ? reject(error)
        : stats.hasErrors()
          ? reject(Error(stats.toString({ all: false, errors: true })))
          : done(),
  ),
);

const bundle = await readFile(resolve(dir, "bundle.js"), "utf8");
assert.match(bundle, /Generate questions/);
assert.match(bundle, /generate-questions-dialog|GenerateQuestionsDialog|Review generated questions/);

const staticDir = resolve("apps/web/.next/static");
const css = existsSync(staticDir)
  ? readdirSync(staticDir, { recursive: true })
      .filter((n) => String(n).endsWith(".css"))
      .map((n) => readFileSync(resolve(staticDir, n), "utf8"))
      .join("\n")
  : "";

const server = http.createServer(async (req, res) => {
  try {
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
    if (req.url === "/api/lecturer-quiz-generate" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || "{}");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          questions: Array.from({ length: Number(payload.questionCount) || 10 }, (_, i) => ({
            prompt: `Generated ${i + 1}?`,
            options: ["A", "B", "C", "D"],
            correct: 0,
            explanation: "ok",
          })),
        }),
      );
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main style="max-width:900px;margin:auto;padding:16px"><div id="root"></div></main><script>window.fixture=${JSON.stringify({ offering })}</script><script src="/bundle.js"></script></body></html>`);
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e?.message || e));
  }
});

await new Promise((done) => server.listen(3020, "127.0.0.1", done));
console.log(`SMOKE_URL=http://127.0.0.1:3020`);
console.log("Bundle contains Generate questions UI.");
// Keep alive for browser verification.
await new Promise(() => {});
