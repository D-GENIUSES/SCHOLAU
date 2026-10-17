-- Friends, targeted multi-course invitations and per-question timing.
create table public.friend_handles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_]{2,33}$')
);
create table public.friendships (
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  state text not null check (state in ('pending','accepted','blocked')),
  updated_at timestamptz not null default now(),
  primary key(user_low,user_high),
  check(user_low < user_high),
  check(actor_id in (user_low,user_high))
);
create index friendships_high on public.friendships(user_high,state);
alter table public.friend_handles enable row level security;
alter table public.friendships enable row level security;
revoke all on public.friend_handles,public.friendships from anon,authenticated;
grant all on public.friend_handles,public.friendships to service_role;

create function private.are_friends(p_a uuid,p_b uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.friendships where user_low=least(p_a,p_b) and user_high=greatest(p_a,p_b) and state='accepted')
$$;

create function public.get_friends_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  insert into public.friend_handles(user_id,username) values(v_uid,'s_'||replace(v_uid::text,'-','')) on conflict(user_id) do nothing;
  return private.envelope(jsonb_build_object(
    'username',(select username from public.friend_handles where user_id=v_uid),
    'people',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.id,'display_name',p.display_name,'username',h.username,
      'state',f.state,'incoming',f.actor_id<>v_uid
    ) order by f.updated_at desc)
    from public.friendships f join public.profiles p on p.id=case when f.user_low=v_uid then f.user_high else f.user_low end
    left join public.friend_handles h on h.user_id=p.id
    where v_uid in(f.user_low,f.user_high) and p.deactivated_at is null
      and (f.state<>'blocked' or f.actor_id=v_uid)),'[]'::jsonb)));
end;
$$;

create function public.set_friend_username_v1(p_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); v_name text:=lower(btrim(p_username));
begin
  if v_name is null or v_name !~ '^[a-z][a-z0-9_]{2,23}$' then
    perform private.raise_error('VALIDATION_FAILED','Use 3–24 characters: letters, numbers and underscores, starting with a letter.');
  end if;
  insert into public.friend_handles values(v_uid,v_name) on conflict(user_id) do update set username=excluded.username;
  return public.get_friends_v1();
exception when unique_violation then
  perform private.raise_error('VALIDATION_FAILED','That username is already taken.');
end;
$$;

create function public.search_friends_v1(p_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); v_query text:=lower(btrim(p_query));
begin
  if length(coalesce(v_query,''))<3 or length(v_query)>60 then
    return private.envelope(jsonb_build_object('people','[]'::jsonb));
  end if;
  return private.envelope(jsonb_build_object('people',coalesce((select jsonb_agg(x) from (
    select p.id as user_id,p.display_name,h.username,f.state,coalesce(f.actor_id<>v_uid,false) as incoming
    from public.profiles p join public.friend_handles h on h.user_id=p.id
    left join public.friendships f on f.user_low=least(v_uid,p.id) and f.user_high=greatest(v_uid,p.id)
    where p.id<>v_uid and p.deactivated_at is null and (f.state is null or f.state<>'blocked')
    and (strpos(lower(p.display_name),v_query)>0 or strpos(h.username,v_query)>0)
    order by h.username limit 20
  ) x),'[]'::jsonb)));
end;
$$;

