begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
\ir ../helpers/legal-fixtures.inc

do $test$
declare
  a uuid := gen_random_uuid(); c uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  battle uuid := gen_random_uuid(); offering uuid; question uuid; correct uuid; wrong uuid;
  answer_key uuid := gen_random_uuid(); initial_revision bigint; result jsonb; ack jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (a,a::text||'@example.invalid','{"display_name":"Reveal A"}'),
    (c,c::text||'@example.invalid','{"display_name":"Reveal B"}'),
    (outsider,outsider::text||'@example.invalid','{"display_name":"Reveal outsider"}');
  select o.id,v.id,k.correct_option_id into offering,question,correct
    from public.course_offerings o join public.questions q on q.course_id=o.course_id
    join public.question_versions v on v.question_id=q.id
    join private.question_answer_keys k on k.question_version_id=v.id
    where q.pool='battle' and v.status='published' and k.correct_option_id is not null limit 1;
  if question is null then raise exception 'Missing battle question fixture'; end if;
  select id into wrong from public.question_options where question_version_id=question and id<>correct limit 1;
  insert into public.battles(id,offering_id,rules_id,mode,state,created_by,starts_at,ends_at,round_count,seconds_per_round)
    values(battle,offering,(private.active_battle_rules()).id,'direct','active',a,now()-interval '2 seconds',now()+interval '1 minute',1,20);
  insert into public.battle_participants(battle_id,user_id,seat) values(battle,a,1),(battle,c,2);
  insert into public.battle_questions(battle_id,position,question_version_id,opened_at,deadline,option_order)
    values(battle,1,question,now()-interval '1 second',now()+interval '20 seconds',array[correct,wrong]);
  if private.battle_latest_round_result(battle,a) is not null then raise exception 'Unanswered open round revealed'; end if;
  select revision into initial_revision from public.battles where id=battle;
  perform set_config('request.jwt.claim.sub',a::text,true);
  ack := public.submit_battle_answer_v1(battle,1,correct,answer_key,null);
  if ack ? 'is_correct' or ack ? 'latest_round_result' then raise exception 'Acknowledgement leaked grading'; end if;
  if private.battle_payload(battle,a)->'latest_round_result' <> 'null'::jsonb then raise exception 'First answer revealed'; end if;
  if exists(select 1 from jsonb_array_elements(private.battle_payload(battle,a)->'participants') p where p->>'correct_count' is not null) then raise exception 'Score leaked grading'; end if;
  perform public.submit_battle_answer_v1(battle,1,correct,answer_key,null);
  perform public.submit_battle_answer_v1(battle,1,wrong,gen_random_uuid(),null);
  if (select revision from public.battles where id=battle) <> initial_revision+1 then raise exception 'Retry emitted duplicate revision'; end if;
  perform set_config('request.jwt.claim.sub',c::text,true);
  perform public.submit_battle_answer_v1(battle,1,wrong,gen_random_uuid(),null);
  result := private.battle_payload(battle,a)->'latest_round_result';
  if result <> '{"position":1,"my_status":"correct","opponent_status":"incorrect"}'::jsonb then raise exception 'Mixed results incorrect: %',result; end if;
  if private.battle_latest_round_result(battle,c) <> '{"position":1,"my_status":"incorrect","opponent_status":"correct"}'::jsonb then raise exception 'Perspective incorrect'; end if;
  if private.battle_latest_round_result(battle,outsider) is not null then raise exception 'Outsider reveal'; end if;
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.get_battle_state_v1(battle);
    raise exception 'Outsider accessed battle API';
  exception when sqlstate 'PT404' then null; when sqlstate 'PT403' then null; end;
  perform set_config('request.jwt.claim.sub',c::text,true);
  begin
    perform public.get_battle_correction_v1(battle,1);
    raise exception 'Correction exposed during battle';
  exception when sqlstate 'PT409' then null; end;
  if (select revision from public.battles where id=battle) <> initial_revision+2 then raise exception 'Second answer missing signal'; end if;
  update public.battle_answers set is_correct=true where battle_id=battle;
  if private.battle_latest_round_result(battle,a)->>'opponent_status'<>'correct' then raise exception 'Both correct'; end if;
  update public.battle_answers set is_correct=false where battle_id=battle;
  if private.battle_latest_round_result(battle,a)->>'my_status'<>'incorrect' then raise exception 'Both incorrect'; end if;
  delete from public.battle_answers where battle_id=battle and user_id=c;
  update public.battle_questions set deadline=now() where battle_id=battle;
  if private.battle_latest_round_result(battle,a)->>'opponent_status'<>'unanswered' then raise exception 'Single timeout'; end if;
  begin
    perform public.submit_battle_answer_v1(battle,1,correct,gen_random_uuid(),null);
    raise exception 'Late answer accepted';
  exception when sqlstate 'PT409' then null; end;
  delete from public.battle_answers where battle_id=battle;
  if private.battle_latest_round_result(battle,a) <> '{"position":1,"my_status":"unanswered","opponent_status":"unanswered"}'::jsonb then raise exception 'Double timeout'; end if;
  update public.battles set state='finished',result_kind='forfeit',finalized_at=now()-interval '500 milliseconds' where id=battle;
  if private.battle_latest_round_result(battle,a) is not null then raise exception 'Post-forfeit deadline revealed unfinished round'; end if;
  if has_function_privilege('authenticated','private.battle_latest_round_result(uuid,uuid)','execute') then raise exception 'Helper exposed'; end if;
end $test$;
select pass('Round reveal gating, perspectives, timeouts, privacy, retries, signals and forfeits');
select * from finish();
rollback;
