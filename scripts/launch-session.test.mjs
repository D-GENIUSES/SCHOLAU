import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { LAUNCH_BOOTSTRAP } from "../apps/web/lib/launch-session.mjs";

function start({type="navigate",stored={},blocked=false,referrer=""}={}) {
 const root={dataset:{}},listeners={},timers=[];
 vm.runInNewContext(LAUNCH_BOOTSTRAP,{
  document:{documentElement:root,referrer},location:{origin:"https://scholau.test"},URL,
  performance:{getEntriesByType:()=>[{type}]},
  sessionStorage:{getItem:key=>{if(blocked)throw Error("blocked");return stored[key]},setItem:(key,value)=>{if(blocked)throw Error("blocked");stored[key]=value}},
  setTimeout:(fn,ms)=>timers.push({fn,ms}),addEventListener:(name,fn)=>listeners[name]=fn,
 });
 return {root,stored,timers,listeners};
}
test("a fresh session paints the video launch with a playback fallback and marks it seen before hydration",()=>{
 const f=start();assert.equal(f.root.dataset.scholauLaunch,"cold");assert.equal(f.stored["scholau.launch.session"],"active");assert.equal(f.timers[0].ms,8000);
 f.timers[0].fn();assert.equal(f.root.dataset.scholauLaunch,"warm");
});
for(const type of ["reload","back_forward"])test(type+" never paints splash even with empty storage",()=>{
 const f=start({type});assert.equal(f.root.dataset.scholauLaunch,"warm");assert.equal(f.timers.length,0);
});
test("internal full navigations retain the same app session",()=>{
 const first=start();const next=start({stored:first.stored});assert.equal(next.root.dataset.scholauLaunch,"warm");
});
test("future releases and old session keys do not restart the introduction",()=>{
 for(const key of ["scholau.launch.session","scholau-splash-blue-v4","scholau-splash-orbit-v2"])assert.equal(start({stored:{[key]:"seen"}}).root.dataset.scholauLaunch,"warm");
});
test("a genuinely new window/session gets its own launch",()=>{
 const old=start();old.timers[0].fn();assert.equal(start().root.dataset.scholauLaunch,"cold");
});
test("storage restrictions still suppress reload and internal navigation",()=>{
 assert.equal(start({blocked:true,type:"reload"}).root.dataset.scholauLaunch,"warm");
 assert.equal(start({blocked:true,referrer:"https://scholau.test/home"}).root.dataset.scholauLaunch,"warm");
});
test("page transitions and back-forward cache restoration cannot replay the splash",()=>{
 const f=start();f.listeners.pagehide();assert.equal(f.root.dataset.scholauLaunch,"warm");
 f.root.dataset.scholauLaunch="cold";f.listeners.pageshow({persisted:true});assert.equal(f.root.dataset.scholauLaunch,"warm");
});

