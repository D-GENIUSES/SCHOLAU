import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');
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
 if(name.includes('_jobs.sql') || name==='20261024000100_provider_profile_names.sql') continue;
 stage=name; await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
}
const add=async (id,meta)=>db.query(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,created_at,updated_at) values($1,$2,$3,'{"provider":"google"}',now(),now())`,[id,`name-${id}@example.invalid`,JSON.stringify(meta)]);
await add('91000000-0000-4000-8000-000000000001',{full_name:'John Example'});
await add('91000000-0000-4000-8000-000000000002',{full_name:'Google Name',display_name:'My Nickname',username:'my_chosen_name'});
stage='provider names';
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261024000100_provider_profile_names.sql'),'utf8'));
await add('91000000-0000-4000-8000-000000000003',{full_name:'New Google Name'});
await add('91000000-0000-4000-8000-000000000004',{name:'Alternate Name'});
const {rows}=await db.query(`select p.id,p.display_name,h.username from public.profiles p join public.friend_handles h on h.user_id=p.id where p.id::text like '91000000-%' order by p.id`);
const expected=['John Example','My Nickname','New Google Name','Alternate Name'];
if(rows.some((r,i)=>r.display_name!==expected[i]) || rows.length!==4 || rows[1].username!=='my_chosen_name') throw Error(JSON.stringify(rows));
console.log('PASS: existing Google name repaired; new Google full_name/name supported; custom name and username preserved.');
await db.close();
} catch(error) { console.error(stage,error); await db.close(); process.exitCode=1; }

