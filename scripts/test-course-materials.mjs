import assert from 'node:assert/strict';
import { PGlite } from '../../.xp-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { pgcrypto } from '../../.xp-test-runtime/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const db = new PGlite({ extensions: { pgcrypto } });
let stage = 'bootstrap';
try {
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema extensions; create schema realtime; create schema storage;
create table auth.users (instance_id uuid,id uuid primary key,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,banned_until timestamptz,deleted_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ select $$;
`);
for (const name of fs.readdirSync(path.join(root,'supabase/migrations')).sort()) {
  if(name.includes('_jobs.sql')) continue;
  if(process.argv.includes('--base-only') && /mastery_xp|welcome_xp_leaderboards/.test(name)) continue;
  stage = name;
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));

}

stage='fixtures';
await db.exec(fs.readFileSync(path.join(root,'supabase/seed.sql'),'utf8'));
console.log('Migrations and local fixtures loaded.');

const admin = '90000000-0000-4000-8000-000000000002';
const student = '90000000-0000-4000-8000-000000000001';
const manifest = JSON.parse(fs.readFileSync('.content-sync/manifest.json','utf8'));
const packs = manifest.courses.map(entry => JSON.parse(fs.readFileSync(path.join('.content-sync',entry.file),'utf8')));
const pack = packs.find(x => x.course_code === 'COS 101');
async function asUser(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
}
async function sync(bundle, dry=true, publish=false) {
  return (await db.query('select public.admin_sync_course_materials_v1($1::jsonb,$2,$3) as result',[JSON.stringify(bundle),dry,publish])).rows[0].result;
}
async function snapshot() {
  await db.exec('reset role');
  return (await db.query(`select (select count(*) from public.lesson_versions) as lessons,
    (select count(*) from public.question_versions) as questions,
    (select count(*) from public.assessment_versions) as assessments,
    (select count(*) from private.course_materials) as materials`)).rows[0];
}
stage='authorization';
await asUser(student);
await assert.rejects(sync(pack), /FORBIDDEN/);
await assert.rejects(db.query('select * from private.course_materials'), /permission denied/);
await db.exec('reset role; set role anon');
await assert.rejects(db.query('select public.get_course_materials_v1(gen_random_uuid())'), /permission denied/);
await db.exec('reset role');
const offering = (await db.query(`select o.id from public.course_offerings o join public.courses c on c.id=o.course_id where c.code='COS 101' and o.status='published' limit 1`)).rows[0].id;
await db.query('insert into public.enrollments(user_id,offering_id) values($1,$2) on conflict do nothing',[student,offering]);
const before = await snapshot();
await asUser(admin);
stage='dry run';
assert.equal((await sync(pack)).valid,true);
assert.deepEqual(await snapshot(),before);
await asUser(admin);
stage='draft import';
const draft = await sync(pack,false);
assert.equal(draft.valid,true);
assert.equal(draft.questions,10);
const afterDraft = await snapshot();
await asUser(student);
assert.equal((await db.query('select public.get_course_materials_v1($1) as result',[offering])).rows[0].result.items.length,0);
await asUser(admin);
assert.equal((await sync(pack,false)).unchanged,true);
assert.deepEqual(await snapshot(),afterDraft);
await asUser(admin);
stage='publication';
assert.equal((await sync(pack,false,true)).published,true);
const published = await snapshot();
await asUser(admin);
assert.equal((await sync(pack,false,true)).unchanged,true);
assert.deepEqual(await snapshot(),published);
await asUser(student);
const materials = (await db.query('select public.get_course_materials_v1($1) as result',[offering])).rows[0].result.items;
assert.equal(materials.length,pack.materials.length);
const access = (await db.query('select public.get_course_material_access_v1($1,$2) as result',[offering,materials[0].id])).rows[0].result;
assert.ok(access.object_key.startsWith('course-materials/'));
await assert.rejects(db.query('select public.get_course_material_access_v1($1,$2)',[offering,'a'.repeat(64)]),/NOT_FOUND/);
await db.exec('reset role');
const otherOffering = (await db.query(`select id from public.course_offerings where id<>$1 and id not in(select offering_id from public.enrollments where user_id=$2) and status='published' limit 1`,[offering,student])).rows[0].id;
await asUser(student);
await assert.rejects(db.query('select public.get_course_materials_v1($1)',[otherOffering]),/NOT_ENROLLED/);
const overview = (await db.query('select public.get_course_overview_v1($1) as result',[offering])).rows[0].result;
assert.ok(overview.modules.length>0);
assert.ok(overview.assessments.length>=3);
const practice = overview.assessments.find(a => a.kind==='practice');
stage='assessment start';
const attempt = (await db.query('select public.start_attempt_v1($1,gen_random_uuid(),true) as result',[practice.assessment_version_id])).rows[0].result;
assert.ok(attempt.attempt_id);
assert.ok(!JSON.stringify(attempt).includes('correct_option'));
await asUser(admin);
stage='validation rollback';
const invalid = structuredClone(pack); invalid.questions[0].course_code='OTHER';
await assert.rejects(sync(invalid,false,true),/VALIDATION_FAILED/);
assert.deepEqual(await snapshot(),published);
await asUser(admin);
stage='updated content';
const changed = structuredClone(pack); changed.lessons[0].title += ' (revised)';
assert.equal((await sync(changed,false)).published,false);
assert.equal((await sync(changed,false,true)).published,true);
const changedCount = await snapshot();
assert.equal(Number(changedCount.lessons),Number(published.lessons)+pack.lessons.length);
await asUser(admin);
assert.equal((await sync(changed,false,true)).unchanged,true);
assert.deepEqual(await snapshot(),changedCount);
stage='malformed knowledge check';
await asUser(admin);
const badCheck = structuredClone(pack); badCheck.lessons[0].blocks.find(b=>b.type==='checkpoint').correct_index=9;
assert.equal((await sync(badCheck)).valid,false);
badCheck.lessons[0].blocks.find(b=>b.type==='checkpoint').correct_index='1';
assert.equal((await sync(badCheck)).valid,false);
const rawExtract = structuredClone(pack); rawExtract.lessons[0].blocks= [{type:'paragraph',text:'Only document text '.repeat(10)}];
await assert.rejects(sync(rawExtract),/VALIDATION_FAILED/);
stage='all course bundles';
for(const bundle of packs) {
  await asUser(admin);
  const result = await sync(bundle,true);
  assert.equal(result.valid,true,bundle.course_code+': '+JSON.stringify(result));
  assert.equal((await sync(bundle,false,true)).published,true,bundle.course_code);
  const state = await snapshot();
  await asUser(admin);
  assert.equal((await sync(bundle,false,true)).unchanged,true,bundle.course_code);
  assert.deepEqual(await snapshot(),state);
}
console.log('Passed: admin/student/guest permissions, dry-run isolation, draft visibility, publication, replay, version updates, rollback, enrolled materials, assessment start, raw-extract rejection, malformed checkpoint rejection, and all 31 bundles published and replayed.');

} catch(e) { console.error('Failed during',stage,':', e.message, e.detail??'', e.where??''); process.exitCode=1; }
finally { await db.close(); }
