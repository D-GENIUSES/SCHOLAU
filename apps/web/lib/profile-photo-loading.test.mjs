import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, NextResponse } from "next/server.js";
import { avatarPresetIndex, fallbackAvatarIndex } from "./avatar-presets.ts";

function load(file, mocks) {
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)(id => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, exports);
  return exports;
}
const path = "avatars/12345678-1234-1234-1234-123456789abc/abcdefab-1234-1234-1234-123456789abc.webp";
const pixels = Buffer.alloc(512 * 512 * 3);
let seed = 17;
for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
const original = await sharp(pixels, { raw: { width: 512, height: 512, channels: 3 } }).webp({ quality: 82 }).toBuffer();
function fixture({ signedIn = true, denied = false, invalidBearer = false } = {}) {
  const calls = [];
  const { GET } = load("../app/api/profile-photo/route.ts", {
    "next/server": { NextResponse }, sharp: { __esModule: true, default: sharp },
    "@/lib/supabase/request": { getRequestSupabase: async () => {
      if (invalidBearer) throw Error("INVALID_BEARER_TOKEN");
      return { auth: { getUser: async () => ({ data: { user: signedIn ? { id: "viewer" } : null }, error: null }) }, rpc: async (name, args) => {
        calls.push({ name, args });
        return denied ? { error: Error("not allowed"), data: null } : { error: null, data: { image_base64: original.toString("base64") } };
      } };
    } },
  });
  return { calls, get: (suffix = "") => GET(new NextRequest(`https://scholau.com/api/profile-photo?path=${encodeURIComponent(path)}${suffix}`)) };
}

test("ranking thumbnails are retina-sized, smaller, privately cached and use public-profile permissions", async () => {
  const f = fixture();
  const result = await f.get("&scope=public&size=64");
  assert.equal(result.status, 200);
  const bytes = Buffer.from(await result.arrayBuffer());
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.width, 64); assert.equal(meta.height, 64);
  assert.ok(bytes.length < original.length / 10, `${bytes.length} vs ${original.length}`);
  assert.equal(result.headers.get("cache-control"), "private, max-age=300");
  assert.equal(result.headers.get("vary"), "Cookie, Authorization");
  assert.equal(result.headers.get("content-type"), "image/webp");
  assert.deepEqual(f.calls, [{ name: "get_public_profile_photo_v1", args: { p_path: path } }]);
  console.log(`Avatar fixture: ${original.length} â†’ ${bytes.length} bytes (${((1 - bytes.length / original.length) * 100).toFixed(1)}% smaller).`);
});
test("all display sizes are bounded and original-photo requests retain their full resolution", async () => {
  for (const size of [64,80,112,144,192]) {
    const result = await fixture().get(`&size=${size}`);
    assert.equal((await sharp(Buffer.from(await result.arrayBuffer())).metadata()).width, size);
  }
  const f = fixture(); const full = await f.get();
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
  assert.equal(f.calls[0].name, "get_profile_photo_v1");
  for (const size of ["", "0", "63", "512", "999999", "NaN", "64.5"]) {
    const invalid = fixture(); const result = await invalid.get(`&size=${size}`);
    assert.equal(result.status, 400); assert.equal(invalid.calls.length, 0);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
  }
});
test("denied, signed-out and invalid-bearer photos cannot be cached or returned", async () => {
  for (const [options,status] of [[{signedIn:false},401],[{denied:true},404],[{invalidBearer:true},401]]) {
    const f = fixture(options); const result = await f.get("&scope=public&size=64");
    assert.equal(result.status,status); assert.equal(result.headers.get("cache-control"),"private, no-store");
    assert.equal((await result.arrayBuffer()).byteLength,0);
    if (!options.denied) assert.equal(f.calls.length,0);
  }
});

const { Avatar } = load("../components/ui/avatar.tsx", {
  react: React, "react/jsx-runtime": jsx,
  "next/image": { __esModule: true, default: ({ unoptimized: _unoptimized, onError: _onError, ...props }) => React.createElement("img", props) },
  "@/lib/avatar-presets": { avatarPresetIndex, fallbackAvatarIndex },
});
const { OnlineAvatar } = load("../components/ui/online-avatar.tsx", { "react/jsx-runtime": jsx, "@/components/ui/avatar": { Avatar } });
const medal = load("../components/leaderboard/podium-medal.tsx", { react: React, "react/jsx-runtime": jsx });
const { LeaderboardList } = load("../components/leaderboard/leaderboard-list.tsx", {
  "react/jsx-runtime": jsx,
  "next/link": { __esModule: true, default: ({children,...props}) => React.createElement("a",props,children) },
  "@scholau/core": { formatNumber: String, formatXp: n => `${n} XP` },
  "@/components/ui/online-avatar": { OnlineAvatar }, "@/lib/utils": { cn: (...names) => names.filter(Boolean).join(" ") },
  "./podium-medal": medal,
});
test("ranking starts ten avatars immediately, prioritizes only the podium and numbers the medals", () => {
  const rows = Array.from({length:20},(_,i)=>({user_id:String(i),rank:i+1,display_name:`Student ${i+1}`,avatar_path:path,xp_total:100-i,is_me:false}));
  const html = renderToStaticMarkup(React.createElement(LeaderboardList,{rows,label:"Global"}));
  const images = [...html.matchAll(/<img[^>]+>/g)].map(m=>m[0]);
  assert.equal(images.length,20);
  assert.equal(images.filter(s=>s.includes('loading="eager"')).length,10);
  assert.equal(images.filter(s=>s.includes('fetchPriority="high"')).length,3);
  assert.ok(images.every(s=>s.includes('size=64')));
  for (const rank of [1,2,3]) assert.match(html,new RegExp(`<text[^>]*>${rank}</text>`));
  assert.match(html,/background-image:url\(\/avatars\/person-/);
});
