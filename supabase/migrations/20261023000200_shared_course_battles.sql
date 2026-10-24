begin;

-- A direct challenge can use any course both learners take, even when they
-- take it through different department offerings.
create or replace function public.get_battle_setup_v1(p_friend_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if p_friend_id is not null and (not private.can_view_public_profile(v_uid,p_friend_id) or p_friend_id=v_uid) then perform private.raise_error('FORBIDDEN','Choose an available opponent.'); end if;
  return private.envelope(jsonb_build_object('courses',coalesce((select jsonb_agg(x order by x.code) from (
    select distinct on (c.id) o.id as offering_id,c.id as course_id,c.code,c.title,private.battle_pool_size(c.id) as available_questions
    from public.enrollments e join public.course_offerings o on o.id=e.offering_id join public.courses c on c.id=o.course_id
    where e.user_id=v_uid and e.ended_at is null and o.status='published'
      and (p_friend_id is null or exists(select 1 from public.enrollments other join public.course_offerings other_o on other_o.id=other.offering_id
        where other.user_id=p_friend_id and other.ended_at is null and other_o.course_id=o.course_id and other_o.status='published'))
    order by c.id,o.id
  )x),'[]'::jsonb)));
end;
$$;

create or replace function public.create_scoped_battle_v1(p_offering_ids uuid[],p_question_count integer,p_request_key uuid,p_friend_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); b public.battles; r public.battle_rules; o public.course_offerings;
  v_id uuid; v_i integer:=0; v_need integer; v_n integer:=cardinality(p_offering_ids); v_token text;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,1));
  select * into b from public.battles where created_by=v_uid and request_key=p_request_key;
  if found then return private.envelope(private.battle_payload(b.id,v_uid),p_request_key); end if;
  if v_n is null or v_n not between 1 and 3 or p_question_count is null or p_question_count not between 5 and 30
    or (select count(distinct x) from unnest(p_offering_ids)x)<>v_n then
    perform private.raise_error('VALIDATION_FAILED','Choose 1–3 courses and 5–30 questions.');
  end if;
  if p_friend_id is not null and (not private.can_view_public_profile(v_uid,p_friend_id) or p_friend_id=v_uid) then perform private.raise_error('FORBIDDEN','This opponent is unavailable.'); end if;
  r:=private.active_battle_rules();
  if r.id is null then perform private.raise_error('CONTENT_UNAVAILABLE','Battles are not configured.'); end if;
  foreach v_id in array p_offering_ids loop
    v_i:=v_i+1;
    o:=private.require_offering_enrollment(v_uid,v_id);
    if p_friend_id is not null and not exists(select 1 from public.enrollments e join public.course_offerings other_o on other_o.id=e.offering_id
      where e.user_id=p_friend_id and e.ended_at is null and other_o.status='published' and other_o.course_id=o.course_id) then
      perform private.raise_error('FORBIDDEN','Both students must be enrolled in every selected course.');
    end if;
    if exists(select 1 from unnest(p_offering_ids) x join public.course_offerings other on other.id=x where other.course_id=o.course_id and other.id<>v_id) then
      perform private.raise_error('VALIDATION_FAILED','Select each course once.');
    end if;
    v_need:=p_question_count/v_n+case when v_i<=p_question_count%v_n then 1 else 0 end;
    if private.battle_pool_size(o.course_id)<v_need then
      perform private.raise_error('CONTENT_UNAVAILABLE','Not enough published questions for this course selection.');
    end if;
  end loop;
  if (select count(*) from public.battles where created_by=v_uid and created_at>now()-interval '10 minutes')>=20 then perform private.raise_error('RATE_LIMITED'); end if;
  insert into public.battles(offering_id,rules_id,mode,state,created_by,request_key,invitation_expires_at,round_count,seconds_per_round,invited_user_id)
    values(p_offering_ids[1],r.id,'direct','waiting',v_uid,p_request_key,now()+make_interval(secs=>r.invite_seconds),p_question_count,10,p_friend_id) returning * into b;
  insert into public.battle_courses select b.id,x.id,x.n from unnest(p_offering_ids) with ordinality x(id,n) where x.n>1;
  insert into public.battle_participants(battle_id,user_id,seat) values(b.id,v_uid,1);
  perform private.claim_slot(v_uid,null,b.id,b.invitation_expires_at);
  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  insert into private.battle_invites(battle_id,token) values(b.id,v_token);
  if p_friend_id is not null then
    insert into public.notifications(user_id,kind,body,safe_target,event_key)
      values(p_friend_id,'battle_invitation',(select display_name from public.profiles where id=v_uid)||' has challenged you to a battle.','/battles','battle_invited:'||b.id::text);
    perform private.enqueue_event('user:'||p_friend_id::text,'battle_invitation',jsonb_build_object('battle_id',b.id),'battle_invited:'||b.id::text);
  end if;
  perform private.battle_event(b.id);
  return private.envelope(private.battle_payload(b.id,v_uid),p_request_key);
end;
$$;

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
