-- Mastery XP v2: math, idempotency, review stages, battle limits, and personal progress security.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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

select set_config('t.u',pg_temp.student('Mastery student')::text,true) is not null as setup;
select set_config('t.v',pg_temp.student('Other student')::text,true) is not null as setup;
select set_config('t.b',pg_temp.student('Battle student')::text,true) is not null as setup;
select is((select total from public.user_points where user_id=current_setting('t.u')::uuid),10::bigint,'new student starts with 10 welcome XP');
select is(private.xp_level(0)->>'level','1','zero XP starts level 1');
select is(private.xp_level(99)->>'level','1','99 XP remains level 1');
select is(private.xp_level(100)->>'level','2','100 XP reaches level 2');
select is(private.xp_level(299)->>'level','2','299 XP remains level 2');
select is(private.xp_level(300)->>'level','3','300 XP reaches level 3');
select is(private.xp_level(600)->>'level','4','600 XP reaches level 4');
select is(private.xp_level(1000)->>'level','5','1000 XP reaches level 5');
select is(private.xp_level(1000)->>'xp_into_level','0','level boundary progress resets to zero');
select is(private.lagos_date('2026-10-14 22:59:59+00'),'2026-10-14'::date,'Lagos day before midnight');
select is(private.lagos_date('2026-10-14 23:00:00+00'),'2026-10-15'::date,'Lagos day changes at 23:00 UTC');

select pg_temp.login(current_setting('t.u')::uuid);
select is((public.complete_lesson_v1('23000000-0000-4000-8000-000000000001',gen_random_uuid())->>'xp_awarded')::integer,0,'reading completion awards no XP');
select is((public.get_xp_progress_v1()->>'xp_total')::integer,10,'reading leaves welcome XP unchanged');
reset role;
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',6,10)),30,'first 60 percent practice earns 30');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',8,10)),10,'improving to 80 percent earns difference');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',8,10)),0,'equal best earns zero');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'practice',4,10)),0,'lower score earns zero');
select set_config('t.perfect',pg_temp.attempt(current_setting('t.u')::uuid,'practice',10,10)::text,true) is not null as setup;
select is(pg_temp.delta(current_setting('t.perfect')::uuid),10,'perfect score earns final difference');
select lives_ok($$select private.award_mastery_attempt(current_setting('t.perfect')::uuid)$$,'duplicate finalization is safe');
select is(pg_temp.delta(current_setting('t.perfect')::uuid),10,'duplicate finalization does not double XP');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.v')::uuid,'practice',1,3)),16,'fractional award rounds down');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.v')::uuid,'mock',5,5,'active')),0,'unfinished attempt earns zero');
update public.assessment_attempts set status='expired',finalized_at=now() where user_id=current_setting('t.v')::uuid and status='active';
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.v')::uuid,'mock',5,5,'expired')),0,'expired attempt earns zero');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'mock',4,5)),80,'80 percent mock earns 80 without a daily learning cap');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'review',4,5)),16,'knowledge check earns up to 20');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.u')::uuid,'review',5,5)),4,'knowledge check improvement shares topic allowance');
select is((select count(*)::integer from private.xp_badges where user_id=current_setting('t.u')::uuid),4,'four achievement badges earned once each');
select is((select count(*)::integer from private.topic_mastery where user_id=current_setting('t.u')::uuid),1,'mastery recorded once');