create function public.friend_action_v1(p_user_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); f public.friendships; v_event uuid:=gen_random_uuid();
begin
  if p_user_id is null or p_user_id=v_uid or not exists(select 1 from public.profiles where id=p_user_id and deactivated_at is null) then
    perform private.raise_error('VALIDATION_FAILED','Choose an available user.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_uid,p_user_id)::text||greatest(v_uid,p_user_id)::text,0));
  select * into f from public.friendships where user_low=least(v_uid,p_user_id) and user_high=greatest(v_uid,p_user_id) for update;
  if p_action='request' then
    if f.state='blocked' then perform private.raise_error('FORBIDDEN','This request is unavailable.'); end if;
    if f.state is null then
      if (select count(*) from public.friendships where actor_id=v_uid and state='pending')>=30 then
        perform private.raise_error('RATE_LIMITED','You have too many pending requests.');
      end if;
      insert into public.friendships values(least(v_uid,p_user_id),greatest(v_uid,p_user_id),v_uid,'pending',now());
    end if;
  elsif p_action='accept' then
    if f.state='accepted' then return public.get_friends_v1(); end if;
    if f.state is distinct from 'pending' or f.actor_id=v_uid then perform private.raise_error('FORBIDDEN'); end if;
    update public.friendships set state='accepted',updated_at=now() where user_low=f.user_low and user_high=f.user_high;
  elsif p_action in('decline','cancel','remove','unblock') then
    if f.state is not null then
      if not ((p_action='decline' and f.state='pending' and f.actor_id<>v_uid)
        or (p_action='cancel' and f.state='pending' and f.actor_id=v_uid)
        or (p_action='remove' and f.state='accepted')
        or (p_action='unblock' and f.state='blocked' and f.actor_id=v_uid)) then perform private.raise_error('FORBIDDEN'); end if;
      delete from public.friendships where user_low=f.user_low and user_high=f.user_high;
    end if;
  elsif p_action='block' then
    if f.state='blocked' and f.actor_id<>v_uid then perform private.raise_error('FORBIDDEN'); end if;
    insert into public.friendships values(least(v_uid,p_user_id),greatest(v_uid,p_user_id),v_uid,'blocked',now())
      on conflict(user_low,user_high) do update set actor_id=v_uid,state='blocked',updated_at=now();
  else perform private.raise_error('VALIDATION_FAILED','Unknown friend action.');
  end if;
  perform private.enqueue_event('user:'||v_uid::text,'friends_changed','{}'::jsonb,'friends:'||v_event::text||':a');
  perform private.enqueue_event('user:'||p_user_id::text,'friends_changed','{}'::jsonb,'friends:'||v_event::text||':b');
  return public.get_friends_v1();
end;
$$;

-- Existing accounts are discoverable by a generated handle until they choose their own.
insert into public.friend_handles select id,'s_'||replace(id::text,'-','') from public.profiles;
create function private.create_friend_handle() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.friend_handles values(new.id,'s_'||replace(new.id::text,'-','')) on conflict do nothing;
  return new;
end;
$$;
create trigger profile_friend_handle after insert on public.profiles for each row execute function private.create_friend_handle();

alter table public.question_versions add column answer_format text not null default 'standard' check(answer_format in('standard','worked_solution'));
alter table public.question_versions add column battle_seconds smallint check(battle_seconds in(10,12,15));
alter table public.question_options add column steps text[] not null default '{}';
alter table public.battles add column invited_user_id uuid references public.profiles(id) on delete set null;
create index battle_invitations_recipient on public.battles(invited_user_id,invitation_expires_at) where state='waiting';
create table public.battle_courses (
  battle_id uuid not null references public.battles(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id),
  position integer not null check(position between 1 and 3),
  primary key(battle_id,offering_id),unique(battle_id,position)
);
alter table public.battle_courses enable row level security;
revoke all on public.battle_courses from anon,authenticated;
grant select on public.battle_courses to authenticated;
grant all on public.battle_courses to service_role;
create policy battle_courses_participants on public.battle_courses for select to authenticated using(exists(
  select 1 from public.battle_participants bp where bp.battle_id=battle_courses.battle_id and bp.user_id=auth.uid()
));
insert into public.battle_courses select id,offering_id,1 from public.battles;
create function private.default_battle_course() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.battle_courses values(new.id,new.offering_id,1); return new; end;
$$;
create trigger battle_default_course after insert on public.battles for each row execute function private.default_battle_course();

create function private.battle_question_seconds(p_version_id uuid) returns integer
language sql stable set search_path='' as $$
  select coalesce(qv.battle_seconds,case
    when length(qv.prompt)+coalesce((select sum(length(o.body)+length(array_to_string(o.steps,' '))) from public.question_options o where o.question_version_id=qv.id),0)>360 then 15
    when qv.answer_format='worked_solution' or length(qv.prompt)+coalesce((select sum(length(o.body)) from public.question_options o where o.question_version_id=qv.id),0)>180 then 12
    else 10 end)::integer
  from public.question_versions qv where qv.id=p_version_id
$$;

create function public.get_battle_setup_v1(p_friend_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if p_friend_id is not null and not private.are_friends(v_uid,p_friend_id) then perform private.raise_error('FORBIDDEN','Choose a friend first.'); end if;
  return private.envelope(jsonb_build_object('courses',coalesce((select jsonb_agg(x order by x.code) from (
    select o.id as offering_id,c.id as course_id,c.code,c.title,private.battle_pool_size(c.id) as available_questions
    from public.enrollments e join public.course_offerings o on o.id=e.offering_id join public.courses c on c.id=o.course_id
    where e.user_id=v_uid and e.ended_at is null and o.status='published'
      and (p_friend_id is null or exists(select 1 from public.enrollments other where other.user_id=p_friend_id and other.offering_id=o.id and other.ended_at is null))
  )x),'[]'::jsonb)));
end;
$$;

create function public.create_scoped_battle_v1(p_offering_ids uuid[],p_question_count integer,p_request_key uuid,p_friend_id uuid default null) returns jsonb
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
  if p_friend_id is not null and not private.are_friends(v_uid,p_friend_id) then perform private.raise_error('FORBIDDEN','You can invite accepted friends.'); end if;
  r:=private.active_battle_rules();
  if r.id is null then perform private.raise_error('CONTENT_UNAVAILABLE','Battles are not configured.'); end if;
  foreach v_id in array p_offering_ids loop
    v_i:=v_i+1;
    o:=private.require_offering_enrollment(v_uid,v_id);
    if p_friend_id is not null then perform private.require_offering_enrollment(p_friend_id,v_id); end if;
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
      values(p_friend_id,'battle_invitation','A friend invited you to a battle. Review the courses and accept in Battles.','/battles','battle_invited:'||b.id::text);
    perform private.enqueue_event('user:'||p_friend_id::text,'battle_invitation',jsonb_build_object('battle_id',b.id),'battle_invited:'||b.id::text);
  end if;
  perform private.battle_event(b.id);
  return private.envelope(private.battle_payload(b.id,v_uid),p_request_key);
end;
$$;

create function public.get_battle_invitations_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  return private.envelope(jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object(
    'battle_id',b.id,'invite_token',i.token,'display_name',p.display_name,'round_count',b.round_count,
    'expires_at',b.invitation_expires_at,'courses',(select jsonb_agg(c.code order by bc.position) from public.battle_courses bc join public.course_offerings o on o.id=bc.offering_id join public.courses c on c.id=o.course_id where bc.battle_id=b.id)
  ) order by b.created_at desc) from public.battles b join public.profiles p on p.id=b.created_by join private.battle_invites i on i.battle_id=b.id
  where b.invited_user_id=v_uid and b.state='waiting' and b.invitation_expires_at>now() and private.are_friends(v_uid,b.created_by)),'[]'::jsonb)));
