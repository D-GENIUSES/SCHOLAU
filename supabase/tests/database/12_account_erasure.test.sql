-- Mastery XP v2: math, idempotency, review stages, battle limits, and personal progress security.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid(); begin
  insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
  values('00000000-0000-0000-0000-000000000000',v,'authenticated','authenticated',v::text||'@test.local',jsonb_build_object('display_name',p_name),now(),now());
  return v;
end $$;
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_uid,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',coalesce(p_uid::text,''),true);
  perform set_config('role','authenticated',true);
end $$;
create function pg_temp.student(p_name text) returns uuid language plpgsql as $$
declare v uuid:=pg_temp.new_user(p_name); begin
  perform private.apply_academic_profile(v,v,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006','initial',null,null);
  insert into public.enrollments(user_id,offering_id) values(v,'20000000-0000-4000-8000-000000000002') on conflict (user_id,offering_id) do nothing; return v;
end $$;
-- Unit fixture for the award engine. Production callers always grade via finalize_attempt.
create function pg_temp.attempt(p_user uuid,p_kind text,p_correct integer,p_total integer,p_status text default 'submitted',p_stage integer default null)
returns uuid language plpgsql as $$ declare v uuid; v_assessment uuid; v_version uuid; begin
  select a.id,av.id into v_assessment,v_version from public.assessments a join public.assessment_versions av on av.assessment_id=a.id
    where a.kind=p_kind order by a.position,a.id,av.version desc limit 1;
  insert into public.assessment_attempts(user_id,offering_id,assessment_id,assessment_version_id,request_key,status,started_at,finalized_at,
    scoring_version,feedback_mode,total_count,correct_count,answered_count,xp_review_stage)
  values(p_user,'20000000-0000-4000-8000-000000000002',v_assessment,v_version,gen_random_uuid(),p_status,now(),
    case when p_status='active' then null else now() end,1,'after_submit',p_total,p_correct,p_total,p_stage) returning id into v;
  perform private.award_mastery_attempt(v); return v;
end $$;
create function pg_temp.delta(p_attempt uuid) returns integer language sql as $$
  select coalesce(sum(amount),0)::integer from public.points_ledger where source_id=p_attempt
$$;
-- Test-only trusted answer builder; checks the production submission/grading RPC.
create function pg_temp.submit_n(p_attempt uuid,p_correct integer) returns jsonb language plpgsql security definer as $$
declare v_answers jsonb; begin
  select jsonb_agg(jsonb_build_object('question_version_id',q.question_version_id,'option_id',
    case when q.position<=p_correct then k.correct_option_id else
      (select id from public.question_options where question_version_id=q.question_version_id and id<>k.correct_option_id limit 1) end,
    'answer_revision',1)) into v_answers
  from public.attempt_questions q join private.question_answer_keys k on k.question_version_id=q.question_version_id where q.attempt_id=p_attempt;
  return public.submit_attempt_v1(p_attempt,v_answers,gen_random_uuid());
end $$;
create function pg_temp.battle(p_user uuid,p_other uuid,p_state text default 'finished',p_kind text default 'win')
returns uuid language plpgsql as $$ declare v uuid; begin
  insert into public.battles(offering_id,rules_id,mode,state,created_by,request_key,starts_at,ends_at,finalized_at,result_kind,round_count,seconds_per_round)
    values('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','direct',p_state,p_user,gen_random_uuid(),
      now()-interval '2 minutes',now()-interval '1 minute',now(),p_kind,5,20) returning id into v;
  insert into public.battle_participants(battle_id,user_id,seat,correct_count) values(v,p_user,1,5),(v,p_other,2,0); return v;
end $$;


select set_config('erase.user',pg_temp.student('Erase me')::text,true) is not null as setup;
select set_config('erase.other',pg_temp.student('Keep me')::text,true) is not null as setup;
select set_config('erase.battle',pg_temp.battle(current_setting('erase.user')::uuid,current_setting('erase.other')::uuid)::text,true) is not null as setup;
update public.battles set winner_user_id=current_setting('erase.user')::uuid where id=current_setting('erase.battle')::uuid;
select pg_temp.attempt(current_setting('erase.user')::uuid,'review',3,3);
update private.topic_mastery set mastered_at=now()-interval '31 days' where user_id=current_setting('erase.user')::uuid;
select set_config('erase.attempt',pg_temp.attempt(current_setting('erase.user')::uuid,'review',3,3,'submitted',1)::text,true) is not null as setup;
insert into private.review_awards(user_id,lesson_id,stage,attempt_id)
values(current_setting('erase.user')::uuid,'22000000-0000-4000-8000-000000000001',1,current_setting('erase.attempt')::uuid) on conflict do nothing;
insert into private.battle_opponent_counts values(current_setting('erase.other')::uuid,current_setting('erase.user')::uuid,current_date,1);
insert into public.entitlements(user_id,source,source_reference,starts_at,granted_by,reason)
values(current_setting('erase.other')::uuid,'admin',gen_random_uuid()::text,now(),current_setting('erase.user')::uuid,'Test grant');
insert into public.points_ledger(user_id,source_type,source_id,event_key,requested_amount,amount,adjusts_entry_id,reason,actor_id,local_date)
select current_setting('erase.other')::uuid,'correction',gen_random_uuid(),'test-correction',0,0,id,'Test correction',current_setting('erase.user')::uuid,current_date
from public.points_ledger where user_id=current_setting('erase.other')::uuid limit 1;
select set_config('erase.other_xp',(select total::text from public.user_points where user_id=current_setting('erase.other')::uuid),true) is not null as setup;
insert into public.notifications(user_id,kind,body) values(current_setting('erase.user')::uuid,'test','Delete this notification');
insert into private.outbox(event_key,topic,safe_payload) values('erase-test','user:'||current_setting('erase.user'),'{}');
insert into public.battles(offering_id,rules_id,mode,state,created_by,request_key,round_count,seconds_per_round)
values('20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','direct','ready',current_setting('erase.user')::uuid,gen_random_uuid(),5,20);
select set_config('erase.live',(select id::text from public.battles where state='ready' and created_by=current_setting('erase.user')::uuid),true) is not null as setup;
insert into public.battle_participants(battle_id,user_id,seat) values
(current_setting('erase.live')::uuid,current_setting('erase.user')::uuid,1),(current_setting('erase.live')::uuid,current_setting('erase.other')::uuid,2);
insert into private.battle_slots(user_id,battle_id,expires_at) values
(current_setting('erase.user')::uuid,current_setting('erase.live')::uuid,now()+interval '10 minutes'),
(current_setting('erase.other')::uuid,current_setting('erase.live')::uuid,now()+interval '10 minutes');
select throws_ok(format('delete from public.points_ledger where user_id=%L',current_setting('erase.other')),'23514',null,'ledger deletion still blocked outside Auth erasure');
select ok(not has_table_privilege('authenticated','private.account_erasure_context','INSERT'),'clients cannot bypass ledger protection');
select ok(not has_function_privilege('authenticated','private.erase_auth_user_data()','EXECUTE'),'no client-callable erasure function');
select lives_ok(format('delete from auth.users where id=%L',current_setting('erase.user')),'Auth deletion erases a user with XP, reviews and shared battles');
select is((select count(*) from public.profiles where id=current_setting('erase.user')::uuid),0::bigint,'profile removed');
select is((select count(*) from auth.users where id=current_setting('erase.user')::uuid),0::bigint,'Auth identity removed');
select is((select count(*) from public.points_ledger where user_id=current_setting('erase.user')::uuid),0::bigint,'XP history removed');
select is((select count(*) from public.assessment_attempts where user_id=current_setting('erase.user')::uuid),0::bigint,'attempts removed');
select is((select count(*) from private.review_awards where user_id=current_setting('erase.user')::uuid),0::bigint,'review awards removed');
select is((select count(*) from private.outbox where topic like '%'||current_setting('erase.user')||'%'),0::bigint,'personal event payloads removed');
select is((select count(*) from private.account_erasure_context),0::bigint,'erasure exception removed after deletion');
select is((select count(*) from public.profiles where id=current_setting('erase.other')::uuid),1::bigint,'other profile preserved');
select is((select total::text from public.user_points where user_id=current_setting('erase.other')::uuid),current_setting('erase.other_xp'),'other XP unchanged');
select is((select count(*) from public.points_ledger where user_id=current_setting('erase.other')::uuid and event_key='test-correction'),1::bigint,'other ledger entry retained');
select ok((select actor_id is null from public.points_ledger where event_key='test-correction'),'deleted actor removed from other ledger');
select is((select count(*) from public.entitlements where user_id=current_setting('erase.other')::uuid),1::bigint,'other premium grant retained');
select is((select state from public.battles where id=current_setting('erase.battle')::uuid),'finished','shared finished battle retained');
select is((select state from public.battles where id=current_setting('erase.live')::uuid),'cancelled','active match cancelled');
select is((select count(*) from private.battle_slots where battle_id=current_setting('erase.live')::uuid),0::bigint,'both live reservations released');
select pg_temp.login(current_setting('erase.other')::uuid);
select is((public.get_my_battles_v1()->'items'->0->'opponent'->>'display_name'),'Deleted user','surviving battle history loads');
reset role;
-- Delete an existing reviewed-content author, preserving all shared content.
select set_config('erase.content_count',(select count(*)::text from public.lesson_versions),true) is not null as setup;
select throws_ok('update public.lesson_versions set reviewed_by=null,reviewer_deleted=true where reviewed_by=''90000000-0000-4000-8000-000000000002''','23514',null,'published reviewer attribution cannot be bypassed outside deletion');
select lives_ok('delete from auth.users where id=''90000000-0000-4000-8000-000000000002''','deleting reviewed-content author succeeds');
select is((select count(*)::text from public.lesson_versions),current_setting('erase.content_count'),'shared lesson content retained');
select is((select count(*) from public.lesson_versions where reviewed_by='90000000-0000-4000-8000-000000000002'),0::bigint,'reviewer identity erased');
select throws_ok(format('delete from public.points_ledger where user_id=%L',current_setting('erase.other')),'23514',null,'ledger remains protected after deletion');
select * from finish();
rollback;
