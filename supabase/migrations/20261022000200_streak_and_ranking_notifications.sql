-- Prioritize daily streak reminders and notify real leaderboard position losses.

-- The application defines qualifying streak dates in Africa/Lagos.
-- Two daily opportunities, with the follow-up timed from provider acceptance.
alter table private.notification_preferences alter column reminder_time set default '15:00';
update private.notification_preferences set reminder_time='15:00'
where reminder_time='19:00';

create or replace function private.prepare_streak_reminders(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare p record; v_date date:=private.lagos_date(p_now); v_expiry timestamptz;
  v_first public.notifications; v_accepted timestamptz; v_count integer:=0;
begin
  v_expiry:=((v_date+1)::timestamp at time zone 'Africa/Lagos');
  for p in select pref.* from private.notification_preferences pref
    join public.profiles u on u.id=pref.user_id
    where pref.reminder and u.deactivated_at is null and private.push_allowed(pref.user_id)
      and exists(select 1 from public.push_tokens t where t.user_id=pref.user_id and t.revoked_at is null and t.platform='web')
      and (p_now at time zone pref.timezone)::time>=pref.reminder_time
      and not exists(select 1 from public.activity_events a where a.user_id=pref.user_id and a.local_date=v_date)
      and not exists(select 1 from public.notifications n where n.event_key='study_reminder_followup:'||pref.user_id||':'||v_date)
      and (not exists(select 1 from public.notifications n where n.event_key='study_reminder:'||pref.user_id||':'||v_date)
        or exists(select 1 from public.notifications n join private.push_jobs j on j.notification_id=n.id
          where n.event_key='study_reminder:'||pref.user_id||':'||v_date
            and j.state='accepted' and j.updated_at<=p_now-interval '4 hours'))
    order by pref.user_id limit 200
  loop
    perform pg_advisory_xact_lock(hashtextextended('streak-reminder:'||p.user_id,0));
    select * into v_first from public.notifications
      where event_key='study_reminder:'||p.user_id||':'||v_date;
    if v_first.id is null then
      perform private.notification_event(p.user_id,'study_reminder',
        'Keep your streak going! Complete a lesson or practice today.', '/home',
        'study_reminder:'||p.user_id||':'||v_date,'reminder',
        jsonb_build_object('date',v_date,'stage',1,'priority','high'),v_expiry,'Protect your daily streak');
      v_count:=v_count+1;
    else
      select min(j.updated_at) into v_accepted from private.push_jobs j
        where j.notification_id=v_first.id and j.state='accepted';
      if v_accepted is not null and p_now>=v_accepted+interval '4 hours' then
        perform private.notification_event(p.user_id,'study_reminder',
          'Your streak still needs you. Complete a lesson or practice before today ends.', '/home',
          'study_reminder_followup:'||p.user_id||':'||v_date,'reminder',
          jsonb_build_object('date',v_date,'stage',2,'priority','high'),v_expiry,'There is still time to save your streak');
        v_count:=v_count+1;
      end if;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function private.prepare_streak_reminders(timestamptz) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.prepare_push_batch_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; p record; local_now timestamp; n integer:=0;
begin
 -- Inbox fan-out also runs while push delivery is disabled.
 for r in select * from private.notification_recipients where processed_at is null order by id for update skip locked limit 200 loop
   perform private.notification_event(r.user_id,r.kind,r.body,r.target,r.event_key||':'||r.user_id,r.category,r.context,r.expires_at,r.title);
   update private.notification_recipients set processed_at=now() where id=r.id; n:=n+1;
 end loop;
 n:=n+private.prepare_streak_reminders();
 delete from private.push_jobs where updated_at<now()-interval '30 days' and state not in('pending','sending');
 delete from private.notification_recipients where processed_at<now()-interval '30 days';
 update private.push_jobs j set state='expired',lease=null,lease_until=null,updated_at=now() from public.notifications nn where nn.id=j.notification_id and nn.expires_at<=now() and j.state in('pending','sending');
 return jsonb_build_object('processed',n);
end $function$;
CREATE OR REPLACE FUNCTION private.push_relevant(n notifications)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if n.context ? 'course_id' and not exists(select 1 from public.course_offerings o join public.enrollments e on e.offering_id=o.id
   where o.course_id=(n.context->>'course_id')::uuid and o.status='published' and e.user_id=n.user_id and e.ended_at is null) then return false; end if;
 if n.context ? 'battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'battle_id')::uuid and b.invited_user_id=n.user_id and b.state='waiting' and b.invitation_expires_at>now() and private.are_friends(n.user_id,b.created_by)) then return false; end if;
 if n.context ? 'accepted_battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'accepted_battle_id')::uuid and b.created_by=n.user_id and b.state='ready' and b.ready_deadline>now()) then return false; end if;
 if n.context ? 'friend_low' and not exists(select 1 from public.friendships f where f.user_low=(n.context->>'friend_low')::uuid and f.user_high=(n.context->>'friend_high')::uuid and f.state=n.context->>'friend_state') then return false; end if;
 if n.context ? 'admin_only' and not exists(select 1 from public.user_roles where user_id=n.user_id and role='admin') then return false; end if;
 if n.context ? 'assignment_id' and not exists(select 1 from public.lecturer_course_assignments where user_id=n.user_id and offering_id=(n.context->>'assignment_id')::uuid) then return false; end if;
 if n.context ? 'lesson_id' and not exists(select 1 from public.lessons l join public.lesson_versions v on v.lesson_id=l.id and v.status='published' join public.course_offerings o on o.course_id=l.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where l.id=(n.context->>'lesson_id')::uuid and e.user_id=n.user_id) then return false; end if;
 if n.context ? 'assessment_id' and not exists(select 1 from public.assessments a join public.assessment_versions v on v.assessment_id=a.id and v.status='published' join public.course_offerings o on o.course_id=a.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where a.id=(n.context->>'assessment_id')::uuid and e.user_id=n.user_id) then return false; end if;
 if n.context->>'audience'='offering' and not exists(select 1 from public.enrollments where user_id=n.user_id and offering_id=(n.context->>'audience_id')::uuid and ended_at is null) then return false; end if;
 if n.context->>'audience'='role' and not exists(select 1 from public.user_roles where user_id=n.user_id and role=n.context->>'audience_id') then return false; end if;

 if n.kind='study_reminder' and (
   private.lagos_date()::text is distinct from n.context->>'date'
   or exists(select 1 from public.activity_events a where a.user_id=n.user_id and a.local_date=private.lagos_date())
 ) then return false; end if;
 if n.kind='leaderboard_overtaken' and not exists(
   select 1 from public.profiles actor join public.user_points ap on ap.user_id=actor.id
   join auth.users actor_auth on actor_auth.id=actor.id
   join public.profiles recipient on recipient.id=n.user_id
   join auth.users recipient_auth on recipient_auth.id=recipient.id
   left join public.user_points rp on rp.user_id=recipient.id
   where actor.id=(n.context->>'actor_id')::uuid and actor.leaderboard_visible
     and actor.deactivated_at is null and recipient.leaderboard_visible and recipient.deactivated_at is null
     and (-ap.total,coalesce(actor_auth.created_at,actor.created_at),actor.id)
       <(-coalesce(rp.total,0),coalesce(recipient_auth.created_at,recipient.created_at),recipient.id)
     and (n.context->>'scope'='global' or actor.faculty_id=recipient.faculty_id)
 ) then return false; end if;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION public.claim_push_jobs_v1(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j private.push_jobs; result jsonb:='[]';
begin
 if not exists(select 1 from private.push_control where enabled) then return result; end if;
 for j in select * from private.push_jobs where (state='pending' and available_at<=now()) or (state='sending' and lease_until<now()) order by case when exists(select 1 from public.notifications n where n.id=private.push_jobs.notification_id and n.kind='study_reminder') then 0 when exists(select 1 from public.notifications n where n.id=private.push_jobs.notification_id and n.kind='leaderboard_overtaken') then 1 else 2 end, available_at, id for update skip locked limit least(greatest(coalesce(p_limit,20),1),20) loop
   if j.attempts>=8 then update private.push_jobs set state='failed',last_code='attempt_limit',updated_at=now() where id=j.id; continue; end if;
   update private.push_jobs set state='sending',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'lease',j.lease));
 end loop; return result;