end;
$$;

create function public.decline_battle_invitation_v1(p_battle_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); b public.battles;
begin
  select * into b from public.battles where id=p_battle_id for update;
  if b.invited_user_id is distinct from v_uid then perform private.raise_error('FORBIDDEN'); end if;
  if b.state='waiting' then perform private.cancel_battle(b.id,'pre_start_cancel'); end if;
  return private.envelope(jsonb_build_object('declined',true));
end;
$$;

create function public.get_battle_invite_preview_v1(p_invite_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); b public.battles;
begin
  select battle.* into b from public.battles battle join private.battle_invites i on i.battle_id=battle.id where i.token=p_invite_token;
  if b.id is null or b.state<>'waiting' or b.invitation_expires_at<=now() then perform private.raise_error('QUEUE_EXPIRED','This invitation has expired.'); end if;
  if (b.invited_user_id is not null and (b.invited_user_id<>v_uid or not private.are_friends(v_uid,b.created_by)))
    or exists(select 1 from public.friendships where user_low=least(v_uid,b.created_by) and user_high=greatest(v_uid,b.created_by) and state='blocked') then
    perform private.raise_error('FORBIDDEN','This invitation is unavailable.');
  end if;
  return private.envelope(jsonb_build_object('round_count',b.round_count,
    'courses',(select jsonb_agg(c.code order by bc.position) from public.battle_courses bc join public.course_offerings o on o.id=bc.offering_id join public.courses c on c.id=o.course_id where bc.battle_id=b.id)));
end;
$$;

-- New public functions do not inherit PUBLIC execute privileges.
revoke all on function public.get_friends_v1(),public.set_friend_username_v1(text),public.search_friends_v1(text),public.friend_action_v1(uuid,text),public.get_battle_setup_v1(uuid),public.create_scoped_battle_v1(uuid[],integer,uuid,uuid),public.get_battle_invitations_v1(),public.decline_battle_invitation_v1(uuid) from public,anon;
grant execute on function public.get_friends_v1(),public.set_friend_username_v1(text),public.search_friends_v1(text),public.friend_action_v1(uuid,text),public.get_battle_setup_v1(uuid),public.create_scoped_battle_v1(uuid[],integer,uuid,uuid),public.get_battle_invitations_v1(),public.decline_battle_invitation_v1(uuid) to authenticated,service_role;
revoke all on function public.get_battle_invite_preview_v1(text) from public,anon;
grant execute on function public.get_battle_invite_preview_v1(text) to authenticated,service_role;
revoke all on function private.are_friends(uuid,uuid),private.create_friend_handle(),private.default_battle_course(),private.battle_question_seconds(uuid) from public,anon,authenticated;

