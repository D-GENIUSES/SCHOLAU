import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/lesson-note-blocks.ts', import.meta.url), 'utf8');
const exported = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported });
const normalize = exported.normalizeNoteBlocks;
const notes = [{ type: 'code', language: 'text', code: `LECTURE 9
METHODS AND PARAMETER PASSING
A method is a named block of code that performs a particular task.
Example:
static int add(int a, int b) {
  return a + b;
}
9.1 Why Use Methods?
Methods help us:
• avoid repetition
• organise programs` }];
const result = normalize(notes);
assert.equal(result.filter(b => b.type === 'heading').length, 3);
assert.ok(result.some(b => b.type === 'paragraph' && b.text.startsWith('A method is')));
assert.equal(result.find(b => b.type === 'code').code, 'static int add(int a, int b) {\n  return a + b;\n}');
assert.deepEqual(Array.from(result.find(b => b.type === 'list').items), ['avoid repetition', 'organise programs']);
assert.equal(notes[0].code.includes('• avoid repetition'), true, 'source content is untouched');
const java = { type: 'code', language: 'java', code: 'static void greet() {}' };
assert.equal(normalize([java])[0], java, 'explicit programming language remains code');
assert.deepEqual(JSON.parse(JSON.stringify(normalize(result))), JSON.parse(JSON.stringify(result)), 'normalizing twice preserves content');
console.log('PASS: imported prose, headings, bullet lists, real code, source preservation and repeat normalization.');
