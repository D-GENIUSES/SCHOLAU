begin;

-- Acceptance is based on the shared course, not the sender's department offer.
create or replace function public.accept_battle_v1(p_invite_token text, p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=private.require_user(); v_battle_id uuid; b public.battles;
  v_rules public.battle_rules; v_creator uuid;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select battle_id into v_battle_id from private.battle_invites where token=p_invite_token;
  if v_battle_id is null then perform private.raise_error('QUEUE_EXPIRED','This invitation is invalid or has expired.'); end if;
  select * into b from public.battles where id=v_battle_id for update;
  if exists(select 1 from public.battle_participants where battle_id=b.id and user_id=v_uid) then
    if b.created_by=v_uid then perform private.raise_error('FORBIDDEN','You cannot accept your own invitation.'); end if;
    return private.envelope(private.battle_payload(b.id,v_uid),p_request_key);
  end if;
  perform private.advance_battle(b.id);
  select * into b from public.battles where id=v_battle_id;
  if b.state='cancelled' then perform private.raise_error('QUEUE_EXPIRED','This invitation has expired.'); end if;
  if b.state<>'waiting' or (select count(*) from public.battle_participants where battle_id=b.id)>=2 then perform private.raise_error('BATTLE_FULL'); end if;
  if exists(select 1 from public.friendships where user_low=least(v_uid,b.created_by) and user_high=greatest(v_uid,b.created_by) and state='blocked') then
    perform private.raise_error('FORBIDDEN','This invitation is unavailable.');
  end if;
  if b.invited_user_id is not null and (b.invited_user_id<>v_uid or not private.are_friends(v_uid,b.created_by)) then
    perform private.raise_error('FORBIDDEN','This invitation is reserved for its invited learner.');
  end if;
  if exists(
    select 1 from public.battle_courses bc join public.course_offerings challenged on challenged.id=bc.offering_id
    where bc.battle_id=b.id and not exists(
      select 1 from public.enrollments e join public.course_offerings learner on learner.id=e.offering_id
      where e.user_id=v_uid and e.ended_at is null and learner.status='published' and learner.course_id=challenged.course_id
    )
  ) then perform private.raise_error('NOT_ENROLLED','You need access to every selected course to accept.'); end if;
  select * into v_rules from public.battle_rules where id=b.rules_id;
  perform private.claim_slot(v_uid,null,b.id,now()+make_interval(secs=>v_rules.ready_seconds)+interval '10 minutes');
  insert into public.battle_participants(battle_id,user_id,seat) values(b.id,v_uid,2);
  update public.battles set state='ready',ready_deadline=now()+make_interval(secs=>v_rules.ready_seconds),revision=revision+1
    where id=b.id returning * into b;
  update private.battle_slots set expires_at=b.ready_deadline+interval '10 minutes' where battle_id=b.id;
  v_creator:=b.created_by;
  insert into public.notifications(user_id,kind,body,safe_target,event_key)
    values(v_creator,'battle_accepted','Your challenge was accepted. Get ready!','/battles/'||b.id::text,'battle_accepted:'||b.id)
    on conflict(event_key) do nothing;
  perform private.battle_event(b.id);
  return private.envelope(private.battle_payload(b.id,v_uid),p_request_key);
end;
$$;

revoke all on function public.accept_battle_v1(text,uuid) from public,anon;
grant execute on function public.accept_battle_v1(text,uuid) to authenticated,service_role;


commit;