create or replace function private.schedule_battle(p_battle_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare b public.battles; r public.battle_rules; v_start timestamptz; v_count integer; v_short boolean;
begin
  select * into b from public.battles where id=p_battle_id for update;
  select * into r from public.battle_rules where id=b.rules_id;
  v_start:=now()+make_interval(secs=>r.countdown_seconds);
  -- Recheck each balanced allocation when players are ready; no silent course substitution.
  select exists(select 1 from public.battle_courses bc join public.course_offerings o on o.id=bc.offering_id
    where bc.battle_id=b.id and private.battle_pool_size(o.course_id)<
      b.round_count/(select count(*) from public.battle_courses where battle_id=b.id)
      +case when bc.position<=b.round_count%(select count(*) from public.battle_courses where battle_id=b.id) then 1 else 0 end
  ) into v_short;
  if v_short then perform private.cancel_battle(b.id,'content_unavailable'); return false; end if;
  with scope as (
    select o.course_id,bc.position,b.round_count/count(*) over()::integer+
      case when bc.position<=b.round_count%count(*) over()::integer then 1 else 0 end as needed
    from public.battle_courses bc join public.course_offerings o on o.id=bc.offering_id where bc.battle_id=b.id
  ), picked as (
    select qv.id,private.battle_question_seconds(qv.id) as seconds
    from scope s cross join lateral (
      select v.id from public.questions q join public.question_versions v on v.question_id=q.id
      where q.course_id=s.course_id and q.pool='battle' and v.status='published' and 'battle'=any(v.usage)
        and (select count(*) from public.question_options opt where opt.question_version_id=v.id)=4
      order by random() limit s.needed
    ) qv
  ), shuffled as (
    select *,row_number() over(order by random())::integer as position from picked
  ), timed as (
    select *,coalesce(sum(seconds) over(order by position rows between unbounded preceding and 1 preceding),0)::integer as offset_seconds from shuffled
  )
  insert into public.battle_questions(battle_id,position,question_version_id,opened_at,deadline,option_order)
  select b.id,t.position,t.id,v_start+make_interval(secs=>t.offset_seconds),v_start+make_interval(secs=>t.offset_seconds+t.seconds),
    (select array_agg(opt.id order by random()) from public.question_options opt where opt.question_version_id=t.id)
  from timed t;
  get diagnostics v_count=row_count;
  if v_count<>b.round_count then
    delete from public.battle_questions where battle_id=b.id;
    perform private.cancel_battle(b.id,'content_unavailable'); return false;
  end if;
  update public.battles set state='countdown',starts_at=v_start,
    ends_at=(select max(deadline) from public.battle_questions where battle_id=b.id),revision=revision+1
    where id=b.id returning * into b;
  update public.battle_participants set activated_at=now() where battle_id=b.id;
  update private.battle_slots set expires_at=b.ends_at+interval '10 minutes' where battle_id=b.id;
  perform private.battle_event(b.id);
  return true;
end;
$$;

-- Pools must be usable with the four-option battle renderer, including legacy content.
create or replace function private.battle_pool_size(p_course_id uuid) returns integer
language sql stable set search_path='' as $$
  select count(*)::integer from public.questions q join public.question_versions v on v.question_id=q.id
  where q.course_id=p_course_id and q.pool='battle' and v.status='published' and 'battle'=any(v.usage)
    and (select count(*) from public.question_options o where o.question_version_id=v.id)=4
$$;

create or replace function private.battle_payload(p_battle_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with b as (select * from public.battles where id = p_battle_id),
  me as (select * from public.battle_participants where battle_id = p_battle_id and user_id = p_user_id),
  cur as (
    select bq.* from public.battle_questions bq, b
    where bq.battle_id = p_battle_id and b.state in ('countdown', 'active')
      and bq.opened_at <= now() and now() < bq.deadline
  )
  select jsonb_build_object(
    'battle_id', b.id,
    'mode', b.mode,
    'state', b.state,
    'revision', b.revision,
    'offering_id', b.offering_id,
    'course', (select jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title)
               from public.course_offerings o join public.courses c on c.id = o.course_id where o.id = b.offering_id),
    'courses', (select jsonb_agg(jsonb_build_object('id',c.id,'code',c.code,'title',c.title) order by bc.position)
      from public.battle_courses bc join public.course_offerings o on o.id=bc.offering_id join public.courses c on c.id=o.course_id where bc.battle_id=b.id),
    'invited_user_id',b.invited_user_id,
    'round_count', b.round_count,
    'seconds_per_round', b.seconds_per_round,
    'invitation_expires_at', b.invitation_expires_at,
    'ready_deadline', b.ready_deadline,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'finalized_at', b.finalized_at,
    'result_kind', b.result_kind,
    'cancel_reason', b.cancel_reason,
    'invite_token', case when b.state = 'waiting' and b.created_by = p_user_id
                         then (select i.token from private.battle_invites i where i.battle_id = b.id) end,
    'me', (select jsonb_build_object('seat', me.seat, 'ready', me.ready_at is not null, 'forfeited', me.forfeited_at is not null)
           from me),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', bp.seat,
        'display_name', p.display_name,
        'avatar_path', p.avatar_path,
        'is_me', bp.user_id = p_user_id,
        'ready', bp.ready_at is not null,
        'forfeited', bp.forfeited_at is not null,
        'correct_count', case when b.state in ('finished', 'voided') then bp.correct_count end
      ) order by bp.seat)
      from public.battle_participants bp join public.profiles p on p.id = bp.user_id
      where bp.battle_id = b.id), '[]'::jsonb),
    'current_question', (
      select jsonb_build_object(
        'position', cur.position,
        'prompt', qv.prompt,
        'answer_format',qv.answer_format,
        'course_code',(select c.code from public.questions q join public.courses c on c.id=q.course_id where q.id=qv.question_id),
        'duration_seconds',extract(epoch from(cur.deadline-cur.opened_at))::integer,
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body,'steps',to_jsonb(o.steps)) order by ord.n)
                    from unnest(cur.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id),
        'opened_at', cur.opened_at,
        'deadline', cur.deadline,
        'my_option_id', (select ba.option_id from public.battle_answers ba
                         where ba.battle_id = b.id and ba.user_id = p_user_id and ba.position = cur.position))
      from cur join public.question_versions qv on qv.id = cur.question_version_id),
    'next_question_at', (select min(bq.opened_at) from public.battle_questions bq
                         where bq.battle_id = b.id and b.state in ('countdown', 'active') and bq.opened_at > now()),
    'my_answered_positions', coalesce((select jsonb_agg(ba.position order by ba.position) from public.battle_answers ba
                                       where ba.battle_id = b.id and ba.user_id = p_user_id), '[]'::jsonb),
    'rounds', case when b.state in ('finished', 'voided') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', bq.position,
        'prompt', qv.prompt,
        'my_option_id', mine.option_id,
        'my_is_correct', coalesce(mine.is_correct, false),
        'opponent_is_correct', coalesce(theirs.is_correct, false)
      ) order by bq.position)
      from public.battle_questions bq
      join public.question_versions qv on qv.id = bq.question_version_id
      left join public.battle_answers mine on mine.battle_id = bq.battle_id and mine.position = bq.position and mine.user_id = p_user_id
      left join public.battle_answers theirs on theirs.battle_id = bq.battle_id and theirs.position = bq.position and theirs.user_id <> p_user_id
      where bq.battle_id = b.id), '[]'::jsonb) end,
    'outcome', case when b.state in ('finished', 'voided') then jsonb_build_object(
      'result', case when b.result_kind = 'draw' then 'draw' when b.winner_user_id = p_user_id then 'win' else 'loss' end,
      'xp_awarded', coalesce((select sum(l.amount) from public.points_ledger l
                              where l.user_id = p_user_id and l.source_id = b.id), 0))
      when b.state = 'cancelled' then jsonb_build_object('result', 'cancelled', 'xp_awarded', 0) end
  )
  from b
