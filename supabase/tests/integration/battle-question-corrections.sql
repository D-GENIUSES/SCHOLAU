-- Read-only checks against finalized matches; temporary active-state check rolls back.
begin;
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

rollback;