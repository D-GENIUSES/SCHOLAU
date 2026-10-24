-- Group bulk course publication and serialize device alert reservations.
create table private.push_delivery_windows (
 token_id uuid primary key references public.push_tokens(id) on delete cascade,
 next_at timestamptz not null default '-infinity', job_id uuid
);
alter table private.push_delivery_windows enable row level security;
revoke all on private.push_delivery_windows from public,anon,authenticated;
create table private.course_notification_events (
 user_id uuid references public.profiles(id) on delete cascade,
 event_key text not null, created_at timestamptz not null default now(),
 primary key(user_id,event_key)
);
alter table private.course_notification_events enable row level security;
revoke all on private.course_notification_events from public,anon,authenticated;
create index notifications_course_digest on public.notifications(user_id,(context->>'course_id'),created_at desc) where kind='course_content';
create or replace function private.notification_event(p_user uuid,p_kind text,p_body text,p_target text,p_key text,p_category text,p_context jsonb default '{}',p_expiry timestamptz default(now()+interval '24 hours'),p_title text default 'ScholAu') returns void
language plpgsql security definer set search_path='' as $$
declare course uuid; summary_key text; code text;
begin
 if p_kind='course_content' then
   select course_id into course from public.lessons where id=(p_context->>'lesson_id')::uuid;
   if course is null then select course_id into course from public.assessments where id=(p_context->>'assessment_id')::uuid; end if;
   if course is null then return; end if;
   insert into private.course_notification_events(user_id,event_key) values(p_user,p_key) on conflict do nothing;
   if not found then return; end if;
   select c.code into code from public.courses c where c.id=course;
   perform pg_advisory_xact_lock(hashtextextended('course-digest:'||p_user||':'||course,0));
   select event_key into summary_key from public.notifications where user_id=p_user and kind='course_content'
     and context->>'course_id'=course::text and created_at>now()-interval '30 minutes' order by created_at desc limit 1;
   if summary_key is not null then
     update public.notifications set read_at=null,context=context||jsonb_build_object('updates',coalesce((context->>'updates')::integer,1)+1)
       where event_key=summary_key;
     return;
   end if;
   insert into public.notifications(user_id,kind,title,body,safe_target,event_key,category,context,expires_at)
   select p_user,p_kind,'ScholAu · Course updates','New lessons and practice are available in '||code||'. Open Study to see your course updates.',
     '/study',p_key,p_category,jsonb_build_object('course_id',course,'updates',1),p_expiry
   where exists(select 1 from public.profiles where id=p_user and deactivated_at is null)
   on conflict(event_key) do nothing;
   return;
 end if;
 insert into public.notifications(user_id,kind,title,body,safe_target,event_key,category,context,expires_at)
 select p_user,p_kind,p_title,p_body,p_target,p_key,p_category,p_context,p_expiry
 where exists(select 1 from public.profiles where id=p_user and deactivated_at is null)
 on conflict(event_key) do nothing;
end $$;
create or replace function private.push_relevant(n public.notifications) returns boolean language plpgsql stable security definer set search_path='' as $$
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
 if n.kind='study_reminder' and ((now() at time zone coalesce((select timezone from private.notification_preferences where user_id=n.user_id),'Africa/Lagos'))::date::text is distinct from n.context->>'date'
 or exists(select 1 from public.activity_events e where e.user_id=n.user_id and (e.created_at at time zone (select timezone from private.notification_preferences where user_id=n.user_id))::date=(n.context->>'date')::date)) then return false; end if;
 return true;
end $$;
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
 next_at:=private.push_next_time(greatest(now(),case when gate.job_id=j.id then now() else gate.next_at end,
   case when n.kind='course_content' then n.created_at+interval '5 minutes' else now() end),p.timezone,p.quiet_start,p.quiet_end);
 if next_at>now() then
   update private.push_jobs set state=case when next_at>=n.expires_at then 'expired' else 'pending' end,available_at=next_at,lease=null,lease_until=null,attempts=greatest(attempts-1,0),updated_at=now() where id=j.id; return null;
 end if;
 update private.push_delivery_windows set next_at=now()+interval '30 minutes',job_id=j.id where token_id=j.token_id;
 return jsonb_build_object('subscription',t.delivery_config,'attempts',j.attempts,'expires_at',n.expires_at,
 'payload',jsonb_build_object('id',n.id,'kind',n.kind,'title',n.title,'body',n.body,'target',coalesce(n.safe_target,'/notification-settings'),'expires_at',n.expires_at,'device_key',t.device_key));
end $$;

-- Prevent a queued upload backlog from producing an alert storm on rollout.
-- Preserve all existing inbox items and content. New uploads use course summaries.
update private.push_jobs j set state='skipped',lease=null,lease_until=null,last_code='bulk_upload_rollout',updated_at=now()
 from public.notifications n where n.id=j.notification_id and n.kind='course_content' and j.state in('pending','sending');
update private.notification_recipients set processed_at=now() where kind='course_content' and processed_at is null;
revoke all on function public.authorize_push_job_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.authorize_push_job_v1(uuid,uuid) to service_role;