$$;
create or replace function public.accept_battle_v1(p_invite_token text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_battle_id uuid;
  b public.battles;
  v_rules public.battle_rules;
  v_creator uuid;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select battle_id into v_battle_id from private.battle_invites where token = p_invite_token;
  if v_battle_id is null then
    perform private.raise_error('QUEUE_EXPIRED', 'This invitation is invalid or has expired.');
  end if;

  select * into b from public.battles where id = v_battle_id for update;
  if exists (select 1 from public.battle_participants where battle_id = b.id and user_id = v_uid) then
    if b.created_by = v_uid then
      perform private.raise_error('FORBIDDEN', 'You cannot accept your own invitation.');
    end if;
    return private.envelope(private.battle_payload(b.id, v_uid), p_request_key);
  end if;

  perform private.advance_battle(b.id);
  select * into b from public.battles where id = v_battle_id;
  if b.state = 'cancelled' then
    perform private.raise_error('QUEUE_EXPIRED', 'This invitation has expired.');
  end if;
  if b.state <> 'waiting' or (select count(*) from public.battle_participants where battle_id = b.id) >= 2 then
    perform private.raise_error('BATTLE_FULL');
  end if;

  if exists(select 1 from public.friendships where user_low=least(v_uid,b.created_by) and user_high=greatest(v_uid,b.created_by) and state='blocked') then
    perform private.raise_error('FORBIDDEN','This invitation is unavailable.');
  end if;
  if b.invited_user_id is not null and (b.invited_user_id<>v_uid or not private.are_friends(v_uid,b.created_by)) then
    perform private.raise_error('FORBIDDEN','This invitation is reserved for its invited friend.');
  end if;
  perform private.require_offering_enrollment(v_uid,bc.offering_id) from public.battle_courses bc where bc.battle_id=b.id;
  select * into v_rules from public.battle_rules where id = b.rules_id;

  perform private.claim_slot(v_uid, null, b.id, now() + make_interval(secs => v_rules.ready_seconds) + interval '10 minutes');
  insert into public.battle_participants (battle_id, user_id, seat) values (b.id, v_uid, 2);

  update public.battles
     set state = 'ready', ready_deadline = now() + make_interval(secs => v_rules.ready_seconds), revision = revision + 1
   where id = b.id
  returning * into b;
  update private.battle_slots set expires_at = b.ready_deadline + interval '10 minutes' where battle_id = b.id;

  select created_by into v_creator from public.battles where id = b.id;
  insert into public.notifications (user_id, kind, body, safe_target, event_key)
  values (v_creator, 'battle_accepted', 'Your challenge was accepted. Get ready!', '/battles/' || b.id::text,
          'battle_accepted:' || b.id::text)
  on conflict (event_key) do nothing;

  perform private.battle_event(b.id);
  return private.envelope(private.battle_payload(b.id, v_uid), p_request_key);
end;
$$;
create or replace function private.publish_question_version(p_version_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.question_versions;
  q public.questions;
  v_options integer;
  v_field jsonb := '{}'::jsonb;
begin
  select * into v from public.question_versions where id = p_version_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Question version not found.');
  end if;
  if v.status = 'published' then
    return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', v.status, 'already_published', true);
  end if;
  if v.status <> 'draft' then
    perform private.raise_error('INVALID_STATE', 'Retired versions cannot be republished; create a new draft.');
  end if;
  if not private.user_is_admin(p_actor_id) then
    perform private.raise_error('FORBIDDEN', 'A reviewer with admin role is required.');
  end if;
  select * into q from public.questions where id = v.question_id;

  select count(*) into v_options from public.question_options where question_version_id = v.id;
  if q.pool='battle' and v_options<>4 then
    v_field:=v_field||jsonb_build_object('options','Battles require exactly four options.');
  end if;
  if q.pool='battle' and v.answer_format='worked_solution' and exists(
    select 1 from public.question_options o where o.question_version_id=v.id and cardinality(o.steps)=0
  ) then v_field:=v_field||jsonb_build_object('steps','Each solution must include its calculation steps.'); end if;
  if v_options < 2 then
    v_field := v_field || jsonb_build_object('options', 'at least two options required');
  end if;
  if not exists (select 1 from private.question_answer_keys k where k.question_version_id = v.id) then
    v_field := v_field || jsonb_build_object('correct_option', 'exactly one answer key required');
  end if;
  if coalesce(length(btrim(v.source_reference)), 0) = 0 then
    v_field := v_field || jsonb_build_object('source_reference', 'required');
  end if;
  if q.pool = 'battle' and v.usage <> array['battle']::text[] then
    v_field := v_field || jsonb_build_object('usage', 'battle-pool questions must have usage [battle] only');
  end if;
  if q.pool = 'learning' and 'battle' = any (v.usage) then
    v_field := v_field || jsonb_build_object('usage', 'learning-pool questions cannot be used in battles');
  end if;
  if q.lesson_id is not null and not exists (select 1 from public.lessons l where l.id = q.lesson_id and l.course_id = q.course_id) then
    v_field := v_field || jsonb_build_object('lesson_id', 'lesson belongs to a different course');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Question version failed publish validation.', v_field);
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.question_versions
     set status = 'retired', retired_at = now(), retired_by = p_actor_id, retired_reason = 'superseded'
   where question_id = v.question_id and status = 'published';
  update public.question_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, p_actor_id), published_at = now()
   where id = p_version_id;
  perform set_config('scholau.allow_publish', 'off', true);
  return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', 'published', 'already_published', false);
end;
$$;
create or replace function public.admin_get_question_v1(p_question_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_result jsonb;
begin
  select jsonb_build_object(
    'question_id', q.id, 'course_id', q.course_id, 'lesson_id', q.lesson_id, 'pool', q.pool, 'logical_key', q.logical_key,
    'question_version_id', qv.id, 'version', qv.version, 'status', qv.status, 'prompt', qv.prompt,
    'difficulty', qv.difficulty, 'usage', to_jsonb(qv.usage), 'source_reference', qv.source_reference,
    'answer_format',qv.answer_format,'battle_seconds',qv.battle_seconds,'reviewed_by', qv.reviewed_by, 'published_at', qv.published_at,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body, 'position', o.position,'steps',to_jsonb(o.steps))
                                          order by o.position), '[]'::jsonb)
                from public.question_options o where o.question_version_id = qv.id),
    'correct_option_id', k.correct_option_id,
    'explanation', k.explanation)
  into v_result
  from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  left join private.question_answer_keys k on k.question_version_id = qv.id
  where qv.id = p_question_version_id;
  if v_result is null then
    perform private.raise_error('NOT_FOUND');
  end if;
  return private.envelope(v_result);
