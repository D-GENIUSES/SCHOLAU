begin;

-- Battle eligibility comes from the current department catalogue, without lesson progress or enrollment prerequisites.
create or replace function private.battle_offerings(p_user_id uuid)
returns setof public.course_offerings
language sql stable security definer set search_path='' as $$
  select o.* from public.profiles p
  join public.course_offerings o on
    (o.university_id,o.department_id,o.level_id,o.semester_id)=
    (p.university_id,p.department_id,p.level_id,p.semester_id)
  join public.courses c on c.id=o.course_id and c.active
  where p.id=p_user_id and p.deactivated_at is null and o.status='published';
$$;
revoke all on function private.battle_offerings(uuid) from public,anon,authenticated;


-- A direct challenge can use any course both learners take, even when they
-- take it through different department offerings.
create or replace function public.get_battle_setup_v1(p_friend_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if p_friend_id is not null and (not private.can_view_public_profile(v_uid,p_friend_id) or p_friend_id=v_uid) then perform private.raise_error('FORBIDDEN','Choose an available opponent.'); end if;
  return private.envelope(jsonb_build_object('courses',coalesce((select jsonb_agg(x order by x.code) from (
    select distinct on (c.id) o.id as offering_id,c.id as course_id,c.code,c.title,private.battle_pool_size(c.id) as available_questions
    from private.battle_offerings(v_uid) o join public.courses c on c.id=o.course_id
    where true
      and (p_friend_id is null or exists(select 1 from private.battle_offerings(p_friend_id) other_o where other_o.course_id=o.course_id))
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
    select * into o from private.battle_offerings(v_uid) where id=v_id;
    if not found then perform private.raise_error('FORBIDDEN','Choose a course available in your department.'); end if;
    if p_friend_id is not null and not exists(select 1 from private.battle_offerings(p_friend_id) other_o where other_o.course_id=o.course_id) then
      perform private.raise_error('FORBIDDEN','Choose courses available in both departments.');
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
  if b.invited_user_id is not null and b.invited_user_id<>v_uid then
    perform private.raise_error('FORBIDDEN','This invitation is reserved for its invited learner.');
  end if;
  if exists(
    select 1 from public.battle_courses bc join public.course_offerings challenged on challenged.id=bc.offering_id
    where bc.battle_id=b.id and not exists(
      select 1 from private.battle_offerings(v_uid) learner where learner.course_id=challenged.course_id
    )
  ) then perform private.raise_error('FORBIDDEN','The selected courses must be available in your department.'); end if;
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

create or replace function private.push_relevant(n public.notifications) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if n.context ? 'course_id' and not exists(select 1 from public.course_offerings o join public.enrollments e on e.offering_id=o.id
   where o.course_id=(n.context->>'course_id')::uuid and o.status='published' and e.user_id=n.user_id and e.ended_at is null) then return false; end if;
 if n.context ? 'battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'battle_id')::uuid and b.invited_user_id=n.user_id and b.state='waiting' and b.invitation_expires_at>now() and private.can_view_public_profile(n.user_id,b.created_by)) then return false; end if;
 if n.context ? 'accepted_battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'accepted_battle_id')::uuid and b.created_by=n.user_id and b.state='ready' and b.ready_deadline>now()) then return false; end if;
 if n.context ? 'friend_low' and not exists(select 1 from public.friendships f where f.user_low=(n.context->>'friend_low')::uuid and f.user_high=(n.context->>'friend_high')::uuid and f.state=n.context->>'friend_state') then return false; end if;
 if n.context ? 'admin_only' and not exists(select 1 from public.user_roles where user_id=n.user_id and role='admin') then return false; end if;
 if n.context ? 'assignment_id' and not exists(select 1 from public.lecturer_course_assignments where user_id=n.user_id and offering_id=(n.context->>'assignment_id')::uuid) then return false; end if;
 if n.context ? 'lesson_id' and not exists(select 1 from public.lessons l join public.lesson_versions v on v.lesson_id=l.id and v.status='published' join public.course_offerings o on o.course_id=l.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where l.id=(n.context->>'lesson_id')::uuid and e.user_id=n.user_id) then return false; end if;
 if n.context ? 'assessment_id' and not exists(select 1 from public.assessments a join public.assessment_versions v on v.assessment_id=a.id and v.status='published' join public.course_offerings o on o.course_id=a.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where a.id=(n.context->>'assessment_id')::uuid and e.user_id=n.user_id) then return false; end if;
 if n.context->>'audience'='offering' and not exists(select 1 from public.enrollments where user_id=n.user_id and offering_id=(n.context->>'audience_id')::uuid and ended_at is null) then return false; end if;
 if n.context->>'audience'='role' and not exists(select 1 from public.user_roles where user_id=n.user_id and role=n.context->>'audience_id') then return false; end if;
 if n.kind='study_reminder' and ((now() at time zone coalesce((select timezone from private.notification_preferences where user_id=n.user_id),'Africa/Lagos'))::date::text is distinct from n.context->>'date'
 or exists(select 1 from public.activity_events e where e.user_id=n.user_id and (e.created_at at time zone (select timezone from private.notification_preferences where user_id=n.user_id))::date=(n.context->>'date')::date)) then return false; end if;
 return true;
end $$;

-- Time-sensitive challenges must not wait behind the course-update cooldown.
create or replace function public.authorize_push_job_v1(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.push_jobs; n public.notifications; t public.push_tokens; p private.notification_preferences; next_at timestamptz; gate private.push_delivery_windows;
begin
 select * into j from private.push_jobs where id=p_id and lease=p_lease and state='sending' and lease_until>now() for update;
 if not found then return null; end if;
 select * into n from public.notifications where id=j.notification_id;
 select * into t from public.push_tokens where id=j.token_id;
 insert into private.notification_preferences(user_id) values(j.user_id) on conflict do nothing;
 select * into p from private.notification_preferences where user_id=j.user_id;
 if not private.push_allowed(j.user_id) then
   update private.push_jobs set state='pending',available_at=now()+interval '1 minute',lease=null,lease_until=null,attempts=greatest(attempts-1,0),updated_at=now() where id=j.id; return null;
 end if;
 if n.expires_at<=now() then update private.push_jobs set state='expired',updated_at=now() where id=j.id; return null; end if;
 if n.read_at is not null or t.revoked_at is not null or t.consented_at>n.created_at or not private.valid_push_subscription(t.delivery_config)
 or not exists(select 1 from public.profiles where id=j.user_id and deactivated_at is null)
 or not coalesce((to_jsonb(p)->>n.category)::boolean,false) or not private.push_relevant(n) then
   update private.push_jobs set state='skipped',updated_at=now(),last_code='no_longer_eligible' where id=j.id; return null;
 end if;
 -- A per-token row serializes reservations across concurrent worker invocations.
 insert into private.push_delivery_windows(token_id) values(j.token_id) on conflict do nothing;
 select * into gate from private.push_delivery_windows where token_id=j.token_id for update;
 next_at:=private.push_next_time(greatest(now(),case when n.kind in ('battle_invitation','battle_accepted') or gate.job_id=j.id then now() else gate.next_at end,
   case when n.kind='course_content' then n.created_at+interval '5 minutes' else now() end),p.timezone,p.quiet_start,p.quiet_end);
 if next_at>now() then
   update private.push_jobs set state=case when next_at>=n.expires_at then 'expired' else 'pending' end,available_at=next_at,lease=null,lease_until=null,attempts=greatest(attempts-1,0),updated_at=now() where id=j.id; return null;
 end if;
 update private.push_delivery_windows set next_at=now()+interval '30 minutes',job_id=j.id where token_id=j.token_id and n.kind not in ('battle_invitation','battle_accepted');
 return jsonb_build_object('subscription',t.delivery_config,'attempts',j.attempts,'expires_at',n.expires_at,
 'payload',jsonb_build_object('id',n.id,'kind',n.kind,'title',n.title,'body',n.body,'target',coalesce(n.safe_target,'/notification-settings'),'expires_at',n.expires_at,'device_key',t.device_key));
end $$;


commit;
