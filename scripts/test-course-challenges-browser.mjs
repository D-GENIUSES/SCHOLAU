import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";
const { db, lecturer, students, offering } = await createChallengeTestDatabase();
const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const web = createRequire(resolve("apps/web/package.json"));
const { chromium } = runtime("playwright");
const { webpack } = web("next/dist/compiled/webpack/webpack");
const dir = resolve(".lecturer-verification/challenges");
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, "loader.cjs"), `const ts=require(${JSON.stringify(web.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`);
await writeFile(resolve(dir, "link.tsx"), `export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
await writeFile(resolve(dir, "navigation.ts"), `export const useRouter=()=>({push:path=>{location.href=path},refresh:()=>{}});`);
await writeFile(resolve(dir, "supabase.ts"), `export const getBrowserSupabase=()=>({rpc:async(name,args)=>{if(window.failNextSave&&name==='answer_course_challenge_v1'){window.failNextSave=false;return {data:null,status:503,error:{message:'Connection interrupted'}}}const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json','x-test-user':sessionStorage.getItem('user')||window.fixture.lecturer},body:JSON.stringify({name,args})});return r.json()}});`);
await writeFile(resolve(dir, "entry.tsx"), `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{CourseChallenges,CourseRoster}from'@/components/challenges/course-challenges';import{ChallengeEditor}from'@/components/challenges/challenge-editor';import{ChallengeRoom}from'@/components/challenges/challenge-room';const path=location.pathname;const content=path==='/new'?<ChallengeEditor offering={window.fixture.offering}/>:path.startsWith('/challenges/')?<ChallengeRoom id={path.split('/')[2]}/>:path==='/students'?<CourseRoster offering={window.fixture.offering}/>:<CourseChallenges offering={window.fixture.offering}/>;createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{content}</QueryClientProvider>);`);
await new Promise((done, reject) => webpack({ mode: "development", devtool: false, entry: resolve(dir, "entry.tsx"), output: { path: dir, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js", ".mjs"], modules: [resolve("apps/web/node_modules"), "node_modules"], alias: { "next/link": resolve(dir,"link.tsx"), "next/navigation":resolve(dir,"navigation.ts"), "@/lib/supabase/browser":resolve(dir,"supabase.ts"), "@": resolve("apps/web") } }, module: { rules: [{ test: /\.tsx?$/, use: [resolve(dir, "loader.cjs")] }] } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : done()));
const staticDir=resolve('apps/web/.next/static');
const css=readdirSync(staticDir,{recursive:true}).filter(n=>n.endsWith('.css')).map(n=>readFileSync(resolve(staticDir,n),'utf8')).join('\n');
const calls=[], errors=[];
const allowed=new Set(['list_course_challenges_v1','challenge_question_bank_v1','save_course_challenge_v1','publish_course_challenge_v1','cancel_course_challenge_v1','get_course_challenge_v1','join_course_challenge_v1','answer_course_challenge_v1','submit_course_challenge_v1','course_challenge_roster_v1']);
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/rpc'){
   let body='';for await(const chunk of req)body+=chunk;const {name,args}=JSON.parse(body);
   if(!allowed.has(name))throw Error('RPC not allowed');
   calls.push(name);
   try {
    const data=await db.transaction(async tx=>{
     await tx.exec('reset role');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[req.headers['x-test-user']]);await tx.exec('set local role authenticated');
     const entries=Object.entries(args);
     return (await tx.query(`select public.${name}(${entries.map(([k],i)=>`${k} => $${i+1}`).join(',')}) value`,entries.map(([,v])=>v))).rows[0].value;
    });res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error:null,status:200}));
   }catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:e.message,details:e.detail,code:e.code},status:400}));}
   return;
  }
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(resolve(dir,'bundle.js')));return;}
  if(req.url==='/style.css'){res.setHeader('Content-Type','text/css; charset=utf-8');res.end(css);return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main style="max-width:900px;margin:auto;padding:16px"><div id="root"></div></main><script>window.fixture=${JSON.stringify({lecturer:lecturer.uid,offering})}</script><script src="/bundle.js"></script></body></html>`);
 }catch(e){res.statusCode=500;res.end(e.message);}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const url=`http://127.0.0.1:${server.address().port}`;let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function login(user,path='/'){await page.goto(url);await page.evaluate(u=>sessionStorage.setItem('user',u),user);await page.goto(url+path);}
try{
 await login(lecturer.uid,'/new');await page.getByLabel('Title',{exact:true}).fill('Live classroom challenge');
 await page.getByLabel('Instructions',{exact:true}).fill('Answer both questions.');
 await page.getByRole('button',{name:'Write a question',exact:true}).click();
 await page.getByLabel('Question 1 text',{exact:true}).fill('Choose the number four.');
 for(let i=0;i<4;i++)await page.getByLabel(`Question 1 option ${i+1}`,{exact:true}).fill(String(i+3));
 await page.getByLabel('Correct answer for question 1',{exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Choose from course bank',exact:true}).click();
 await page.getByRole('button',{name:'Add question',exact:true}).click();
 eq(await page.getByRole('button',{name:'Add question',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Close question bank',exact:true}).click();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(dir,`editor-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved.',{exact:true}).waitFor();checks++;
 const cid=(await db.query("select id from private.course_challenges where title='Live classroom challenge'")).rows[0].id;
 await page.goto(url+`/challenges/${cid}`);await page.getByRole('heading',{name:'Edit challenge',exact:true}).waitFor();eq(await page.getByLabel('Question 1 text',{exact:true}).inputValue(),'Choose the number four.');
 await page.getByRole('button',{name:'Publish and start',exact:true}).click();await page.getByRole('heading',{name:'Participation',exact:true}).waitFor();checks++;
 eq((await db.query('select count(*)::int n from public.notifications where safe_target=$1',[`/challenges/${cid}`])).rows[0].n,3);
 await login(students[0],`/challenges/${cid}`);await page.getByRole('button',{name:'Join challenge',exact:true}).click();await page.getByRole('radio',{name:'4',exact:true}).waitFor();
 await page.evaluate(()=>window.failNextSave=true);await page.getByRole('radio',{name:'4',exact:true}).check();await page.getByText('Answer not saved.',{exact:false}).waitFor();eq(await page.getByRole('button',{name:'Submit answers',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Retry saving answer',exact:true}).click();await page.getByText('All changes saved.',{exact:true}).waitFor();checks++;
 const secondTab=await page.context().newPage();await secondTab.goto(url);await secondTab.evaluate(u=>sessionStorage.setItem('user',u),students[0]);await secondTab.goto(url+`/challenges/${cid}`);
 await secondTab.getByRole('radio',{name:'3',exact:true}).check();await secondTab.getByText('All changes saved.',{exact:true}).waitFor();await secondTab.close();
 await page.getByRole('radio',{name:'5',exact:true}).check();await page.getByText('This challenge or attempt changed in another tab.',{exact:false}).waitFor();checks++;
 await page.getByRole('button',{name:'Reload saved answers',exact:true}).click();await page.getByText('All changes saved.',{exact:true}).waitFor();eq(await page.getByRole('radio',{name:'3',exact:true}).isChecked(),true);
 await page.getByRole('radio',{name:'4',exact:true}).check();await page.getByText('All changes saved.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('radio',{name:'4',exact:true}).waitFor();eq(await page.getByRole('radio',{name:'4',exact:true}).isChecked(),true);
 await page.getByRole('button',{name:'Next question',exact:true}).click();await page.getByRole('radio',{name:'2',exact:true}).focus();await page.keyboard.press('Space');await page.getByText('2/2 answered',{exact:true}).waitFor();checks++;
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(dir,`attempt-${width}.png`),fullPage:true});}
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.getByText('Answers submitted.',{exact:false}).waitFor();eq(await page.getByText('Final ranking',{exact:true}).count(),0);
 // A second student arrives late and leaves the attempt open for automatic submission.
 await login(students[1],`/challenges/${cid}`);await page.getByRole('button',{name:'Join challenge',exact:true}).click();await page.getByRole('radio',{name:'3',exact:true}).check();await page.getByText('All changes saved.',{exact:true}).waitFor();
 await db.exec('reset role');await db.query("update private.course_challenges set starts_at=now()-interval '15 minutes',ends_at=now()-interval '1 second' where id=$1",[cid]);
 await page.reload();await page.getByRole('heading',{name:'Final ranking',exact:true}).waitFor();await page.getByText('Score: 0/2',{exact:true}).waitFor();checks++;
 await login(students[0],`/challenges/${cid}`);await page.getByText('Score: 2/2',{exact:true}).waitFor();await page.getByText('Participant 2',{exact:false}).waitFor();checks++;
 await login(lecturer.uid,`/challenges/${cid}`);await page.getByText('Did not participate',{exact:true}).waitFor();await page.getByRole('button',{name:'Review answers',exact:true}).first().click();await page.getByText('Score: 2/2',{exact:true}).waitFor();checks++;
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:resolve(dir,`ranking-${width}.png`),fullPage:true});}
 await login(lecturer.uid,'/new');await page.getByLabel('Title',{exact:true}).fill('Scheduled challenge');await page.getByRole('button',{name:'Choose from course bank',exact:true}).click();await page.getByRole('button',{name:'Add question',exact:true}).click();
 await page.getByLabel('Start',{exact:true}).selectOption('scheduled');await page.getByLabel('Start date and time',{exact:true}).fill('2099-02-01T14:30');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved.',{exact:true}).waitFor();
 const sid=(await db.query("select id from private.course_challenges where title='Scheduled challenge'")).rows[0].id;
 await page.goto(url+`/challenges/${sid}`);await page.getByRole('heading',{name:'Edit challenge',exact:true}).waitFor();eq(await page.getByLabel('Start date and time',{exact:true}).inputValue(),'2099-02-01T14:30');
 await page.getByRole('button',{name:'Publish scheduled challenge',exact:true}).click();await page.getByText('The challenge will open automatically',{exact:false}).waitFor();checks++;
 await page.getByRole('button',{name:'Cancel challenge',exact:true}).click();await page.getByText('This challenge was cancelled.',{exact:false}).waitFor();checks++;
 await login(students[3],`/challenges/${cid}`);await page.getByRole('alert').waitFor();eq(await page.getByRole('heading',{name:'Final ranking',exact:true}).count(),0);
 eq(errors,[]);eq(calls.includes('save_course_challenge_v1')&&calls.includes('answer_course_challenge_v1')&&calls.includes('course_challenge_roster_v1'),true);
 console.log(JSON.stringify({checks,pageErrors:errors,rpcCalls:calls.length}));
}catch(e){console.error(e.message, errors, (await page.locator("body").innerText()).slice(0,1000));await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true});process.exitCode=1;}finally{await browser.close();server.close();await db.close();}
