import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const runtime = createRequire(resolve(process.env.ADMIN_XP_TEST_RUNTIME ?? '../.xp-test-runtime', 'package.json'));
const { PGlite } = runtime('@electric-sql/pglite');
const { pgcrypto } = runtime('@electric-sql/pglite/contrib/pgcrypto');
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const db = new PGlite({ extensions: { pgcrypto } });
let stage = 'bootstrap';
try {
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema extensions; create schema realtime; create schema storage;
create table auth.users (instance_id uuid,id uuid primary key,aud text,role text,email text,encrypted_password text,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,created_at timestamptz,last_sign_in_at timestamptz,updated_at timestamptz,confirmation_token text,recovery_token text,email_change_token_new text,email_change text);
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
  console.log('Migration passed:', name);
}

const admin='90000000-0000-4000-8000-000000000001';
const student='90000000-0000-4000-8000-000000000002';
const target='90000000-0000-4000-8000-000000000003';
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values
('${admin}','admin@xp.test','{"display_name":"XP Admin","terms_accepted":true,"terms_version":"2026-10-19-draft-1","privacy_version":"2026-10-19-draft-1","age_declaration":"adult"}'),
('${student}','student@xp.test','{"display_name":"XP Student","terms_accepted":true,"terms_version":"2026-10-19-draft-1","privacy_version":"2026-10-19-draft-1","age_declaration":"adult"}'),
('${target}','target@xp.test','{"display_name":"XP Target","terms_accepted":true,"terms_version":"2026-10-19-draft-1","privacy_version":"2026-10-19-draft-1","age_declaration":"adult"}');
insert into public.user_roles(user_id,role) values('${admin}','admin') on conflict do nothing;`);
const assert=(await import('node:assert/strict')).default;
await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false); set role authenticated;`);
const award=async(user,amount,key='10000000-0000-4000-8000-000000000001',reason='Test award')=>(await db.query('select public.admin_award_xp_v1($1,$2,$3,$4) result',[user,amount,reason,key])).rows[0].result;
const first=await award(target,500);
assert.equal(first.amount,500);assert.equal(first.xp_total,510);
assert.equal((await award(target,500)).replayed,true);
await assert.rejects(award(target,501),/VALIDATION_FAILED/);
await assert.rejects(award(student,500),/VALIDATION_FAILED/);
for(const amount of [0,-1,null])await assert.rejects(award(target,amount,'10000000-0000-4000-8000-000000000002'),/VALIDATION_FAILED/);
await assert.rejects(award(target,'1.5','10000000-0000-4000-8000-000000000002'),/invalid input syntax/);
assert.equal((await award(target,3000000000,'10000000-0000-4000-8000-000000000003')).xp_total,3000000510);
assert.equal((await award(admin,25,'10000000-0000-4000-8000-000000000004')).amount,25);
await db.exec('reset role');
await db.exec(`update public.profiles set deactivated_at=now() where id='${target}'; set role authenticated;`);
assert.equal((await award(target,7,'10000000-0000-4000-8000-000000000005')).xp_total,3000000517);
await assert.rejects(award(target,9007199254740991,'10000000-0000-4000-8000-000000000006'),/VALIDATION_FAILED/);
await db.exec(`reset role; select set_config('request.jwt.claim.sub','${student}',false); set role authenticated;`);
await assert.rejects(award(target,100,'10000000-0000-4000-8000-000000000007'),/FORBIDDEN/);
await db.exec('reset role; set role anon');await assert.rejects(award(target,100),/permission denied/);await db.exec('reset role');
const rows=(await db.query(`select (select total from public.user_points where user_id='${target}')::text total,(select sum(amount) from public.points_ledger where user_id='${target}')::text ledger,(select count(*) from private.audit_log where action='award_xp')::int audits`)).rows[0];
assert.equal(rows.total,rows.ledger);assert.equal(rows.audits,4);
await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false)`); assert.equal((await db.query(`select public.admin_get_user_v1('${target}') result`)).rows[0].result.user.xp_total,3000000517);
console.log('PASS: awards, large quantities, retry deduplication, payload conflicts, validation, admin/frozen targets, overflow, role permissions, ledger reconciliation, audit trail.');
await db.close();
} catch(error){console.error('FAILED at',stage,error.message);await db.close();process.exitCode=1;}
