import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SCHOLAU_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SCHOLAU_PREVIEW_URL || 'http://127.0.0.1:3148';
const output = process.env.SCHOLAU_FEEDBACK_OUTPUT || path.join(os.tmpdir(), 'scholau-learning-feedback');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__battleAudio = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__battleAudio.push({ duration: this.buffer?.duration });
      return start.apply(this, args);
    };
  });
  const open = async state => {
    await page.goto(`${base}/design-preview?state=${state}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-scholau-splash]').waitFor({ state: 'hidden' });
  };
  await open('learning-feedback');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      cards: [...document.querySelectorAll('.battle-opponent-option')].map(card => {
        const box = card.getBoundingClientRect();
        return { height: box.height, fits: [...card.querySelectorAll('strong, small')].every(child => {
          const text = child.getBoundingClientRect();
          return text.top >= box.top + 8 && text.bottom <= box.bottom - 8 && text.left >= box.left && text.right <= box.right;
        }) };
      }),
      paragraphs: document.querySelectorAll('.lesson-reading > p').length,
      lists: document.querySelectorAll('.lesson-reading > ul').length,
      code: document.querySelector('.lesson-reading pre')?.textContent,
    }));
    assert.equal(layout.overflow, false, `no overflow at ${width}`);
    assert.equal(layout.cards.length, 4);
    assert.ok(layout.cards.every(card => card.height >= 88 && card.fits), `card padding at ${width}`);
    assert.ok(layout.paragraphs >= 2);
    assert.equal(layout.lists, 1);
    assert.ok(layout.code.includes('return a + b;') && !layout.code.includes('LECTURE'));
    await page.screenshot({ path: path.join(output, `notes-and-cards-${width}.png`), fullPage: true });
  }
  const sounds = [];
  for (const [index, result] of ['win', 'loss'].entries()) {
    await page.getByRole('button', { name: `Preview ${result}` }).click();
    await page.locator(`.battle-result-burst[data-result="${result}"]`).waitFor();
    assert.equal(await page.locator('.streak-celebration').count(), 0, 'battle effects never open a streak popup');
    assert.ok((await page.locator('.battle-result-burst').textContent()).includes(result === 'win' ? '🎉' : '😭'));
    await page.waitForFunction(count => window.__battleAudio.length >= count, index + 1);
    const audio = await page.evaluate(index => window.__battleAudio[index], index);
    assert.ok(audio.duration > 1 && audio.duration < 20, 'uploaded MP3 decoded and scheduled for playback');
    sounds.push({ result, ...audio });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `battle-${result}.png`) });
    await page.locator('.battle-result-burst').waitFor({ state: 'detached' });
  }
  await open('returning');
  assert.equal(await page.locator('.home-dashboard .home-stats').count(), 0);
  assert.equal(await page.getByText('Review what you learned', { exact: true }).count(), 0);
  assert.equal(await page.locator('.home-dashboard > header + .home-course-focus').count(), 1);
  assert.equal(await page.locator('.streak-celebration').count(), 0);
  await open('streak');
  assert.equal(await page.locator('.streak-celebration').count(), 0, 'no popup on opening a lesson');
  await page.getByRole('button', { name: 'Mark as complete', exact: true }).click();
  await page.locator('.streak-celebration').waitFor();
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.streak-celebration button')?.disabled);
  await page.screenshot({ path: path.join(output, 'lesson-streak.png') });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Complete again', exact: true }).click();
  await page.getByText('Already completed. Your streak stays the same.', { exact: true }).waitFor();
  assert.equal(await page.locator('.streak-celebration').count(), 0, 'idempotent completion never replays');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  assert.ok(viewport.includes('maximum-scale=1') && viewport.includes('user-scalable=no'));
  console.log(JSON.stringify({ passed: true, sounds, widths: [320, 390, 1440], output }, null, 2));
} finally {
  await browser.close();
}
