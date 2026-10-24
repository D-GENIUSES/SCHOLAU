import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import fs from 'node:fs';
import path from 'node:path';
const runtime = createRequire(resolve(process.env.SECURITY_TEST_RUNTIME ?? '../.xp-test-runtime', 'package.json'));
const { PGlite } = runtime('@electric-sql/pglite');
const { pgcrypto } = runtime('@electric-sql/pglite/contrib/pgcrypto');
const root = process.cwd();
fs.mkdirSync('.security-verification', { recursive: true });
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
  console.log('Migration passed:', name);
}
await db.exec("update public.battle_rules set id='40000000-0000-4000-8000-000000000001' where version=1 and not exists(select 1 from public.battles)");
stage='seed';
await db.exec(fs.readFileSync(path.join(root,'supabase/seed.sql'),'utf8'));
console.log('Fixtures seeded.');
if(!process.argv.includes('--base-only')) console.log('XP access:', (await db.query("select has_function_privilege('anon','public.get_xp_progress_v1()','execute') as guest, has_function_privilege('authenticated','public.get_xp_progress_v1()','execute') as student")).rows);
// Minimal assertions for the existing pgTAP SQL, preserving role and transaction behavior.
await db.exec(`
set search_path=public,extensions;
grant usage on schema extensions to authenticated,anon,service_role;
create function extensions.plan(integer) returns text language sql as $$ select 'plan'::text $$;
create function extensions.no_plan() returns text language sql as $$ select 'plan'::text $$;
create function extensions.finish() returns setof text language sql as $$ select 'done'::text $$;
create function extensions.ok(value boolean,label text) returns text language sql as $$ select case when value is true then 'ok: ' else 'FAIL: ' end || label $$;
create function extensions.is(actual anycompatible,expected anycompatible,label text) returns text language sql as $$ select case when actual is not distinct from expected then 'ok: ' || label else 'FAIL: ' || label || ' actual=' || coalesce(actual::text,'NULL') || ' expected=' || coalesce(expected::text,'NULL') end $$;
create function extensions.lives_ok(statement text,label text) returns text language plpgsql as $$ begin execute statement; return 'ok: '||label; exception when others then return 'FAIL: '||label||' '||sqlerrm; end $$;
create function extensions.throws_ok(statement text,expected_code text,expected_message text,label text) returns text language plpgsql as $$ begin execute statement; return 'FAIL: '||label||' (did not throw)'; exception when others then return case when sqlstate=expected_code and (expected_message is null or sqlerrm=expected_message) then 'ok: '||label else 'FAIL: '||label||' '||sqlstate||' '||sqlerrm end; end $$;
create function extensions.fk_ok(s text,t text,cols text[],rs text,rt text,rcols text[],label text) returns text language sql as $$
  select extensions.ok(exists(select 1 from pg_constraint c where c.contype='f' and c.conrelid=to_regclass(s||'.'||t) and c.confrelid=to_regclass(rs||'.'||rt)
    and array(select a.attname::text from unnest(c.conkey) with ordinality k(n,i) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n order by k.i)=cols
    and array(select a.attname::text from unnest(c.confkey) with ordinality k(n,i) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n order by k.i)=rcols),label)
$$;
grant execute on function extensions.no_plan(),extensions.finish(),extensions.ok(boolean,text),extensions.is(anycompatible,anycompatible,text),extensions.lives_ok(text,text),extensions.throws_ok(text,text,text,text),extensions.fk_ok(text,text,text[],text,text,text[],text) to authenticated,anon;
`);
let passed=0,failed=0;
for(const name of fs.readdirSync(path.join(root,'supabase/tests/database')).sort()) {
  if (process.argv[2] && !name.startsWith(process.argv[2])) continue;
  stage=name;
  let script=fs.readFileSync(path.join(root,'supabase/tests/database',name),'utf8').replace(/create extension if not exists pgtap with schema extensions;/g,'');
  script=script.replace(/\\ir\s+([^\r\n]+)/g, (_match,file) => fs.readFileSync(path.resolve(root,'supabase/tests/database',file.trim()),'utf8'));
  if (!name.endsWith('.test.sql')) script='begin;\n'+fs.readFileSync(path.join(root,'supabase/tests/helpers/legal-fixtures.inc'),'utf8')+'\n'+script+'\nrollback;';
  const results=await db.exec(script);
  for(const r of results) for(const row of r.rows) for(const value of Object.values(row)) {
    if(typeof value==='string' && value.startsWith('ok: ')) passed++;
    if(typeof value==='string' && value.startsWith('FAIL: ')) {failed++; console.log(name,value);}
  }
  console.log('Test file completed:',name);
}
fs.writeFileSync('.security-verification/database.json',JSON.stringify({environment:'local PGlite PostgreSQL compatibility checks',passed,failed,live_deployment:'pending'},null,2)); console.log(JSON.stringify({passed,failed}));
if(failed) process.exitCode=1;
} catch(e) {
console.error('Failed during',stage,':', e.message, e.detail??'', e.where??'');
if(e.position && e.query) console.error('At SQL:',e.query.slice(Math.max(0,Number(e.position)-160),Number(e.position)+160));
process.exitCode=1;
} finally { await db.close(); }