end $function$;
CREATE OR REPLACE FUNCTION public.authorize_push_job_v1(p_id uuid, p_lease uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 next_at:=private.push_next_time(greatest(now(),case when gate.job_id=j.id or n.kind='study_reminder' then now() else gate.next_at end,
   case when n.kind='course_content' then n.created_at+interval '5 minutes' else now() end),p.timezone,p.quiet_start,p.quiet_end);
 if next_at>now() then
   update private.push_jobs set state=case when next_at>=n.expires_at then 'expired' else 'pending' end,available_at=next_at,lease=null,lease_until=null,attempts=greatest(attempts-1,0),updated_at=now() where id=j.id; return null;
 end if;
 update private.push_delivery_windows set next_at=now()+interval '30 minutes',job_id=j.id where token_id=j.token_id;
 return jsonb_build_object('subscription',t.delivery_config,'attempts',j.attempts,'expires_at',n.expires_at,
 'payload',jsonb_build_object('id',n.id,'kind',n.kind,'title',n.title,'body',n.body,'target',coalesce(n.safe_target,'/notification-settings'),'expires_at',n.expires_at,'device_key',t.device_key));
end $function$;

-- Match the live leaderboard: XP, registration timestamp, then user ID.
create or replace function private.serialize_leaderboard_changes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('leaderboard-notification-ranking',0));
  return new;