-- Scheduled reviews use the production question snapshots and submit RPC.
select pg_temp.login(current_setting('t.u')::uuid);
select throws_ok($$select public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',1,gen_random_uuid())$$,'PT422','VALIDATION_FAILED','review blocked before due date');
select throws_ok($$select public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',0,gen_random_uuid())$$,'PT422','VALIDATION_FAILED','invalid review stage rejected');
reset role;
update private.topic_mastery set mastered_at=now()-interval '31 days' where user_id=current_setting('t.u')::uuid;
select pg_temp.login(current_setting('t.u')::uuid);
select throws_ok($$select public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',2,gen_random_uuid())$$,'PT422','VALIDATION_FAILED','cannot skip review stage 1');
select set_config('t.review_key',gen_random_uuid()::text,true) is not null as setup;
select set_config('t.review',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',1,current_setting('t.review_key')::uuid)->>'attempt_id',true) is not null as setup;
select is(public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',1,current_setting('t.review_key')::uuid)->>'attempt_id',current_setting('t.review'),'review start retry resumes same attempt');
select is((pg_temp.submit_n(current_setting('t.review')::uuid,2)->'result'->>'xp_awarded')::integer,0,'review below 80 percent earns zero');
select set_config('t.review2',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',1,gen_random_uuid())->>'attempt_id',true) is not null as setup;
select is((pg_temp.submit_n(current_setting('t.review2')::uuid,3)->'result'->>'xp_awarded')::integer,10,'failed review may be retried for 10 XP');
select is((public.submit_attempt_v1(current_setting('t.review2')::uuid,null,gen_random_uuid())->'result'->>'xp_awarded')::integer,10,'review submission retry returns committed award');
select throws_ok($$select public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',1,gen_random_uuid())$$,'PT422','VALIDATION_FAILED','completed stage cannot be farmed');
select set_config('t.review3',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',2,gen_random_uuid())->>'attempt_id',true) is not null as setup;
select is((pg_temp.submit_n(current_setting('t.review3')::uuid,3)->'result'->>'xp_awarded')::integer,10,'second review stage awards 10');
select set_config('t.review4',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',3,gen_random_uuid())->>'attempt_id',true) is not null as setup;
select is((pg_temp.submit_n(current_setting('t.review4')::uuid,3)->'result'->>'xp_awarded')::integer,10,'third review stage awards 10');
select is(jsonb_array_length(public.get_xp_progress_v1()->'badges'),5,'all five badges visible in personal progress');
select ok(not jsonb_path_exists(public.get_xp_progress_v1(),'$.reviews[*] ? (@.available == true)'),'completed reviews no longer available');
reset role;
select is((select earned from private.xp_bests where user_id=current_setting('t.u')::uuid and activity_type='lesson'),20,'scheduled review XP does not change lesson personal best');
select is((select sum(amount)::integer from public.points_ledger where user_id=current_setting('t.u')::uuid and source_type='review'),30,'three reviews award exactly 30 XP');

-- Same opponent limit counts completed matches even at zero XP.
select set_config('t.battle1',pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid)::text,true) is not null as setup;
select is(private.award_mastery_battle(current_setting('t.b')::uuid,current_setting('t.battle1')::uuid,'battle_win',15),15,'perfect win earns 15 XP');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,current_setting('t.battle1')::uuid,'battle_win',15),0,'battle replay awards zero');
select is((select completed from private.battle_xp_counts where user_id=current_setting('t.b')::uuid),1,'battle replay does not increment limits');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid),'battle_loss',0),0,'zero-correct completed loss awards zero');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid),'battle_win',15),0,'third same-opponent match earns zero');
select is((select completed from private.battle_xp_counts where user_id=current_setting('t.b')::uuid),3,'zero-award matches count toward daily limits');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid,'cancelled','cancelled'),'battle_win',15),0,'cancelled match earns zero');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid,'cancelled','forfeit'),'battle_win',15),0,'forfeited match earns zero');
select is((select completed from private.battle_xp_counts where user_id=current_setting('t.b')::uuid),3,'cancelled matches do not consume limits');
-- Fill daily allowance using fresh opponents to separate daily and opponent caps.
do $$ declare i integer; v_other uuid; begin
  for i in 1..7 loop v_other:=pg_temp.new_user('Opponent '||i); perform private.award_mastery_battle(current_setting('t.b')::uuid,
    pg_temp.battle(current_setting('t.b')::uuid,v_other),'battle_win',15); end loop;
end $$;
select is((select completed from private.battle_xp_counts where user_id=current_setting('t.b')::uuid),10,'first ten completed matches counted');
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.u')::uuid),'battle_win',15),0,'eleventh completed match cannot earn XP');
-- Move counter rows to yesterday to simulate the next daily window.
update private.battle_xp_counts set local_date=private.lagos_date()-1 where user_id=current_setting('t.b')::uuid;
update private.battle_opponent_counts set local_date=private.lagos_date()-1 where user_id=current_setting('t.b')::uuid;
select is(private.award_mastery_battle(current_setting('t.b')::uuid,pg_temp.battle(current_setting('t.b')::uuid,current_setting('t.v')::uuid),'battle_draw',12),12,'new Lagos day resets both daily and opponent allowances');

select is((select total from public.user_points where user_id=current_setting('t.u')::uuid),190::bigint,'lifetime XP includes welcome bonus and learning improvements');
select is((select count(*)::integer from private.xp_badges where user_id=current_setting('t.u')::uuid),5,'badges remain unique and award no bonus XP');
select pg_temp.login(current_setting('t.u')::uuid);
select is((public.get_home_summary_v1()->>'learning_xp_today')::integer,180,'dashboard daily learning XP derives from ledger');
select is((public.get_xp_progress_v1()->>'xp_total')::integer,190,'personal progress returns own total including welcome XP');
select throws_ok($$select private.award_mastery_attempt(current_setting('t.perfect')::uuid)$$,'42501',null,'students cannot invoke internal awards');
select throws_ok($$select * from private.xp_badges$$,'42501',null,'private badge records not directly readable');
select throws_ok($$insert into public.points_ledger(user_id,source_type,source_id,event_key,requested_amount,amount,local_date)
  values(auth.uid(),'practice',gen_random_uuid(),'hack',100,100,current_date)$$,'42501',null,'students cannot insert XP');
