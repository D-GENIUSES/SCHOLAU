import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { startAppUpdates, UPDATE_INTERVAL_MS } from "../apps/web/lib/app-updates.mjs";

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(pathname="/home") {
 const page = new EventTarget(); page.visibilityState="visible"; page.activeElement=null; page.querySelector=()=>null;
 const events = new EventTarget(); let version="old", polls=0, reloads=0, registrations=0, updates=0, offline=false;
 const intervals = new Map(); let nextId=0;
 events.location={pathname,search:"",reload:()=>reloads++};
 events.fetch=async(url,options)=>{ polls++; assert.equal(url,"/api/app-version");assert.equal(options.cache,"no-store");assert.equal(options.credentials,"omit"); if(offline)throw Error("offline");return Response.json({version});};
 events.setInterval=(fn,ms)=>{assert.equal(ms,15_000);intervals.set(++nextId,fn);return nextId;};
 events.clearInterval=id=>intervals.delete(id);
 events.setTimeout=setTimeout;events.clearTimeout=clearTimeout;
 const browser={onLine:true,serviceWorker:{register:async(url,options)=>{registrations++;assert.equal(url,"/push-sw.js");assert.equal(options.scope,"/");assert.equal(options.updateViaCache,"none");return {update:async()=>updates++};}}};
 let pending=false;
 const stop=startAppUpdates({browser,page,events,currentVersion:"old",onPending:value=>pending=value});
 return {page,events,browser,stop,intervals,setVersion:v=>version=v,setOffline:v=>offline=v,stats:()=>({polls,reloads,registrations,updates,pending})};
}

