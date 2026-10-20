// Runs the actual legal migration in an isolated PostgreSQL WASM instance.
// Auth/profile/admin helpers below are stand-ins; no production network or credentials.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const runtime = createRequire(resolve(process.env.LEGAL_TEST_RUNTIME ?? '../.legal-test-runtime', 'package.json'));
const { PGlite } = runtime('@electric-sql/pglite');
const db = new PGlite();
const admin = '90000000-0000-4000-8000-000000000002';
let checks = 0;
const query = async (sql, params=[]) => (await db.query(sql,params)).rows;
async function fails(sql, params, pattern) { await assert.rejects(db.query(sql,params),pattern); checks++; }
async function equal(sql, expected, params=[]) { assert.equal((await query(sql,params))[0].value,expected); checks++; }
let serial = 0;
function id() { return `80000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`; }
function metadata(extra={}) { return { terms_accepted:true,terms_version:'2026-10-19-draft-1',privacy_version:'2026-10-19-draft-1',age_declaration:'adult',...extra }; }
async function signup(email, meta) { const uid=id(); await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid,email,meta]); return uid; }
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create schema private;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
  create table public.profiles(id uuid primary key references auth.users on delete cascade);
  create function private.require_user() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function private.user_is_admin(p_id uuid) returns boolean language sql as $$select coalesce(p_id='${admin}'::uuid,false)$$;
  create function private.test_profile() returns trigger language plpgsql as $$begin insert into public.profiles values(new.id); return new; end$$;
  create trigger on_auth_user_created after insert on auth.users for each row execute function private.test_profile();
  insert into auth.users values('${admin}','admin@example.test','{}');`);
await db.exec(await readFile('supabase/migrations/20261020000300_legal_registration.sql','utf8'));
await equal(`select count(*)::int value from private.legal_acceptances`,0);
await equal(`select (public.get_registration_legal_status_v1()->>'guardian_enabled')::boolean value`,false);
await fails('insert into auth.users values($1,$2,$3)',[id(),'missing@example.test',{}],/LEGAL_ACCEPTANCE_REQUIRED/);
for (const extra of [{terms_accepted:false},{terms_accepted:'true'},{terms_version:'old'},{privacy_version:'old'},{age_declaration:null},{age_declaration:'other'},{signup_kind:'admin_managed',terms_accepted:false}]) {
  await fails('insert into auth.users values($1,$2,$3)',[id(),'bad@example.test',metadata(extra)],/LEGAL_ACCEPTANCE_REQUIRED/);
}
await equal(`select count(*)::int value from auth.users`,1);
await equal(`select count(*)::int value from public.profiles`,1);
const adult = await signup('adult@example.test',metadata({accepted_at:'1900-01-01'}));
await equal(`select age_declaration value from private.legal_acceptances where user_id=$1`,'adult',[adult]);
await equal(`select accepted_at>now()-interval '1 minute' value from private.legal_acceptances where user_id=$1`,true,[adult]);
await fails('insert into auth.users values($1,$2,$3)',[id(),'minor@example.test',metadata({age_declaration:'under18'})],/GUARDIAN_REGISTRATION_CLOSED/);
await db.exec(`set role anon`);
await equal(`select (public.get_registration_legal_status_v1()->>'guardian_enabled')::boolean value`,false);
await fails('select * from private.legal_acceptances',[],/permission denied/);
await fails('select public.admin_list_guardian_requests_v1()',[],/permission denied/);
await db.exec('reset role');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[adult]);
await db.exec('set role authenticated');
await fails('select * from private.guardian_consents',[],/permission denied/);
await fails('select public.admin_list_guardian_requests_v1()',[],/Active administrator/);
await fails('select public.admin_create_guardian_request_v1($1,$2,$3,$4,now()+interval \'1 day\')',['minor@example.test','Guardian','guardian@example.test','Parent'],/Active administrator/);
await db.exec('reset role');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
const request = async(email) => (await query("select public.admin_create_guardian_request_v1($1,'Guardian','guardian@example.test','Parent',now()+interval '1 day') value",[email]))[0].value;
const review = async(token) => db.query("select public.admin_review_guardian_request_v1($1,true,now(),'Authority and consent verified manually',true)",[token]);
const pending = await request('minor@example.test');
await assert.rejects(review(pending),/Operational support/); checks++;
// Even toggling the feature cannot enable a draft or incomplete operator setup.
await db.exec("update private.legal_settings set guardian_enabled=true,published=true,operations_verified=true");
await equal(`select private.guardian_registration_ready() value`,false);
await db.exec("update private.legal_settings set terms_version='test-final-1',privacy_version='test-final-1',operator_name='Test Operator',operator_address='Test address in Nigeria',support_email='support@example.test'");
await equal(`select private.guardian_registration_ready() value`,true);
const minorMeta = token => metadata({terms_version:'test-final-1',privacy_version:'test-final-1',age_declaration:'under18',guardian_approval:token});
await fails('insert into auth.users values($1,$2,$3)',[id(),'minor@example.test',minorMeta(pending)],/GUARDIAN_APPROVAL_REQUIRED/);
const token = await request('approved@example.test');
await fails("select public.admin_review_guardian_request_v1($1,true,now(),'No verified guardian authority',false)",[token],/Operational support/);
await review(token);
await fails('insert into auth.users values($1,$2,$3)',[id(),'wrong@example.test',minorMeta(token)],/GUARDIAN_APPROVAL_REQUIRED/);
await fails('insert into auth.users values($1,$2,$3)',[id(),'approved@example.test',minorMeta('bad')],/GUARDIAN_APPROVAL_REQUIRED/);
const expired = await request('expired@example.test'); await review(expired);
await db.query("update private.guardian_consents set expires_at=now()-interval '1 second' where id=$1",[expired]);
await fails('insert into auth.users values($1,$2,$3)',[id(),'expired@example.test',minorMeta(expired)],/GUARDIAN_APPROVAL_REQUIRED/);
const rejected = await request('rejected@example.test');
await db.query("select public.admin_review_guardian_request_v1($1,false,null,'Guardian authority could not be verified',false)",[rejected]);
await fails('insert into auth.users values($1,$2,$3)',[id(),'rejected@example.test',minorMeta(rejected)],/GUARDIAN_APPROVAL_REQUIRED/);
const minor = await signup('APPROVED@example.test',minorMeta(token));
await equal('select user_id=$1 value from private.guardian_consents where id=$2',true,[minor,token]);
await equal('select guardian_consent_id=$1 value from private.legal_acceptances where user_id=$2',true,[token,minor]);
await fails('insert into auth.users values($1,$2,$3)',[id(),'approved@example.test',minorMeta(token)],/GUARDIAN_APPROVAL_REQUIRED/);
await db.query('delete from auth.users where id=$1',[minor]);
await equal('select count(*)::int value from private.guardian_consents where id=$1',0,[token]);
await equal('select count(*)::int value from private.legal_acceptances where user_id=$1',0,[minor]);
await db.query('delete from auth.users where id=$1',[adult]);
await equal('select count(*)::int value from private.legal_acceptances where user_id=$1',0,[adult]);
await equal('select count(*)::int value from auth.users',1);
await db.close();
console.log(`Passed ${checks} isolated PostgreSQL migration/trigger checks: direct signup bypasses, acceptance/version/age validation, rollback, server timestamps, role restrictions, operational gate, pending/rejected/expired/wrong-email/reused approval, approved signup and erasure.`);
