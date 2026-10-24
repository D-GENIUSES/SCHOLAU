// Isolated browser regression using the production React components.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import os from 'node:os';
const root=process.cwd(), web=path.join(root,'apps/web'), fixture=path.join(root,'.content-sync/ui');
mkdirSync(fixture,{recursive:true});
const require=createRequire(path.join(web,'package.json'));
const {webpack}=require('next/dist/compiled/webpack/webpack');
const browserRequire=createRequire(path.join(process.env.SCHOLAU_BROWSER_RUNTIME || path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node'),'package.json'));
const {chromium}=browserRequire('playwright');
writeFileSync(path.join(fixture,'loader.cjs'),`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(s){return ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText}`);
writeFileSync(path.join(fixture,'entry.tsx'),`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{LessonBlocks}from'@/components/lesson/blocks';import Admin from'@/app/admin/content-sync/page';
import pack from '../cos-101.json';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function App(){const[index,setIndex]=useState(0);return <QueryClientProvider client={client}><main className="mx-auto max-w-3xl p-5"><button onClick={()=>setIndex(1)}>Next concept</button><h1 className="my-5 text-3xl font-bold">{pack.lessons[index].title}</h1><LessonBlocks blocks={pack.lessons[index].blocks}/><hr className="my-12"/><Admin/></main></QueryClientProvider>};
createRoot(document.getElementById('root')).render(<App/>);`);
let server,browser;
try {
await new Promise((resolve,reject)=>webpack({mode:'development',devtool:false,entry:path.join(fixture,'entry.tsx'),output:{path:fixture,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],alias:{'@':web},modules:[path.join(web,'node_modules'),path.join(root,'node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(fixture,'loader.cjs')}] }},(error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
const cssDir=path.join(web,'.next/static');
const css=readdirSync(cssDir,{recursive:true}).filter(name=>name.endsWith('.css')).map(name=>readFileSync(path.join(cssDir,name))).join('\n');
const calls=[];
server=http.createServer(async(req,res)=>{
 if(req.url==='/api/admin/content-sync'){
  let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);calls.push(data);
  res.setHeader('content-type','application/json');res.end(JSON.stringify({valid:true,storageVerified:true,published:data.publish}));return;
 }
 const script=req.url==='/bundle.js',style=req.url==='/style.css';
 res.setHeader('content-type',script?'text/javascript; charset=utf-8':style?'text/css; charset=utf-8':'text/html; charset=utf-8');
 res.end(script?readFileSync(path.join(fixture,'bundle.js')):style?css:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading',{name:'From input to instructions'}).waitFor();
const check=page.getByRole('button',{name:'Check answer'});assert.equal(await check.isDisabled(),true);
const pack=JSON.parse(readFileSync('.content-sync/cos-101.json','utf8'));
const checkpoint=pack.lessons[0].blocks.find(block=>block.type==='checkpoint');
const wrong=(checkpoint.correct_index+1)%checkpoint.options.length;
await page.getByRole('radio').nth(wrong).check();await check.click();await page.getByText("Let's work through it.",{exact:true}).waitFor();
assert.ok(await page.getByText('Correct answer: '+checkpoint.options[checkpoint.correct_index],{exact:true}).isVisible());
await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('radio').nth(checkpoint.correct_index).check();await check.click();await page.getByText("That's right.",{exact:true}).waitFor();
await page.getByRole('button',{name:'Next concept'}).click();assert.equal(await page.getByRole('button',{name:'Check answer'}).isDisabled(),true);
assert.equal(await page.getByText("That's right.",{exact:true}).count(),0);
await page.screenshot({path:path.join(fixture,'teaching-mobile.png'),fullPage:true});
await page.locator('input[type=file]').setInputFiles(path.join(root,'.content-sync/cos-101.json'));
await page.getByRole('button',{name:'Validate',exact:true}).click();await page.getByText('Validation passed. Source files were verified in storage.').waitFor();
await page.getByRole('button',{name:'Save drafts',exact:true}).click();await page.getByText('Drafts saved. Review the source bundle and questions before publishing.').waitFor();
await page.getByRole('button',{name:'Publish reviewed content',exact:true}).click();await page.getByText('Materials, lessons, questions and assessments are published for this course.').waitFor();
assert.equal(calls.length,3);assert.deepEqual(calls.map(x=>[x.dryRun,x.publish]),[[true,false],[false,false],[false,true]]);
await page.locator('details').first().locator('summary').click();await page.getByText('Knowledge check: '+checkpoint.question,{exact:true}).waitFor();
assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
console.log('Passed browser: mobile lesson rendering, wrong-answer explanation, retry, correct-answer feedback, reset between concepts, administrator preview, validation, draft save and publish; no console errors or horizontal overflow.');
} finally {await browser?.close();server?.close();}