end $$;
create trigger serialize_leaderboard_notifications before update of total on public.user_points
  for each row when (new.total is distinct from old.total)
  execute function private.serialize_leaderboard_changes();

create or replace function private.notify_leaderboard_overtaken() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor public.profiles; recipient record; v_name text; v_registered timestamptz;
begin
  if new.total<=old.total then return new; end if;
  select * into actor from public.profiles where id=new.user_id and leaderboard_visible and deactivated_at is null;
  if actor.id is null then return new; end if;
  select coalesce(a.created_at,actor.created_at) into v_registered from auth.users a where a.id=actor.id;
  v_name:=coalesce(private.public_username(actor.id),'Learner');
  for recipient in
    with ranked as (
      select p.id,p.faculty_id,coalesce(up.total,0) as total,
        coalesce(a.created_at,p.created_at) as registered_at,
        row_number() over(order by coalesce(up.total,0) desc,coalesce(a.created_at,p.created_at),p.id) as rank
      from public.profiles p join auth.users a on a.id=p.id
      left join public.user_points up on up.user_id=p.id
      where p.leaderboard_visible and p.deactivated_at is null
    )
    select * from ranked r where r.id<>actor.id
      and (-old.total,v_registered,actor.id)>(-r.total,r.registered_at,r.id)
      and (-new.total,v_registered,actor.id)<(-r.total,r.registered_at,r.id)
  loop
      perform private.notification_event(recipient.id,'leaderboard_overtaken',
        '@'||v_name||' overtook you on the leaderboard. You are now #'||recipient.rank||'. Earn XP to climb back!',
        '/leaderboard','leaderboard_overtaken:'||actor.id||':'||recipient.id||':'||txid_current()||':'||new.total,
        'activity',jsonb_build_object('actor_id',actor.id,'actor_username',v_name,'scope','global',
          'previous_rank',recipient.rank-1,'rank',recipient.rank),now()+interval '24 hours','You have been overtaken');
  end loop;
  return new;
end $$;
create trigger notify_leaderboard_overtaken after update of total on public.user_points
  for each row when (new.total>old.total) execute function private.notify_leaderboard_overtaken();
revoke all on function private.serialize_leaderboard_changes(),private.notify_leaderboard_overtaken()
  from public,anon,authenticated;
;