end;
$$;
create or replace function public.admin_import_questions_v1(p_rows jsonb, p_dry_run boolean default true, p_request_key uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row jsonb;
  v_i integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_course uuid;
  v_key text;
  v_pool text;
  v_usage text[];
  v_options jsonb;
  v_correct text;
  v_lesson uuid;
  v_seen text[] := '{}';
  v_question public.questions;
  v_latest public.question_versions;
  v_version_id uuid;
  v_version integer;
  v_opt jsonb;
  v_n integer;
  v_correct_id uuid;
  v_pass integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'rows must be a JSON array.', jsonb_build_object('rows', 'invalid'));
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    perform private.raise_error('VALIDATION_FAILED', 'At most 2000 rows per import.', jsonb_build_object('rows', 'too_many'));
  end if;
  if not coalesce(p_dry_run, true) then
    perform private.require_request_key(p_request_key);
    if exists (select 1 from private.audit_log where actor_id = v_uid and action = 'import_questions' and request_key = p_request_key) then
      return private.envelope((select safe_metadata from private.audit_log
                               where actor_id = v_uid and action = 'import_questions' and request_key = p_request_key), p_request_key);
    end if;
  end if;

  -- pass 1 validates; pass 2 writes (only when not dry run and no errors)
  for v_pass in 1..2 loop
    exit when v_pass = 2 and (coalesce(p_dry_run, true) or jsonb_array_length(v_errors) > 0);
    v_i := 0;
    v_seen := '{}';
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_i := v_i + 1;
      v_course := (select c.id from public.courses c where c.code = v_row ->> 'course_code');
      v_key := btrim(coalesce(v_row ->> 'logical_question_key', ''));
      v_pool := lower(btrim(coalesce(v_row ->> 'pool', '')));
      if jsonb_typeof(v_row -> 'usage') = 'array' then
        v_usage := array(select lower(btrim(x)) from jsonb_array_elements_text(v_row -> 'usage') x where btrim(x) <> '');
      else
        v_usage := array(select lower(btrim(x)) from regexp_split_to_table(coalesce(v_row ->> 'usage', ''), '[|;,]') x where btrim(x) <> '');
      end if;
      if jsonb_typeof(v_row -> 'options') = 'array' then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'label', upper(coalesce(nullif(btrim(o.value ->> 'label'), ''), chr(64 + o.n::integer))),
                 'body', btrim(coalesce(o.value ->> 'body', o.value #>> '{}')), 'steps',coalesce(o.value->'steps','[]'::jsonb)) order by o.n), '[]'::jsonb)
          into v_options
          from jsonb_array_elements(v_row -> 'options') with ordinality as o(value, n);
      else
        select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'body', btrim(v_row ->> x.col)) order by x.label), '[]'::jsonb)
          into v_options
          from (values ('A', 'option_a'), ('B', 'option_b'), ('C', 'option_c'), ('D', 'option_d'), ('E', 'option_e'), ('F', 'option_f')) x(label, col)
          where coalesce(btrim(v_row ->> x.col), '') <> '';
      end if;
      v_correct := upper(btrim(coalesce(v_row ->> 'correct_option', '')));
      begin
        v_lesson := nullif(v_row ->> 'lesson_id', '')::uuid;
      exception when others then
        v_lesson := null;
        if v_pass = 1 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_id', 'message', 'must be a uuid');
        end if;
      end;

      if v_pass = 1 then
        if coalesce(nullif(v_row->>'answer_format',''),'standard') not in ('standard','worked_solution') then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','answer_format','message','Use standard or worked_solution');
        end if;
        if coalesce(v_row->>'battle_seconds','') not in ('','10','12','15') then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','battle_seconds','message','Use 10, 12 or 15 seconds');
        end if;
        if v_pool='battle' and jsonb_array_length(v_options)<>4 then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','options','message','Battles require exactly four options');
        end if;
        for v_opt in select value from jsonb_array_elements(v_options) loop
          if jsonb_typeof(coalesce(v_opt->'steps','[]'::jsonb))<>'array' then
            v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','steps must be an array of short strings');
          else
            if jsonb_array_length(coalesce(v_opt->'steps','[]'::jsonb))>6 or exists(
              select 1 from jsonb_array_elements(coalesce(v_opt->'steps','[]'::jsonb)) s
              where jsonb_typeof(s)<>'string' or length(btrim(s#>>'{}')) not between 1 and 240
            ) then v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','Use at most six nonempty steps of up to 240 characters'); end if;
            if coalesce(v_row->>'answer_format','standard')='worked_solution' and jsonb_array_length(coalesce(v_opt->'steps','[]'::jsonb))=0 then
              v_errors:=v_errors||jsonb_build_object('row',v_i,'field','steps','message','Each worked solution needs calculation steps');
            end if;
          end if;
        end loop;
        if v_course is null then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'course_code', 'message', 'unknown course code');
        end if;
        if v_key = '' or length(v_key) > 120 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'logical_question_key', 'message', 'required (max 120 chars)');
        elsif (coalesce(v_row ->> 'course_code', '') || '/' || v_key) = any (v_seen) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'logical_question_key', 'message', 'duplicate key in this import');
        end if;
        v_seen := v_seen || (coalesce(v_row ->> 'course_code', '') || '/' || v_key);
        if v_pool not in ('learning', 'battle') then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'pool', 'message', 'must be learning or battle');
        end if;
        if cardinality(v_usage) = 0 or not (v_usage <@ array['review', 'practice', 'mock', 'battle']) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'must be review/practice/mock/battle');
        elsif v_pool = 'battle' and v_usage <> array['battle'] then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'battle pool requires usage battle only');
        elsif v_pool = 'learning' and 'battle' = any (v_usage) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'learning pool cannot include battle');
        end if;
        if coalesce(v_row ->> 'difficulty', '') not in ('beginner', 'intermediate', 'advanced') then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'difficulty', 'message', 'must be beginner/intermediate/advanced');
        end if;
        if coalesce(length(btrim(v_row ->> 'prompt')), 0) not between 1 and 2000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'prompt', 'message', 'required (max 2000 chars)');
        end if;
        if jsonb_array_length(v_options) < 2 or jsonb_array_length(v_options) > 6 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'between 2 and 6 options required');
        elsif exists (select 1 from jsonb_array_elements(v_options) o
                      where coalesce(length(o ->> 'body'), 0) not between 1 and 1000 or length(o ->> 'label') > 4) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'option text required (max 1000 chars)');
        elsif (select count(distinct o ->> 'label') from jsonb_array_elements(v_options) o) <> jsonb_array_length(v_options) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'option labels must be unique');
        end if;
        if not exists (select 1 from jsonb_array_elements(v_options) o where o ->> 'label' = v_correct) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'correct_option', 'message', 'must match exactly one option label');
        end if;
        if coalesce(length(btrim(v_row ->> 'explanation')), 0) not between 1 and 4000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'explanation', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row ->> 'source_reference')), 0) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'source_reference', 'message', 'required');
        end if;
        if v_lesson is not null and v_course is not null
           and not exists (select 1 from public.lessons l where l.id = v_lesson and l.course_id = v_course) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_id', 'message', 'lesson not in course');
        end if;
        if v_course is not null and v_key <> '' and exists (
            select 1 from public.questions q where q.course_id = v_course and q.logical_key = v_key and q.pool <> v_pool) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'pool', 'message', 'existing question has a different pool');
        end if;
      else
        insert into public.questions (course_id, lesson_id, pool, logical_key)
        values (v_course, v_lesson, v_pool, v_key)
        on conflict (course_id, logical_key) do update set lesson_id = coalesce(excluded.lesson_id, public.questions.lesson_id)
        returning * into v_question;

        select * into v_latest from public.question_versions
        where question_id = v_question.id order by version desc limit 1 for update;
        if found and v_latest.status = 'draft' then
          v_version_id := v_latest.id;
          v_version := v_latest.version;
          delete from private.question_answer_keys where question_version_id = v_version_id;
          delete from public.question_options where question_version_id = v_version_id;
          update public.question_versions
             set prompt = btrim(v_row ->> 'prompt'), difficulty = v_row ->> 'difficulty', usage = v_usage,
                 source_reference = btrim(v_row ->> 'source_reference'), reviewed_by = null
           where id = v_version_id;
        else
          v_version := coalesce(v_latest.version, 0) + 1;
          insert into public.question_versions (question_id, version, prompt, difficulty, usage, source_reference)
          values (v_question.id, v_version, btrim(v_row ->> 'prompt'), v_row ->> 'difficulty', v_usage,
                  btrim(v_row ->> 'source_reference'))
          returning id into v_version_id;
        end if;

        update public.question_versions set answer_format=coalesce(nullif(v_row->>'answer_format',''),'standard'),
          battle_seconds=nullif(v_row->>'battle_seconds','')::smallint where id=v_version_id;
        v_n := 0;
        v_correct_id := null;
        for v_opt in select value from jsonb_array_elements(v_options) loop
          v_n := v_n + 1;
          if v_opt ->> 'label' = v_correct then
            insert into public.question_options (question_version_id, label, body, position)
            values (v_version_id, v_opt ->> 'label', v_opt ->> 'body', v_n)
            returning id into v_correct_id;
          else
            insert into public.question_options (question_version_id, label, body, position)
            values (v_version_id, v_opt ->> 'label', v_opt ->> 'body', v_n);
          end if;
        end loop;
        update public.question_options o set steps=array(select jsonb_array_elements_text(coalesce(v.value->'steps','[]'::jsonb)))
          from jsonb_array_elements(v_options) v(value) where o.question_version_id=v_version_id and o.label=v.value->>'label';
        insert into private.question_answer_keys (question_version_id, correct_option_id, explanation)
        values (v_version_id, v_correct_id, btrim(v_row ->> 'explanation'));

        v_created := v_created || jsonb_build_object('row', v_i, 'question_id', v_question.id,
                                                     'question_version_id', v_version_id, 'version', v_version);
      end if;
    end loop;
  end loop;

  declare
    v_result jsonb := jsonb_build_object(
      'dry_run', coalesce(p_dry_run, true),
      'valid', jsonb_array_length(v_errors) = 0,
      'row_count', jsonb_array_length(p_rows),
      'error_count', jsonb_array_length(v_errors),
      'errors', v_errors,
      'imported', jsonb_array_length(v_created) > 0,
      'created', v_created);
  begin
    if not coalesce(p_dry_run, true) and jsonb_array_length(v_errors) = 0 then
      perform private.audit(v_uid, 'import_questions', 'question_import', null, p_request_key, null, v_result);
    end if;
    return private.envelope(v_result, p_request_key);
  end;
end;
$$;
