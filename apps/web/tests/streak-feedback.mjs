import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storage = new Map();
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => { storage.set(key, String(value)); },
};

const source = fs.readFileSync(path.join(root, 'lib/streak-celebration.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(output, { exports: exported, localStorage, console });
const celebrate = exported.shouldCelebrateStreak;

const previous = { current: 1, longest: 1, active_today: false, local_date: '2026-10-21' };
const result = { already_completed: false, streak: { ...previous, current: 2, active_today: true, local_date: '2026-10-22' } };

assert.equal(celebrate(result), true, 'second day');
assert.equal(celebrate({ ...result, streak: { ...result.streak, current: 30 } }), true, 'later streak still qualifies server-side');
assert.equal(celebrate({ ...result, already_completed: true }), false, 'repeat completion');
assert.equal(celebrate({ ...result, streak: { ...result.streak, current: 0 } }), false, 'never invent a streak');
assert.equal(celebrate({ ...result, streak: { ...result.streak, active_today: false } }), false, 'no confirmed progress');

const owner = 'user-1';
const day = '2026-10-22';
assert.equal(exported.streakCelebrationAlreadyShown(owner, day), false);
exported.markStreakCelebrationShown(owner, day);
assert.equal(exported.streakCelebrationAlreadyShown(owner, day), true, 'one animation per calendar day');
assert.equal(exported.streakCelebrationAlreadyShown(owner, '2026-10-23'), false, 'next day clears throttle');

console.log('PASS: streak eligibility and once-per-day celebration throttle.');
