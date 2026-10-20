import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const web = path.join(root, "apps/web");
const read = name => fs.readFileSync(path.join(web, name), "utf8");
const gate = read("components/shell/splash-gate.tsx");
assert(gate.includes('data-scholau-splash="blue-orbit"') && gate.includes('background: "#0866e8"'), "The only splash must be server-rendered blue.");
assert(gate.includes("scholau-splash-blue-v4"), "Legacy splash session keys must not return.");
const manifest = read("app/manifest.ts");
assert(manifest.includes('start_url: "/home"') && manifest.includes('scope: "/"'), "Preserve the installed app identity.");
assert.equal((manifest.match(/launch-blue-v4/g) || []).length, 4, "Manifest must reference only the blue launch assets.");
assert(manifest.includes('background_color: "#0866e8"') && manifest.includes('theme_color: "#0866e8"'));
assert.equal((read("app/layout.tsx").match(/<SplashGate>/g) || []).length, 1, "Exactly one app splash gate.");
for (const [oldName, newName] of [["pwa-icon-192.png","launch-blue-v4-192.png"],["pwa-icon-512.png","launch-blue-v4-512.png"],["pwa-maskable-512.png","launch-blue-v4-maskable-512.png"]]) {
 assert.deepEqual(fs.readFileSync(path.join(web,"public/icons",oldName)),fs.readFileSync(path.join(web,"public/icons",newName)), "Old installation URLs must serve the blue artwork: " + oldName);
}
const startup = JSON.parse(read("lib/startup-images.ts").split("=")[1].replace(/;\s*$/, ""));
for (const {url} of startup) assert(fs.existsSync(path.join(web,"public",url)), "Missing blue native startup image: " + url);
for (const dir of ["app", "components"]) {
 for (const name of fs.readdirSync(path.join(web,dir), { recursive:true })) {
  const full = path.join(web,dir,name);
  if (!/\.(tsx?|css)$/.test(name) || !fs.statSync(full).isFile()) continue;
  assert(!/\bsplash-(screen|brand|wordmark|loader)\b|scholau:splash-seen:v1/.test(fs.readFileSync(full,"utf8")), "Legacy splash code returned: " + name);
 }
}
console.log("Blue-only splash guard passed: one gate, current launch artwork, legacy URL replacements, stable installed identity and 36 startup images.");
