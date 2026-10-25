-- A participant's forfeit immediately finishes a matched battle with the opponent as winner.
-- Preserve the existing no-XP policy for early forfeits and all prior terminal results.
create or replace function private.finish_battle_forfeit(p_battle_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.battles; opponent uuid; r record;
begin
 select * into b from public.battles where id=p_battle_id for update;
 if not found or b.state in ('finished','cancelled','voided') then return; end if;
 if not exists(select 1 from public.battle_participants where battle_id=p_battle_id and user_id=p_user_id) then
   perform private.raise_error('FORBIDDEN');
 end if;
 select user_id into opponent from public.battle_participants where battle_id=p_battle_id and user_id<>p_user_id;
 if opponent is null then
   perform private.cancel_battle(p_battle_id,'pre_start_cancel','cancelled');
   return;
 end if;
 update public.battle_participants set forfeited_at=coalesce(forfeited_at,now()) where battle_id=p_battle_id and user_id=p_user_id;
 -- Answers are already graded at submission, including text answers. Keep only on-time scores.
 update public.battle_participants bp set correct_count=(
   select count(*) from public.battle_answers a join public.battle_questions q on q.battle_id=a.battle_id and q.position=a.position
   where a.battle_id=bp.battle_id and a.user_id=bp.user_id and a.is_correct and a.received_at>=q.opened_at and a.received_at<q.deadline
 ) where bp.battle_id=p_battle_id;
 update public.battles set state='finished',result_kind='forfeit',winner_user_id=opponent,
   cancel_reason=null,finalized_at=now(),revision=revision+1,
   starts_at=coalesce(starts_at,now()),ends_at=coalesce(ends_at,now()+interval '1 millisecond')
 where id=p_battle_id;
 for r in select user_id from public.battle_participants where battle_id=p_battle_id order by user_id loop
   insert into public.notifications(user_id,kind,body,safe_target,event_key)
   values(r.user_id,'battle_finished',case when r.user_id=opponent then 'You won! Your opponent forfeited.' else 'You forfeited. Your opponent won.' end,
     '/battles/'||p_battle_id::text,'battle_finished:'||p_battle_id::text||':'||r.user_id::text)
   on conflict(event_key) do nothing;
 end loop;
 delete from private.battle_slots where battle_id=p_battle_id;
 delete from private.battle_invites where battle_id=p_battle_id;
 perform private.battle_event(p_battle_id);
end $$;
revoke all on function private.finish_battle_forfeit(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.forfeit_battle_v1(p_battle_id uuid,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); b public.battles;
begin
 perform private.assert_client_supported();
 perform private.require_request_key(p_request_key);
 b:=private.lock_participant_battle(viewer,p_battle_id);
 perform private.advance_battle(p_battle_id);
 perform private.finish_battle_forfeit(p_battle_id,viewer);
 return private.envelope(private.battle_payload(p_battle_id,viewer),p_request_key);
end $$;

-- Automatic fair-play forfeits use the same terminal result and live update.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.report_battle_integrity_v1(uuid,uuid,text)'::regprocedure);
 if position('perform private.cancel_battle(p_battle_id,''early_forfeit'',''forfeit'');' in definition)=0 then
   raise exception 'Integrity forfeit marker missing';
 end if;
 definition:=replace(definition,'perform private.cancel_battle(p_battle_id,''early_forfeit'',''forfeit'');','perform private.finish_battle_forfeit(p_battle_id,v_uid);');
 execute definition;
end $$;

-- A finished early match must not expose questions/corrections that never appeared.
do $$ declare definition text; marker text:='where bq.battle_id = b.id), ''[]''::jsonb) end,'; begin
 definition:=pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Battle rounds payload marker missing'; end if;
 definition:=replace(definition,marker,'where bq.battle_id = b.id and (b.result_kind is distinct from ''forfeit'' or coalesce(bq.reading_at,bq.opened_at)<=b.finalized_at)), ''[]''::jsonb) end,');
 execute definition;
 definition:=pg_get_functiondef('public.get_battle_correction_v1(uuid,integer)'::regprocedure);
 marker:='where bq.battle_id=p_battle_id and bq.position=p_position;';
 if position(marker in definition)=0 then raise exception 'Battle correction marker missing'; end if;
 definition:=replace(definition,marker,'where bq.battle_id=p_battle_id and bq.position=p_position and exists(select 1 from public.battles b where b.id=bq.battle_id and (b.result_kind is distinct from ''forfeit'' or coalesce(bq.reading_at,bq.opened_at)<=b.finalized_at));');
 execute definition;
end $$;
