-- Read-only checks against finalized matches; temporary active-state check rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

select set_config('bc.battle',gen_random_uuid()::text,true);
insert into public.battles(id,offering_id,rules_id,mode,state,created_by,starts_at,ends_at,finalized_at,result_kind,round_count,seconds_per_round)
values(current_setting('bc.battle')::uuid,'20000000-0000-4000-8000-000000000002',
  (private.active_battle_rules()).id,'direct','finished','90000000-0000-4000-8000-000000000001',
  now()-interval '2 minutes',now()-interval '1 minute',now(),'draw',1,20);
insert into public.battle_participants(battle_id,user_id,seat,correct_count)
values(current_setting('bc.battle')::uuid,'90000000-0000-4000-8000-000000000001',1,0),
      (current_setting('bc.battle')::uuid,'90000000-0000-4000-8000-000000000002',2,0);
insert into public.battle_questions(battle_id,position,question_version_id,opened_at,deadline,option_order)
select current_setting('bc.battle')::uuid,1,qv.id,now()-interval '2 minutes',now()-interval '1 minute',
  (select array_agg(id order by position) from public.question_options where question_version_id=qv.id)
from public.questions q join public.question_versions qv on qv.question_id=q.id and qv.status='published'
where q.course_id='20000000-0000-4000-8000-000000000001' and q.pool='battle'
order by q.logical_key limit 1;
insert into auth.users(id,email,raw_user_meta_data)
values(gen_random_uuid(),'correction-outsider@release.test','{"display_name":"Correction outsider"}');

do $$
declare sample record; outsider uuid; result jsonb; checked integer:=0;
begin
 for sample in select b.id battle_id,p.user_id,bq.position,k.explanation from public.battles b join public.battle_participants p on p.battle_id=b.id join public.profiles profile on profile.id=p.user_id and profile.deactivated_at is null join public.battle_questions bq on bq.battle_id=b.id join private.question_answer_keys k on k.question_version_id=bq.question_version_id where b.state in ('finished','voided') and not exists(select 1 from private.pending_registrations pr where pr.user_id=p.user_id) order by b.created_at desc limit 20
 loop
  perform set_config('request.jwt.claim.sub',sample.user_id::text,true);
  result:=public.get_battle_correction_v1(sample.battle_id,sample.position);
  if result->>'explanation' is distinct from sample.explanation or result->>'correct_answer' is null then raise exception 'Correction did not match pinned question version'; end if;
  checked:=checked+1;
 end loop;
 if checked=0 then raise exception 'No finalized fixtures available'; end if;
 begin
  update public.battles set state='active' where id=sample.battle_id;
  perform public.get_battle_correction_v1(sample.battle_id,sample.position);
  raise exception 'Active battle leaked an answer';
 exception when others then if sqlerrm<>'INVALID_STATE' then raise; end if; end;
 select p.id into outsider from public.profiles p where p.deactivated_at is null and not exists(select 1 from public.battle_participants bp where bp.battle_id=sample.battle_id and bp.user_id=p.id) and not exists(select 1 from private.pending_registrations pr where pr.user_id=p.id) limit 1;
 if outsider is null then raise exception 'No outsider fixture available'; end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.get_battle_correction_v1(sample.battle_id,sample.position);
  raise exception 'Outsider accessed corrections';
 exception when others then if sqlerrm<>'NOT_FOUND' then raise; end if; end;
 if has_function_privilege('anon','public.get_battle_correction_v1(uuid,integer)','execute') then raise exception 'Anonymous correction access'; end if;
end $$;


select pass('battle-question-corrections assertions completed');
select * from finish();
rollback;
