import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";
import { createTopicQuizTestDatabase } from "./test-topic-quizzes-database.mjs";

const { db, id, query, login, lecturer, students, offering, topics, questions } = await createTopicQuizTestDatabase();
await db.exec(readFileSync('supabase/migrations/20261101000400_advanced_questions_after_mastery.sql','utf8'));
const course=(await query('select course_id from public.course_offerings where id=$1',[offering]))[0].course_id;
const mock=id(3000), mockVersion=id(3001);
await db.exec('set session_replication_role=replica');
await db.query("insert into public.assessments(id,course_id,kind,title) values($1,$2,'mock','Course mock exam')",[mock,course]);
await db.query("insert into public.assessment_versions(id,assessment_id,version,question_count,duration_seconds,feedback_mode,status,published_at,reviewed_by) values($1,$2,1,6,1200,'after_submit','published',now(),$3)",[mockVersion,mock,lecturer.uid]);
for(const [i,q] of questions.filter(q=>[topics[0],topics[1]].includes(q.lesson)).slice(0,6).entries()) await db.query('insert into public.assessment_questions values($1,$2,$3)',[mockVersion,q.qv,i+1]);
await db.exec('set session_replication_role=origin');
await login(lecturer.uid);
await query('select public.save_course_challenge_v1($1,$2,0,$3)',[id(3100),offering,{title:'Cells challenge',instructions:'Practise together',duration_minutes:15,questions:[{prompt:'What is 1 + 1?',options:['1','2','3','4'],correct:1,explanation:'One plus one is two.'}]}]);
await query('select public.publish_course_challenge_v1($1,1,null)',[id(3100)]);
await db.exec('reset role');
const runtime=createRequire(resolve(process.env.LECTURER_TEST_RUNTIME??'../.legal-test-runtime','package.json'));
const web=createRequire(resolve('apps/web/package.json'));
const {chromium}=runtime('playwright');
const {webpack}=web('next/dist/compiled/webpack/webpack');
const dir=resolve('.lecturer-verification/topic-quizzes');await mkdir(dir,{recursive:true});
await writeFile(resolve(dir,'loader.cjs'),`const ts=require(${JSON.stringify(web.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;`);
await writeFile(resolve(dir,'link.tsx'),`export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`);
await writeFile(resolve(dir,'navigation.ts'),`export function useRouter(){return {push:(path)=>{window.lastRoute=path}}}`);
await writeFile(resolve(dir,'supabase.ts'),`export const client={rpc:async(name,args)=>{const response=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return response.json()}};export const getBrowserSupabase=()=>client;`);
await writeFile(resolve(dir,'entry.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{createScholauApi}from'@scholau/api';import{ScholauApiProvider,useCourseOverview}from'@scholau/api/react';import{CourseAssessments}from'@/components/assessments/course-assessments';import{client}from'./supabase';const api=createScholauApi(client);const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});function App(){const q=useCourseOverview(window.offering);return q.data?<CourseAssessments data={q.data}/>:<p>Loading course…</p>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><ScholauApiProvider api={api}><App/></ScholauApiProvider></QueryClientProvider>);`);
await new Promise((done,reject)=>webpack({mode:'development',devtool:false,entry:resolve(dir,'entry.tsx'),output:{path:dir,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.mjs'],modules:[resolve('apps/web/node_modules'),'node_modules'],alias:{'next/link':resolve(dir,'link.tsx'),'next/navigation':resolve(dir,'navigation.ts'),'@/lib/supabase/browser':resolve(dir,'supabase.ts'),'@':resolve('apps/web')}},module:{rules:[{test:/\.tsx?$/,use:[resolve(dir,'loader.cjs')]}]}},(error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):done()));
const css=readdirSync('apps/web/.next/static',{recursive:true}).filter(n=>n.endsWith('.css')).map(n=>readFileSync(resolve('apps/web/.next/static',n),'utf8')).join('\n');
const allowed=new Set(['get_course_overview_v1','get_topic_quiz_options_v1','start_topic_quiz_v1','start_configured_attempt_v1','list_course_challenges_v1']);
const calls=[],errors=[];
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/rpc'){
   let body='';for await(const chunk of req)body+=chunk;const{name,args}=JSON.parse(body);
   if(!allowed.has(name))throw Error('Unexpected RPC '+name);calls.push({name,args});
   try{
    const data=await db.transaction(async tx=>{await tx.exec('reset role');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[students[0]]);await tx.exec('set local role authenticated');const entries=Object.entries(args??{});return(await tx.query(`select public.${name}(${entries.map(([key],i)=>`${key} => $${i+1}`).join(',')}) value`,entries.map(([,v])=>v))).rows[0].value});
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error:null,status:200}));
   }catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:e.message,details:e.detail,code:e.code},status:400}));}return;
  }
  if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve(dir,'bundle.js')));return;}
  if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body class="bg-surface-page text-ink"><main style="max-width:760px;margin:auto;padding:16px"><div id="root"></div></main><script>window.offering=${JSON.stringify(offering)}</script><script src="/bundle.js"></script></body></html>`);
 }catch(e){res.statusCode=500;res.end(e.message);}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('heading',{name:'Assessments',exact:true}).waitFor();
 eq(await page.getByRole('button',{name:'Start quiz',exact:true}).isDisabled(),true);
 await page.getByLabel('Cells',{exact:false}).check();await page.getByLabel('Genetics',{exact:false}).check();
 eq(await page.getByLabel('Coming soon',{exact:false}).isDisabled(),true);
 await page.getByLabel('Questions',{exact:true}).fill('1');eq(await page.getByRole('button',{name:'Start quiz',exact:true}).isDisabled(),true);
 await page.getByLabel('Questions',{exact:true}).fill('4');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:850});
  for(const tab of ['Topic quiz','Mock exam','Challenges']){
   await page.getByRole('tab',{name:tab,exact:true}).click();
   if(tab==='Challenges')await page.getByRole('heading',{name:'Cells challenge',exact:true}).waitFor();
   eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:resolve(dir,`${tab.replaceAll(' ','-')}-${width}.png`),fullPage:true});
  }
 }
 await page.getByRole('tab',{name:'Topic quiz',exact:true}).click();
 await page.getByRole('button',{name:'Start quiz',exact:true}).click();
 await page.waitForFunction(()=>window.lastRoute?.startsWith('/attempts/'));
 const attempt=(await page.evaluate(()=>window.lastRoute)).split('/').at(-1);
 eq(calls.find(c=>c.name==='start_topic_quiz_v1').args.p_lesson_ids,[topics[0],topics[1]]);
 eq(calls.find(c=>c.name==='start_topic_quiz_v1').args.p_question_count,4);
 await page.getByRole('link',{name:'Resume your quiz',exact:true}).waitFor();checks++;
 await db.exec('reset role');eq((await query('select total_count from public.assessment_attempts where id=$1',[attempt]))[0].total_count,4);
 await page.getByRole('tab',{name:'Mock exam',exact:true}).click();
 await page.getByRole('button',{name:'Start mock exam',exact:true}).click();
 eq(calls.some(c=>c.name==='start_configured_attempt_v1'),false);
 await page.getByRole('button',{name:'Start exam',exact:true}).click();
 await page.waitForFunction(old=>window.lastRoute&&window.lastRoute!==old,`/attempts/${attempt}`);
 const mockCall=calls.find(c=>c.name==='start_configured_attempt_v1');eq(mockCall.args.p_duration_seconds,1200);eq(mockCall.args.p_question_count,6);
 await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Topic quiz',exact:true}).focus();await page.keyboard.press('ArrowRight');eq(await page.getByRole('tab',{name:'Mock exam',exact:true}).getAttribute('aria-selected'),'true');
 eq(errors,[]);console.log(`Topic quiz browser: ${checks} checks passed; 12 responsive screenshots saved.`);
}finally{await browser.close();await new Promise(done=>server.close(done));await db.close();}
