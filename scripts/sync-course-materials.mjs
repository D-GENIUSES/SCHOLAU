// Uses an existing administrator JWT. It never creates users or uses a service role.
// Run validate first, then drafts, then publish after reviewing the same bundles.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [directory = '.content-sync', mode = 'validate', course] = process.argv.slice(2);
if (!['validate', 'drafts', 'publish'].includes(mode)) throw new Error('Mode must be validate, drafts, or publish');
const origin = process.env.SCHOLAU_SITE_URL;
const token = process.env.SCHOLAU_ADMIN_ACCESS_TOKEN;
if (!origin || !token) throw new Error('Set SCHOLAU_SITE_URL and SCHOLAU_ADMIN_ACCESS_TOKEN privately');
const base = new URL(origin);
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use HTTPS');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const entries = manifest.courses.filter(entry => !course || entry.course === course);
if (!entries.length) throw new Error('No matching course bundles');
const results = [];
for (const entry of entries) {
  if (path.basename(entry.file) !== entry.file) throw new Error('Invalid manifest filename');
  const bytes = await readFile(path.join(directory, entry.file));
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Bundle changed since manifest was generated');
  const bundle = JSON.parse(bytes.toString('utf8'));
  const response = await fetch(new URL('/api/admin/content-sync', base), {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Origin: base.origin },
    body: JSON.stringify({ bundle, dryRun: mode === 'validate', publish: mode === 'publish' }),
  });
  const result = await response.json();
  results.push({ course: entry.course, status: response.status, ...result });
  await writeFile(path.join(directory, `results-${mode}.json`), JSON.stringify(results, null, 2) + '\n');
  if (!response.ok || result.valid !== true) throw new Error(`Course ${entry.course} failed; see results-${mode}.json. Completed courses can be safely retried.`);
  console.log(JSON.stringify({ course: entry.course, mode, unchanged: result.unchanged ?? false, published: result.published ?? false }));
}
