import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { AVATAR_PRESETS, avatarPresetIndex, fallbackAvatarIndex } from "./avatar-presets.ts";

test("all six choices match their persistent paths and vector artwork", () => {
  assert.equal(AVATAR_PRESETS.length, 6);
  for (const preset of AVATAR_PRESETS) {
    assert.equal(avatarPresetIndex(preset.path), preset.id);
    const svg = fs.readFileSync(new URL(`../public/avatars/person-${preset.id}.svg`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 96 96"/);
  }
});
test("preset paths cannot select an out-of-range avatar or arbitrary URL", () => {
  for (const path of [null, "", "presets/person-6", "presets/person--1", "presets/person-0/../../photo", "https://example.com/avatar"]) assert.equal(avatarPresetIndex(path), null);
});
test("temporary fallbacks are stable and always one of the six avatars", () => {
  for (const name of ["", "Student", "Amara Okafor", "A very long name", "Aliyyah Alabi"]) {
    assert.equal(fallbackAvatarIndex(name), fallbackAvatarIndex(name));
    assert.ok(fallbackAvatarIndex(name) >= 0 && fallbackAvatarIndex(name) < 6);
  }
});
