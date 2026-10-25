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
  // Minimal schema fixture avoids historical duplicate public-profile migrations.
  if(name > '20261020001100_calm_course_notifications.sql' && !name.includes('admin_daily_insights')) continue;
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
await db.exec(`select set_config('request.jwt.claim.sub','${student}',false); set role authenticated;`);
await db.query('select public.user_heartbeat_v1()');
await assert.rejects(db.query('select public.admin_user_insights_v1($1)',[[student]]),/FORBIDDEN/);
await assert.rejects(db.query('select public.admin_battle_players_v1($1)',[[]]),/FORBIDDEN/);
await db.exec(`reset role; select set_config('request.jwt.claim.sub','${admin}',false); set role authenticated;`);
const read=async()=> (await db.query('select public.admin_user_insights_v1($1) result',[[student]])).rows[0].result;
let info=await read(); assert.equal(info.total_users,3); assert.equal(info.items[0].online,true); assert.equal(info.items[0].department,null);
assert.equal((await db.query('select public.admin_battle_players_v1($1) result',[[]])).rows[0].result.items.length,0);
await db.exec(`reset role; update private.user_presence set seen_at=now()-interval '91 seconds' where user_id='${student}'; update auth.users set created_at=now() where id='${student}'; set role authenticated;`);
info=await read();assert.equal(info.items[0].online,false);assert.equal(info.items[0].events[0].label,'Signed up');
await db.exec(`reset role; update auth.users set created_at=now()-interval '2 days' where id='${student}'; set role authenticated;`);
assert.equal((await read()).items[0].events.length,0);
await assert.rejects(db.query('select public.admin_user_insights_v1($1)',[Array(21).fill(student)]),/VALIDATION_FAILED/);
await db.exec(`reset role;
insert into public.battle_rules(version,round_count,seconds_per_round,ready_seconds,countdown_seconds,queue_seconds,win_xp,draw_xp,loss_xp) values(9999,5,10,30,3,60,10,5,1);
insert into public.battles(id,offering_id,rules_id,mode,created_by,round_count,seconds_per_round)
select '70000000-0000-4000-8000-000000000001',o.id,r.id,'direct','${student}',5,10 from public.course_offerings o cross join public.battle_rules r where r.version=9999 limit 1;
insert into public.battle_participants(battle_id,user_id,seat,correct_count) values
('70000000-0000-4000-8000-000000000001','${student}',1,4),('70000000-0000-4000-8000-000000000001','${target}',2,2);
set role authenticated;`);
const match=(await db.query('select public.admin_battle_players_v1($1) result',[['70000000-0000-4000-8000-000000000001']])).rows[0].result.items[0];
assert.equal(match.players[0].score,4);assert.equal(match.players[1].score,2);assert.ok(match.players[0].name);assert.equal(match.rounds,5);
assert.ok((await read()).items[0].events.some(event=>event.label==='Joined battle'));
await db.exec('reset role; set role anon');await assert.rejects(read(),/permission denied/);
console.log('PASS: admin permissions, anonymous denial, total users, academic fallback, heartbeat expiry, signup activity, daily reset and request bounds.');
await db.close();
} catch(error){console.error('FAILED at',stage,error.message);await db.close();process.exitCode=1;}