test("checks every 15 seconds and automatically applies a new release on a safe page", async()=>{
 assert.equal(UPDATE_INTERVAL_MS,15_000);
 const f=fixture();await flush();assert.equal(f.stats().reloads,0);assert.equal(f.stats().registrations,1);
 f.setVersion("new");for(const run of f.intervals.values())run();await flush();assert.equal(f.stats().reloads,1);
 f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,1);f.stop();
});
test("works without service-worker or notification support", async()=>{
 const f=fixture();await flush();delete f.browser.serviceWorker;f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,1);f.stop();
});
for(const route of ["/battles/live-id","/attempts/test-id","/battles/queue"]){
 test("defers reload during "+route+" and applies after leaving",async()=>{
  const f=fixture(route);await flush();f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,0);assert.equal(f.stats().pending,true);
  f.events.location.pathname="/home";f.events.dispatchEvent(new Event("popstate"));await flush();assert.equal(f.stats().reloads,1);f.stop();
 });
}
test("preserves edited forms until the learner navigates away",async()=>{
 const f=fixture("/profile");await flush();f.page.dispatchEvent(new Event("input"));f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,0);assert.equal(f.stats().pending,true);
 f.events.location.pathname="/leaderboard";f.events.dispatchEvent(new Event("popstate"));await flush();assert.equal(f.stats().reloads,1);f.stop();
});
test("does not reload an open dialog or a pending save",async()=>{
 const f=fixture();await flush();f.page.querySelector=()=>({});f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,0);f.page.querySelector=()=>null;f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().reloads,1);f.stop();
});
test("rechecks when a suspended installed app returns to the foreground",async()=>{
 const f=fixture();await flush();f.page.visibilityState="hidden";f.setVersion("new");let prior=f.stats().polls;f.events.dispatchEvent(new Event("focus"));await flush();assert.equal(f.stats().polls,prior);
 f.page.visibilityState="visible";f.page.dispatchEvent(new Event("visibilitychange"));await flush();assert.equal(f.stats().reloads,1);f.stop();
});
test("offline failures retry on reconnection without clearing any storage",async()=>{
 const f=fixture();await flush();f.setOffline(true);f.events.dispatchEvent(new Event("online"));await flush();assert.equal(f.stats().reloads,0);f.setOffline(false);f.setVersion("new");f.events.dispatchEvent(new Event("online"));await flush();assert.equal(f.stats().reloads,1);f.stop();assert.equal(f.intervals.size,0);
});
test("cleanup cancels subsequent lifecycle checks",async()=>{
 const f=fixture();await flush();f.stop();const prior=f.stats().polls;f.setVersion("new");f.events.dispatchEvent(new Event("online"));f.page.dispatchEvent(new Event("visibilitychange"));await flush();assert.equal(f.stats().polls,prior);
});
function workerFixture() {
 const listeners={};let claimed=false,waiting=false,networkOptions=null,networkFails=false;
 const origin="https://scholau.test";
 const requests=[{url:origin+"/home",mode:"navigate"},{url:origin+"/icons/pwa-icon-192.png",mode:"cors"},{url:origin+"/api/saved-progress",mode:"cors"},{url:"https://other.test/home",mode:"navigate"}];
 const stored=new Map(requests.map((r,i)=>[r.url,{headers:new Headers({"content-type":i===0?"text/html":"application/json"})}]));
 const cache={keys:async()=>requests.filter(r=>stored.has(r.url)),match:async request=>stored.get(request.url),delete:async request=>stored.delete(request.url)};
 const self={location:{origin},addEventListener:(name,fn)=>listeners[name]=fn,skipWaiting:async()=>waiting=true,clients:{claim:async()=>claimed=true}};
 vm.runInNewContext(fs.readFileSync(new URL("../apps/web/public/push-sw.js",import.meta.url),"utf8"),{self,URL,Response,Date,caches:{keys:async()=>["legacy-cache"],open:async()=>cache},fetch:async(request,options)=>{networkOptions=options;if(networkFails)throw Error("offline");return new Response("fresh",{status:200});}});
 return {listeners,stored,setOffline:()=>networkFails=true,stats:()=>({claimed,waiting,networkOptions}),origin};
}
test("worker activates immediately and removes only stale launch documents/assets",async()=>{
 const f=workerFixture();let work;f.listeners.install({waitUntil:p=>work=p});await work;assert.equal(f.stats().waiting,true);
 f.listeners.activate({waitUntil:p=>work=p});await work;assert.equal(f.stats().claimed,true);assert(!f.stored.has(f.origin+"/home"));assert(!f.stored.has(f.origin+"/icons/pwa-icon-192.png"));assert(f.stored.has(f.origin+"/api/saved-progress"));assert(f.stored.has("https://other.test/home"));assert(f.listeners.push&&f.listeners.notificationclick);
});
test("navigation uses the network with no-store, never cached legacy HTML",async()=>{
 const f=workerFixture();let result;f.listeners.fetch({request:{url:f.origin+"/home",mode:"navigate",method:"GET"},respondWith:p=>result=p});assert.equal(await(await result).text(),"fresh");assert.equal(f.stats().networkOptions.cache,"no-store");
});
test("offline navigation is self-contained animated white branding, never the old splash",async()=>{
 const f=workerFixture();f.setOffline();let result;f.listeners.fetch({request:{url:f.origin+"/home",mode:"navigate",method:"GET"},respondWith:p=>result=p});const response=await result;const html=await response.text();assert.equal(response.status,503);assert.equal(response.headers.get("cache-control"),"no-store");assert(html.includes("#ffffff")&&html.includes("@keyframes orbit")&&html.includes('data-scholau-splash="blue-orbit"'));assert(!html.includes("splash-screen"));
});
test("private API responses are not intercepted or cached by the worker",()=>{
 const f=workerFixture();f.listeners.fetch({request:{url:f.origin+"/api/private",mode:"cors",method:"GET"},respondWith:()=>assert.fail("private response intercepted")});
});

test("an unavailable version endpoint never triggers a reload",async()=>{
 const f=fixture("/profile");await flush();f.page.dispatchEvent(new Event("input"));f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert(f.stats().pending);
 f.events.fetch=async()=>new Response("unavailable",{status:503});f.events.location.pathname="/home";f.events.dispatchEvent(new Event("popstate"));await flush();assert.equal(f.stats().reloads,0);f.stop();
});
test("a reverted release clears a queued update instead of reloading unnecessarily",async()=>{
 const f=fixture("/attempts/test");await flush();f.setVersion("new");f.events.dispatchEvent(new Event("focus"));await flush();assert(f.stats().pending);
 f.setVersion("old");f.events.location.pathname="/home";f.events.dispatchEvent(new Event("popstate"));await flush();assert.equal(f.stats().reloads,0);assert.equal(f.stats().pending,false);f.stop();
});
