/* Run from the repository root: node scripts/test-maths.cjs.
 * Optional browser/SQL checks use PLAYWRIGHT_MODULE and PGLITE_MODULE paths when not installed locally.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const webRequire = Module.createRequire(path.join(web, 'package.json'));
const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  if (name.startsWith('@/')) name = path.join(web, name.slice(2));
  return resolve.call(this, name, parent, ...args);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const { MathText, Equation } = require(path.join(web, 'components/math/math-text.tsx'));
const { WorkedExample } = require(path.join(web, 'components/math/worked-example.tsx'));
const { LessonBlocks } = require(path.join(web, 'components/lesson/blocks.tsx'));
const { QuestionOptions } = require(path.join(web, 'components/attempt/question-options.tsx'));
const { AnswerFeedback } = require(path.join(web, 'components/attempt/answer-feedback.tsx'));
const { BattleAnswerOptions } = require(path.join(web, 'components/battle/answer-options.tsx'));
const { BlockPreview } = require(path.join(web, 'components/admin/block-preview.tsx'));
const { lessonBlockSchema } = require(path.join(root, 'packages/core/src/ingestion/schemas.ts'));
const { validateTeachingLessonBlocks } = require(path.join(root, 'packages/core/src/ingestion/validate-lesson.ts'));
const { buildIngestionSystemPrompt } = require(path.join(root, 'packages/core/src/ingestion/prompts.ts'));
const h = React.createElement;
const render = (Component, props) => renderToStaticMarkup(h(Component, props));
const dataDir = path.join(root, 'supabase/content/explanatory-maths-20261025');
const bundles = ['mth-101', 'mth-102', 'mth-201'].map(name => JSON.parse(fs.readFileSync(path.join(dataDir, name + '.json'), 'utf8')));
const worked = bundles[0].lessons[0].blocks.find(b => b.type === 'worked_example');

async function main() {
  for (const expression of ['x^2', String.raw`\frac{x+1}{x-1}`, String.raw`\sqrt{50}`, '-(-3)^2', String.raw`\begin{aligned}2x+3&=11\\2x&=8\\x&=4\end{aligned}`]) {
    const html = render(Equation, { expression, display: true });
    assert.match(html, /katex-mathml/);
    assert.doesNotMatch(html, /Equation needs review/);
  }
  assert.match(render(Equation, { expression: String.raw`\frac{`, display: true }), /Equation needs review/);
  assert.doesNotMatch(render(Equation, { expression: String.raw`\href{javascript:alert(1)}{click}` }), /href="javascript/);
  assert.match(render(MathText, { text: '<script>alert(1)</script>' }), /&lt;script&gt;/);
  assert.match(render(MathText, { text: 'x^(-2) and x^(n+1)' }), /<sup/);
  assert.doesNotMatch(render(MathText, { text: 'Price $20; ordinary a/b; `code`' }), /katex|<sup/);
  const lessonHtml = render(LessonBlocks, { blocks: bundles[0].lessons[0].blocks });
  assert.match(lessonHtml, /Step 1/);
  assert.match(lessonHtml, /Final answer/);
  assert.match(lessonHtml, /Check the answer/);
  assert.doesNotMatch(lessonHtml, /<details/);
  assert.match(render(Equation, { expression: 'x^2', reading: 'x squared' }), /x squared/);
  assert.match(render(QuestionOptions, { name: 'test', legend: 'Choose', options: [{ id: 'one', body: String.raw`\(x^2\)` }], value: null, onChange() {} }), /katex/);
  assert.match(render(AnswerFeedback, { correct: true, explanation: String.raw`\[x=4\]Subtract three from both sides.` }), /katex/);
  assert.match(render(BlockPreview, { blocks: [worked] }), /Step 1/);
  assert.match(render(BlockPreview, { blocks: [{ type: 'worked_example' }] }), /needs a title/);
  assert.equal(lessonBlockSchema.safeParse({ ...worked, steps: [] }).success, false);
  assert.equal(lessonBlockSchema.safeParse({ type: 'equation', expression: 12 }).success, false);
  assert.equal(lessonBlockSchema.safeParse({ ...worked, check: { calculation: 'x=2' } }).success, false);
  const plain = render(LessonBlocks, { blocks: [{ type: 'paragraph', text: 'Ordinary lesson text.' }, { type: 'code', code: 'x^2' }] });
  assert.match(plain, /<code>x\^2<\/code>/);
  let count = 0;
  for (const bundle of bundles) for (const lesson of bundle.lessons) {
    for (const block of lesson.blocks) assert.equal(lessonBlockSchema.safeParse(block).success, true, JSON.stringify(block));
    assert.deepEqual(validateTeachingLessonBlocks(lesson.blocks), [], lesson.title);
    const html = render(LessonBlocks, { blocks: lesson.blocks });
    assert.doesNotMatch(html, /Equation needs review/, lesson.title);
    count++;
  }
  assert.equal(count, 29);
  let questions = 0;
  for (const bundle of bundles) for (const question of bundle.questions) {
    assert.ok(question.explanation.length > 80, question.prompt);
    for (const text of [question.prompt, question.explanation, ...question.options.flatMap(o => [o.body, ...(o.steps || [])])]) {
      assert.doesNotMatch(render(MathText, { text }), /Equation needs review/, question.prompt + ': ' + text);
    }
    questions++;
  }
  assert.equal(questions, 178);
  const prompt = buildIngestionSystemPrompt({ courseCode: 'MTH 101', moduleTitle: 'Powers', filename: 'powers.pdf', battleMix: { standard: 1, worked_solution: 0, fill_in_gap: 0 } });
  assert.match(prompt, /MATHS TEACHING STANDARD/);
  console.log(`Rendering, safety, schema and teaching checks passed for ${count} lessons and ${questions} questions.`);

  if (process.env.PGLITE_MODULE) {
    const { PGlite } = require(process.env.PGLITE_MODULE);
    const db = new PGlite();
    try {
      await db.exec('create schema private;');
      // A table-free fixture for the existing RPC's exact teaching predicate lets us
      // verify the migration's replacement without connecting to hosted data.
      await db.exec(`create function public.admin_sync_course_materials_v1(p_bundle jsonb, p_dry_run boolean default true, p_publish boolean default false)
        returns boolean language sql as $$ select exists(select 1 from jsonb_array_elements(p_bundle->'blocks') b where b->>'type'='callout' and b->>'tone'='example') $$;`);
      await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/20261029000200_explanatory_maths.sql'), 'utf8'));
      for (const block of [worked, { type: 'callout', tone: 'example', text: 'Legacy example' }]) {
        const result = await db.query('select public.admin_sync_course_materials_v1($1::jsonb) as accepted', [JSON.stringify({ blocks: [block] })]);
        assert.equal(result.rows[0].accepted, true);
      }
      for (const bundle of bundles) for (const lesson of bundle.lessons) {
        const result = await db.query('select private.validate_lesson_blocks($1::jsonb) as errors', [JSON.stringify(lesson.blocks)]);
        assert.deepEqual(result.rows[0].errors, [], lesson.title);
      }
      for (const bad of [{ type: 'worked_example' }, { ...worked, steps: null }, { ...worked, steps: [{}] }, { ...worked, check: null }, { ...worked, steps: [ { calculation: 1, explanation: 'why' } ] }, { type: 'equation', expression: ' ' }, { type: 'equation', expression: 'x', reading: 12 }]) {
        const result = await db.query('select private.validate_lesson_blocks($1::jsonb) as errors', [JSON.stringify([bad])]);
        assert.ok(result.rows[0].errors.length, JSON.stringify(bad));
      }
      console.log('PostgreSQL validator accepts all lessons and rejects malformed maths blocks.');
    } finally { await db.close(); }
  }
  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    try {
      const page = await browser.newPage();
      const katexPath = webRequire.resolve('katex/dist/katex.min.css');
      const katexCss = fs.readFileSync(katexPath, 'utf8').replace(/url\((fonts\/[^)]+)\)/g, (_, font) => {
        const mime = font.endsWith('.woff2') ? 'font/woff2' : font.endsWith('.woff') ? 'font/woff' : 'font/ttf';
        return `url(data:${mime};base64,${fs.readFileSync(path.join(path.dirname(katexPath), font)).toString('base64')})`;
      });
      const mathsCss = fs.readFileSync(path.join(web, 'app/globals.css'), 'utf8').split('\n').filter(line => line.startsWith('.math-')).join('\n');
      const bundleCssDir = path.join(web, '.next/static/chunks');
      const css = fs.existsSync(bundleCssDir) ? fs.readdirSync(bundleCssDir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(bundleCssDir, f), 'utf8')).join('\n') : '';
      const long = render(Equation, { expression: String.raw`\frac{x^2+2x+1}{x-1}+\frac{x^3+3x^2+3x+1}{x+1}=\frac{(x+1)^2(x+1)+(x+1)^3(x-1)}{(x-1)(x+1)}`, display: true });
      const battle = render(BattleAnswerOptions, { question: { position: 1, prompt: String.raw`Choose \(x^2\).`, answer_format: 'worked_solution', options: [ { id: 'a', body: String.raw`\(x^2\)`, steps: [String.raw`\[x\times x=x^2\]`] }, { id: 'b', body: '2x', steps: ['x+x=2x'] } ] }, selected: null, disabled: false, received: false, onSelect() {} });
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.setContent(`<style>${css}\n${katexCss}\n${mathsCss}\n*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial}main{max-width:800px;margin:auto}p{line-height:1.6}</style><main>${lessonHtml}<p>Long calculation:</p>${long}${battle}</main>`);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `page overflow at ${width}`);
        assert.ok(await page.locator('.math-display').count());
        const first = page.locator('.math-display').first();
        await first.focus();
        assert.equal(await first.evaluate(el => el === document.activeElement), true);
        assert.ok(await page.locator('math').count());
        const step = page.locator('li').filter({ has: page.locator('.math-display') }).first();
        assert.equal(await step.evaluate(el => {
          const equation = el.querySelector('.math-display');
          const explanation = equation.nextElementSibling;
          return explanation.tagName === 'P' && explanation.getBoundingClientRect().top >= equation.getBoundingClientRect().bottom;
        }), true, 'prose must follow, never interrupt, the calculation');
        const output = path.join(root, '.maths-verification');
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, `maths-${width}.png`), fullPage: true });
      }
      console.log('Mobile/desktop layout, keyboard scrolling and MathML DOM checks passed.');
    } finally { await browser.close(); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