reset role;
select pg_temp.login(current_setting('t.v')::uuid);
select is(jsonb_array_length(public.get_xp_progress_v1()->'badges'),0,'another student cannot see earned badges');
reset role;
set local role anon;
select throws_ok($$select public.get_xp_progress_v1()$$,'42501',null,'guests cannot access XP progress');
reset role;
select throws_ok($$update public.points_ledger set amount=999$$,'23514',null,'XP ledger remains append-only');
select throws_ok($$delete from public.points_ledger$$,'23514',null,'XP history cannot be deleted');
select throws_ok($$insert into public.points_ledger(user_id,source_type,source_id,event_key,requested_amount,amount,adjusts_entry_id,reason,local_date)
  select user_id,'correction',source_id,'bad-correction',-amount,-amount,id,null,local_date from public.points_ledger where amount>0 limit 1$$,
  '23514',null,'administrative corrections require a reason');
select is((select total from public.user_points where user_id=current_setting('t.u')::uuid),
  (select sum(amount)::bigint from public.points_ledger where user_id=current_setting('t.u')::uuid),'cached total matches ledger');

-- Exact review threshold and expired-review retry regression.
select set_config('t.c',pg_temp.student('Review threshold student')::text,true) is not null as setup;
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.c')::uuid,'review',4,5)),16,'exact 80 percent topic check schedules reviews');
update private.topic_mastery set mastered_at=now()-interval '31 days' where user_id=current_setting('t.c')::uuid;
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.c')::uuid,'review',4,5,'submitted',1)),10,'exact 80 percent scheduled review earns 10');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.c')::uuid,'review',3,5,'submitted',2)),0,'60 percent review fails threshold');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.c')::uuid,'review',4,5,'submitted',2)),10,'failed scheduled stage can be retried at exact threshold');
select pg_temp.login(current_setting('t.c')::uuid);
select set_config('t.c_review',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',3,gen_random_uuid())->>'attempt_id',true) is not null as setup;
reset role;
update public.assessment_attempts set started_at=now()-interval '1 hour',expires_at=now()-interval '1 second' where id=current_setting('t.c_review')::uuid;
select pg_temp.login(current_setting('t.c')::uuid);
select set_config('t.c_retry',public.start_topic_review_v1('22000000-0000-4000-8000-000000000001',3,gen_random_uuid())->>'attempt_id',true) is not null as setup;
select ok(current_setting('t.c_review')<>current_setting('t.c_retry'),'expired scheduled review starts a new retry');
select is((public.get_attempt_result_v1(current_setting('t.c_review')::uuid)->'result'->>'xp_awarded')::integer,0,'expired review awards no XP');
select is((pg_temp.submit_n(current_setting('t.c_retry')::uuid,3)->'result'->>'xp_awarded')::integer,10,'retry keeps scheduled-review award category');
reset role;

-- Revised assessment versions keep the logical activity XP allowance.
insert into public.assessment_versions(assessment_id,version,question_count,feedback_mode)
  values('30000000-0000-4000-8000-000000000004',2,6,'after_submit');
select is(pg_temp.delta(pg_temp.attempt(current_setting('t.v')::uuid,'practice',2,3)),17,'new version earns improvement over the existing logical assessment best');
select is((select earned from private.xp_bests where user_id=current_setting('t.v')::uuid and activity_type='practice'),33,'new assessment version does not reset personal-best allowance');

-- Administrative corrections retain a reason and cannot be replayed.
select set_config('t.entry',(select id::text from public.points_ledger where source_id=current_setting('t.perfect')::uuid),true) is not null as setup;
select is(private.compensate_entry(current_setting('t.entry')::uuid,current_setting('t.u')::uuid,'Test review correction'),-10,'reasoned correction reverses only original award');
select is(private.compensate_entry(current_setting('t.entry')::uuid,current_setting('t.u')::uuid,'Duplicate correction'),0,'correction retry cannot reverse XP twice');
select is((select reason from public.points_ledger where adjusts_entry_id=current_setting('t.entry')::uuid),'Test review correction','correction reason retained in immutable history');
select is((select earned from private.xp_bests where user_id=current_setting('t.u')::uuid and activity_type='practice'),50,'correction does not reopen earned allowance');

select * from finish();
rollback;
