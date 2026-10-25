import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const runtime=createRequire(resolve(process.env.LEGAL_TEST_RUNTIME??'../.legal-test-runtime','package.json'));
const {PGlite}=runtime('@electric-sql/pglite');
const db=new PGlite();
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
function extract(source,name) {const start=source.indexOf('create or replace function '+name);const end=source.indexOf('$$;',source.indexOf('as $$',start));return source.slice(start,end+3);}
await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;create schema auth;
create table battles(id uuid primary key,state text,starts_at timestamptz,ends_at timestamptz,finalized_at timestamptz,winner_user_id uuid,result_kind text,cancel_reason text,revision int default 0,invitation_expires_at timestamptz,ready_deadline timestamptz);
create table battle_participants(battle_id uuid,user_id uuid,forfeited_at timestamptz,correct_count int,seat int,primary key(battle_id,user_id));
create table battle_questions(battle_id uuid,position int,question_version_id uuid,reading_at timestamptz,opened_at timestamptz,deadline timestamptz,option_order uuid[]);
create table battle_answers(battle_id uuid,user_id uuid,position int,question_version_id uuid,option_id uuid,request_key uuid,received_at timestamptz,is_correct boolean,text_answer text);
create table question_versions(id uuid,answer_format text);
create table question_options(id uuid,question_version_id uuid,body text,steps text[]);
create table private.question_answer_keys(question_version_id uuid,correct_option_id uuid,gap_answers jsonb,explanation text);
create table private.battle_slots(user_id uuid,battle_id uuid);
create table private.battle_invites(battle_id uuid);
create table notifications(user_id uuid,kind text,body text,safe_target text,event_key text unique);
create table battle_integrity_events(event_id uuid primary key,battle_id uuid,user_id uuid,kind text,received_at timestamptz);
create table private.test_events(battle_id uuid);
create function private.require_user() returns uuid language sql as $$select current_setting('test.user')::uuid$$;
create function auth.uid() returns uuid language sql as $$select private.require_user()$$;
create function private.require_request_key(uuid) returns void language plpgsql as $$begin if $1 is null then raise exception 'Request key required';end if;end$$;
create function private.assert_client_supported() returns void language sql as $$select$$;
create function private.raise_error(text,text default null,jsonb default null) returns void language plpgsql as $$begin raise exception '%: %',$1,$2;end$$;
create function private.envelope(jsonb,uuid default null) returns jsonb language sql as $$select $1$$;
create function private.battle_event(uuid) returns void language sql as $$insert into private.test_events values($1)$$;
create function private.lock_participant_battle(uuid,uuid) returns public.battles language plpgsql as $$declare b public.battles;begin select * into b from public.battles where id=$2 for update;if not exists(select 1 from public.battle_participants where battle_id=$2 and user_id=$1) then raise exception 'FORBIDDEN';end if;return b;end$$;
create function private.finalize_battle(uuid) returns text language plpgsql as $$begin update public.battles set state='finished',result_kind='win',winner_user_id=(select user_id from public.battle_participants where battle_id=$1 and seat=1),finalized_at=now() where id=$1;return 'finished';end$$;
create function private.gap_answer_matches(text,jsonb) returns boolean language sql as $$select true$$;
create function private.battle_payload(p_battle_id uuid,p_user_id uuid) returns jsonb language sql as $$
select jsonb_build_object('state',b.state,'result_kind',b.result_kind,'outcome',case when b.winner_user_id=p_user_id then 'win' else 'loss' end,
'rounds',case when b.state in('finished','voided') then coalesce((select jsonb_agg(bq.position) from public.battle_questions bq where bq.battle_id = b.id), '[]'::jsonb) end,
'revision',b.revision) from public.battles b where b.id=p_battle_id$$;
`);
const original=await readFile('supabase/migrations/20261012000620_rpc_battles.sql','utf8');
await db.exec(extract(original,'private.cancel_battle('));
await db.exec(extract(original,'private.advance_battle('));
const integrity=await readFile('supabase/migrations/20261015000600_battle_integrity.sql','utf8');
await db.exec(integrity.slice(integrity.indexOf('create function public.report_battle_integrity_v1'),integrity.indexOf('revoke all on function public.report_battle_integrity_v1')));
const corrections=await readFile('supabase/migrations/20261028001100_battle_question_corrections.sql','utf8');
await db.exec(corrections.slice(corrections.indexOf('create function public.get_battle_correction_v1'),corrections.indexOf('revoke all on function public.get_battle_correction_v1')));
await db.exec(await readFile('supabase/migrations/20261028002100_forfeit_ends_battle.sql','utf8'));
const answers=await readFile('supabase/migrations/20261026000200_material_ingestion_battles.sql','utf8');
await db.exec(extract(answers,'public.submit_battle_answer_v1('));
async function setup(state='active',two=true,past=false) {
 const id=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID(),version=crypto.randomUUID(),option=crypto.randomUUID();
 await db.query(`insert into battles(id,state,starts_at,ends_at,invitation_expires_at,ready_deadline) values($1,$2,case when $2 in('ready','waiting') then null when $2='countdown' then now()+interval '10 seconds' else now()-interval '30 seconds' end,case when $2 in('ready','waiting') then null when $3 then now()-interval '1 second' else now()+interval '10 minutes' end,now()+interval '1 hour',now()+interval '1 hour')`,[id,state,past]);
 await db.query('insert into battle_participants(battle_id,user_id,seat) values($1,$2,1)',[id,a]);
 if(two)await db.query('insert into battle_participants(battle_id,user_id,seat) values($1,$2,2)',[id,b]);
 await db.query('insert into private.battle_slots values($1,$2),($3,$2)',[a,id,b]);
 await db.query('insert into private.battle_invites values($1)',[id]);
 await db.query("insert into battle_questions values($1,1,$2,now()-interval '20 seconds',now()-interval '19 seconds',now()+interval '1 minute',array[$3::uuid]),($1,2,$2,now()+interval '2 minutes',now()+interval '2 minutes',now()+interval '3 minutes',array[$3::uuid])",[id,version,option]);
 await db.query("insert into question_versions values($1,'standard')",[version]);
 await db.query("insert into question_options values($1,$2,'Correct',array[]::text[])",[option,version]);
 await db.query("insert into private.question_answer_keys values($1,$2,null,'Explanation')",[version,option]);
 // The forfeiter is ahead, but the opponent must still win.
 await db.query('insert into battle_answers(battle_id,user_id,position,received_at,is_correct) values($1,$2,1,now(),true)',[id,a]);
 return {id,a,b};
}
async function as(user) {await db.query("select set_config('test.user',$1,false)",[user]);}
async function forfeit(id) {return (await q('select public.forfeit_battle_v1($1,$2) data',[id,crypto.randomUUID()]))[0].data;}
for(const state of ['active','countdown','ready']) {
 const t=await setup(state);await as(t.a);
 const result=await forfeit(t.id);assert.equal(result.state,'finished');assert.equal(result.outcome,'loss');assert.equal(result.result_kind,'forfeit');
 assert.deepEqual(result.rounds,[1]);
 await as(t.b);const opponent=(await q('select private.battle_payload($1,$2) data',[t.id,t.b]))[0].data;assert.equal(opponent.outcome,'win');
 assert.equal((await forfeit(t.id)).revision,result.revision); // A second forfeit cannot reverse the winner.
 await as(t.a);assert.equal((await forfeit(t.id)).revision,result.revision);
 assert.equal((await q('select count(*)::int n from notifications where safe_target=$1',['/battles/'+t.id]))[0].n,2);
 assert.equal((await q('select count(*)::int n from private.battle_slots where battle_id=$1',[t.id]))[0].n,0);
 assert.equal((await q('select count(*)::int n from private.battle_invites where battle_id=$1',[t.id]))[0].n,0);
 assert.equal((await q('select count(*)::int n from private.test_events where battle_id=$1',[t.id]))[0].n,1);
 await assert.rejects(db.query('select public.submit_battle_answer_v1($1,1,null,$2,null)',[t.id,crypto.randomUUID()]),/DEADLINE_PASSED/);
 await db.query('select public.get_battle_correction_v1($1,1)',[t.id]);
 await assert.rejects(db.query('select public.get_battle_correction_v1($1,2)',[t.id]),/CONTENT_UNAVAILABLE/);
 await as(crypto.randomUUID());await assert.rejects(forfeit(t.id),/FORBIDDEN/);
}
const waiting=await setup('waiting',false);await as(waiting.a);assert.equal((await forfeit(waiting.id)).state,'cancelled');
const expired=await setup('active',true,true);await as(expired.b);assert.equal((await forfeit(expired.id)).result_kind,'win');
const auto=await setup();await as(auto.a);
for(let i=0;i<3;i++)await db.query("select public.report_battle_integrity_v1($1,$2,'copy_attempt')",[auto.id,crypto.randomUUID()]);
const finished=(await q('select * from public.battles where id=$1',[auto.id]))[0];assert.equal(finished.state,'finished');assert.equal(finished.winner_user_id,auto.b);
await db.close();
console.log('Passed: manual/automatic forfeit, active/countdown/ready, opponent wins despite lower score, immediate terminal result, retries, opposing forfeit, spectator rejection, cleanup/events, late-answer rejection, unopened corrections hidden, waiting cancellation and expired result preservation.');
