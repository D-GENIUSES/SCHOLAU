-- Per-answer XP: math, idempotency, review stages, battle limits, and personal progress security.
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
    values('20000000-0000-4000-8000-000000000002',(select id from public.battle_rules where published_at is not null order by version desc limit 1),'direct',p_state,p_user,gen_random_uuid(),
      now()-interval '2 minutes',now()-interval '1 minute',now(),p_kind,5,20) returning id into v;
  insert into public.battle_participants(battle_id,user_id,seat,correct_count) values(v,p_user,1,5),(v,p_other,2,0); return v;
end $$;


select set_config('t.u',pg_temp.student('Per answer student')::text,true) is not null as setup;
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',5,5)),5,'perfect five-question practice earns five XP');
insert into private.xp_bests(user_id,activity_type,activity_id,earned)
select current_setting('t.u')::uuid,'practice',a.id,50 from public.assessments a where a.kind='practice';
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',4,5)),4,'legacy best does not suppress new per-answer awards');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',0,5)),0,'all incorrect earns zero');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'mock',32,50)),32,'32 correct out of 50 earns 32 XP');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'mock',32,50)),32,'new mock attempt earns points again');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'mock',0,50)),0,'zero-correct mock earns zero');
select is((select count(*)::integer from public.points_ledger where user_id=current_setting('t.u')::uuid and source_type in ('practice','mock') and reason='One XP per correct answer.'),6,'ledger explains per-answer awards including zero');

create function pg_temp.scored_battle(p_rounds integer,p_first integer,p_second integer)
returns uuid language plpgsql as $$
declare v uuid; v_first uuid:=pg_temp.student('First player'); v_second uuid:=pg_temp.student('Second player'); begin
  insert into public.battles(offering_id,rules_id,mode,state,created_by,request_key,starts_at,ends_at,round_count,seconds_per_round)
  values('20000000-0000-4000-8000-000000000002',(select id from public.battle_rules where published_at is not null order by version desc limit 1),'direct','active',v_first,gen_random_uuid(),now()-interval '10 minutes',now()-interval '1 minute',p_rounds,20) returning id into v;
  insert into public.battle_participants(battle_id,user_id,seat) values(v,v_first,1),(v,v_second,2);
  insert into public.battle_questions(battle_id,position,question_version_id,reading_at,opened_at,deadline,option_order)
  select v,row_number() over(order by qv.id),qv.id,now()-interval '9 minutes',now()-interval '8 minutes',now()-interval '2 minutes',array(select o.id from public.question_options o where o.question_version_id=qv.id order by o.id)
  from public.question_versions qv join public.questions q on q.id=qv.question_id where q.pool='battle' order by qv.id limit p_rounds;
  insert into public.battle_answers(battle_id,user_id,position,question_version_id,option_id,request_key,received_at)
  select v,bp.user_id,bq.position,bq.question_version_id,k.correct_option_id,gen_random_uuid(),now()-interval '3 minutes'
  from public.battle_questions bq join private.question_answer_keys k on k.question_version_id=bq.question_version_id
  cross join public.battle_participants bp
  where bq.battle_id=v and bp.battle_id=v and bq.position<=case bp.seat when 1 then p_first else p_second end;
  perform private.finalize_battle(v);
  return v;
end $$;
create function pg_temp.battle_xp(p_battle uuid,p_seat integer) returns integer language sql as $$
 select l.amount from public.points_ledger l join public.battle_participants bp on bp.battle_id=l.source_id and bp.user_id=l.user_id where bp.battle_id=p_battle and bp.seat=p_seat
$$;
select set_config('t.short',pg_temp.scored_battle(3,2,1)::text,true) is not null as setup;
select is(pg_temp.battle_xp(current_setting('t.short')::uuid,1),24,'three-question winner receives fixed 20 plus two per correct answer');
select is(pg_temp.battle_xp(current_setting('t.short')::uuid,2),2,'loser receives two per correct answer');
select set_config('t.long',pg_temp.scored_battle(5,5,2)::text,true) is not null as setup;
select is(pg_temp.battle_xp(current_setting('t.long')::uuid,1),30,'five-question winner receives the same fixed 20 bonus');
select is(pg_temp.battle_xp(current_setting('t.long')::uuid,2),4,'loser with two correct receives four XP');
select lives_ok($$select private.finalize_battle(current_setting('t.long')::uuid)$$,'battle finalization retry succeeds');
select is(pg_temp.battle_xp(current_setting('t.long')::uuid,1),30,'retry does not duplicate winner XP');
select set_config('t.draw',pg_temp.scored_battle(5,3,3)::text,true) is not null as setup;
select is(pg_temp.battle_xp(current_setting('t.draw')::uuid,1),6,'first tied player receives only answer XP');
select is(pg_temp.battle_xp(current_setting('t.draw')::uuid,2),6,'second tied player receives only answer XP');
select set_config('t.zero',pg_temp.scored_battle(5,0,0)::text,true) is not null as setup;
select is(pg_temp.battle_xp(current_setting('t.zero')::uuid,1),0,'zero-correct draw receives zero XP');
select is((select count(*)::integer from public.user_points p where total<>(select coalesce(sum(amount),0) from public.points_ledger l where l.user_id=p.user_id)),0,'all cached balances reconcile with immutable ledger');
select * from finish();
rollback;
