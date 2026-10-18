-- Browser push delivery is deliberately independent of the Realtime outbox.
create table private.push_control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  general_release boolean not null default false,
  cohort uuid[] not null default '{}',
  vapid_public_key text not null default '',
  announcement_hourly_limit integer not null default 5 check(announcement_hourly_limit between 1 and 100)
);
insert into private.push_control(singleton) values(true);
create table private.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  activity boolean not null default true, academic boolean not null default true,
  announcement boolean not null default true, account boolean not null default true,
  reminder boolean not null default false,
  timezone text not null default 'Africa/Lagos', reminder_time time not null default '19:00',
  quiet_start time not null default '22:00', quiet_end time not null default '08:00',
  updated_at timestamptz not null default now(), configured boolean not null default false, check(quiet_start<>quiet_end)
);
alter table public.notifications add column title text not null default 'ScholAu';
alter table public.notifications add column category text not null default 'account'
  check(category in('activity','academic','announcement','account','reminder'));
alter table public.notifications add column expires_at timestamptz not null default (now()+interval '24 hours');
alter table public.notifications add column context jsonb not null default '{}';
create table private.push_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token_id uuid not null references public.push_tokens(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'pending' check(state in('pending','sending','accepted','expired','skipped','failed')),
  attempts integer not null default 0, available_at timestamptz not null default now(),
  lease uuid, lease_until timestamptz, last_code text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(notification_id,token_id)
);
create index push_jobs_due on private.push_jobs(available_at) where state in('pending','sending');
create table private.announcements (
  id uuid primary key default gen_random_uuid(), author_id uuid references public.profiles(id) on delete set null,
  request_key uuid not null, title text not null, body text not null, target text,
  audience text not null check(audience in('offering','role','everyone')), audience_id text,
  recipient_count integer not null default 0, created_at timestamptz not null default now(), unique(author_id,request_key)
);
create table private.notification_recipients (
  id bigint generated always as identity primary key,
  event_key text not null, user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null, title text not null, body text not null, target text,
  category text not null, context jsonb not null default '{}',
  expires_at timestamptz not null default(now()+interval '24 hours'),
  processed_at timestamptz, unique(event_key,user_id)
);
create index notification_recipients_pending on private.notification_recipients(id) where processed_at is null;
create table private.lesson_notification_publications (
 lesson_id uuid primary key references public.lessons(id) on delete cascade,
 first_published_at timestamptz not null default now()
);
-- Publishing a replacement version must never announce an existing lesson as new.
insert into private.lesson_notification_publications(lesson_id)
select distinct lesson_id from public.lesson_versions where status in('published','retired');
-- Secrets never appear in client table reads, including reads by an administrator.
revoke all on public.push_tokens from anon,authenticated;
revoke all on private.push_control,private.notification_preferences,private.push_jobs,private.announcements,private.notification_recipients,private.lesson_notification_publications from public,anon,authenticated;
alter table private.push_control enable row level security;
alter table private.notification_preferences enable row level security;
alter table private.push_jobs enable row level security;
alter table private.announcements enable row level security;
alter table private.notification_recipients enable row level security;
alter table private.lesson_notification_publications enable row level security;

create function private.push_allowed(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.push_control c where c.enabled and (c.general_release or p_user=any(c.cohort)))
$$;
create function private.valid_push_subscription(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and length(p->>'endpoint') between 20 and 2048
 and (p->>'endpoint') ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[A-Za-z0-9_/?=&%+.:~-]+$'
 and (p->'keys'->>'p256dh') ~ '^[A-Za-z0-9_-]{87}=?$'
 and (p->'keys'->>'auth') ~ '^[A-Za-z0-9_-]{22}={0,2}$',false)
$$;
create or replace function public.register_push_token_v1(p_platform text,p_device_key text,p_delivery_config jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); token uuid;
begin
 if p_platform is distinct from 'web' or p_device_key is null or length(p_device_key) not between 8 and 200
 or not private.valid_push_subscription(p_delivery_config) then perform private.raise_error('VALIDATION_FAILED','Invalid browser push subscription.'); end if;
 if not private.push_allowed(u) then perform private.raise_error('FORBIDDEN','Push notifications are not enabled for this account yet.'); end if;
 -- Serialize registrations for the endpoint; one browser subscription has one current owner.
 perform pg_advisory_xact_lock(hashtextextended(p_delivery_config->>'endpoint',0));
 update public.push_tokens set revoked_at=now(),delivery_config='{}',updated_at=now()
 where platform='web' and delivery_config->>'endpoint'=p_delivery_config->>'endpoint' and (user_id<>u or device_key<>p_device_key);
 insert into public.push_tokens(user_id,platform,device_key,delivery_config,consented_at)
 values(u,'web',p_device_key,jsonb_build_object('endpoint',p_delivery_config->>'endpoint','keys',p_delivery_config->'keys'),now())
 on conflict(user_id,platform,device_key) do update set delivery_config=excluded.delivery_config,revoked_at=null,consented_at=now(),updated_at=now()
 returning id into token;
 insert into private.notification_preferences(user_id) values(u) on conflict do nothing;
 return private.envelope(jsonb_build_object('push_token_id',token));
end $$;
create or replace function public.revoke_push_token_v1(p_platform text,p_device_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); changed integer;
begin
 update public.push_tokens set revoked_at=now(),delivery_config='{}',updated_at=now()
 where user_id=u and platform=p_platform and device_key=p_device_key and revoked_at is null;
 get diagnostics changed=row_count;
 return private.envelope(jsonb_build_object('revoked',changed>0));
end $$;
create function public.get_notification_preferences_v1() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); result jsonb;
begin
 insert into private.notification_preferences(user_id) values(u) on conflict do nothing;
 select (to_jsonb(p)-'user_id'-'configured')||jsonb_build_object('updated_at',case when configured then updated_at else null end) into result from private.notification_preferences p where user_id=u;
 return private.envelope(jsonb_build_object('preferences',result,'push_available',private.push_allowed(u),
 'vapid_public_key',(select vapid_public_key from private.push_control),
 'devices',coalesce((select jsonb_agg(jsonb_build_object('device_key',device_key,'active',revoked_at is null)) from public.push_tokens where user_id=u and platform='web'),'[]'::jsonb)));
end $$;
create function public.update_notification_preferences_v1(p_preferences jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); p jsonb:=p_preferences;
begin
 if p is null or jsonb_typeof(p)<>'object' or not exists(select 1 from pg_timezone_names where name=p->>'timezone')
 or exists(select 1 from jsonb_object_keys(p) k where k not in('activity','academic','announcement','account','reminder','timezone','reminder_time','quiet_start','quiet_end'))
 or exists(select 1 from unnest(array['activity','academic','announcement','account','reminder']) k where jsonb_typeof(p->k) is distinct from 'boolean')
 or coalesce(p->>'reminder_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$'
 or coalesce(p->>'quiet_start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$'
 or coalesce(p->>'quiet_end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$'
 or p->>'quiet_start'=p->>'quiet_end' then perform private.raise_error('VALIDATION_FAILED','Check the timezone, times and category settings.'); end if;
 insert into private.notification_preferences(user_id,activity,academic,announcement,account,reminder,timezone,reminder_time,quiet_start,quiet_end)
 values(u,(p->>'activity')::boolean,(p->>'academic')::boolean,(p->>'announcement')::boolean,(p->>'account')::boolean,(p->>'reminder')::boolean,p->>'timezone',(p->>'reminder_time')::time,(p->>'quiet_start')::time,(p->>'quiet_end')::time)
 on conflict(user_id) do update set activity=excluded.activity,academic=excluded.academic,announcement=excluded.announcement,account=excluded.account,reminder=excluded.reminder,timezone=excluded.timezone,reminder_time=excluded.reminder_time,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,updated_at=now(),configured=true;
 update private.notification_preferences set configured=true where user_id=u;
 return public.get_notification_preferences_v1();
end $$;

-- Returns the next permissible instant (or now); equal boundaries are rejected in preferences.
create function private.push_next_time(p_now timestamptz,p_zone text,p_start time,p_end time) returns timestamptz language plpgsql stable set search_path='' as $$
declare l timestamp:=p_now at time zone p_zone;
begin
 if p_start<p_end then
   if l::time>=p_start and l::time<p_end then return (l::date+p_end) at time zone p_zone; end if;
 else
   if l::time>=p_start then return ((l::date+1)+p_end) at time zone p_zone; end if;
   if l::time<p_end then return (l::date+p_end) at time zone p_zone; end if;
 end if;
 return p_now;
end $$;
create function private.queue_notification_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.push_jobs(notification_id,token_id,user_id)
 select new.id,t.id,new.user_id from public.push_tokens t
 where t.user_id=new.user_id and t.platform='web' and t.revoked_at is null and t.consented_at<=new.created_at
 and private.push_allowed(t.user_id) on conflict do nothing;
 return new;
end $$;
-- Existing producers receive category/expiry metadata without changing their transactions.
create function private.prepare_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.battles;
begin
 if new.kind='battle_invitation' then
   select * into b from public.battles where 'battle_invited:'||id::text=new.event_key;
   new.category:='activity'; new.title:='Battle invitation';
   if b.id is not null then new.expires_at:=b.invitation_expires_at; new.context:=jsonb_build_object('battle_id',b.id); end if;
 elsif new.kind='lecturer_application' then new.category:='account'; new.title:='Lecturer application'; end if;
 return new;
end $$;
create trigger prepare_push_metadata before insert on public.notifications for each row execute function private.prepare_notification();
create trigger queue_notification_push after insert on public.notifications for each row execute function private.queue_notification_push();
create function private.notification_event(p_user uuid,p_kind text,p_body text,p_target text,p_key text,p_category text,p_context jsonb default '{}',p_expiry timestamptz default(now()+interval '24 hours'),p_title text default 'ScholAu') returns void
language sql security definer set search_path='' as $$
 insert into public.notifications(user_id,kind,title,body,safe_target,event_key,category,context,expires_at)
 select p_user,p_kind,p_title,p_body,p_target,p_key,p_category,p_context,p_expiry
 where exists(select 1 from public.profiles where id=p_user and deactivated_at is null)
 on conflict(event_key) do nothing
$$;
create function private.notify_friend_change() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 recipient:=case when new.actor_id=new.user_low then new.user_high else new.user_low end;
 if new.state='pending' and (tg_op='INSERT' or old.state is distinct from new.state) then
 perform private.notification_event(recipient,'friend_request','You have a new friend request.','/battles','friend_request:'||new.user_low||':'||new.user_high||':'||new.updated_at,'activity',jsonb_build_object('friend_low',new.user_low,'friend_high',new.user_high,'friend_state','pending'));
 elsif tg_op='UPDATE' and new.state='accepted' and old.state='pending' then
 perform private.notification_event(new.actor_id,'friend_accepted','Your friend request was accepted.','/battles','friend_accepted:'||new.user_low||':'||new.user_high||':'||new.updated_at,'activity',jsonb_build_object('friend_low',new.user_low,'friend_high',new.user_high,'friend_state','accepted'));
 end if;
 return new;
end $$;
create trigger notify_friend_change after insert or update on public.friendships for each row execute function private.notify_friend_change();
create function private.notify_battle_acceptance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.state='waiting' and new.state='ready' and new.mode='direct' then
 perform private.notification_event(new.created_by,'battle_accepted','Your battle invitation was accepted. Get ready in Battles.','/battles','battle_accepted:'||new.id,'activity',jsonb_build_object('accepted_battle_id',new.id),coalesce(new.ready_deadline,now()+interval '1 minute'));
 end if; return new;
end $$;
create trigger notify_battle_acceptance after update on public.battles for each row execute function private.notify_battle_acceptance();
create function private.notify_application_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and (tg_op='INSERT' or old.revision<>new.revision) then
 insert into private.notification_recipients(event_key,user_id,kind,title,body,target,category,context)
 select 'application_submitted:'||new.id||':'||new.revision,r.user_id,'application_submitted','Lecturer application','A lecturer application is waiting for review.','/admin/lecturer-applications','account',jsonb_build_object('admin_only',true)
 from public.user_roles r join public.profiles p on p.id=r.user_id where r.role='admin' and p.deactivated_at is null on conflict do nothing;
 end if; return new;
end $$;
create trigger notify_application_submission after insert or update on public.lecturer_applications for each row execute function private.notify_application_submission();
create function private.notify_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.notification_event(new.user_id,'course_assignment','A course has been assigned to your teaching workspace.','/lecturer','course_assignment:'||new.user_id||':'||new.offering_id||':'||new.assigned_at,'academic',jsonb_build_object('assignment_id',new.offering_id));
 return new;
end $$;
create trigger notify_assignment after insert on public.lecturer_course_assignments for each row execute function private.notify_assignment();
create function private.notify_published_lesson() returns trigger language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
 insert into private.lesson_notification_publications(lesson_id) values(new.lesson_id) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return new; end if;
 insert into private.notification_recipients(event_key,user_id,kind,title,body,target,category,context)
 select distinct 'lesson_published:'||new.lesson_id,e.user_id,'course_content','New course content','A new lesson is available in one of your courses.','/study','academic',jsonb_build_object('lesson_id',new.lesson_id)
 from public.lessons l join public.course_offerings o on o.course_id=l.course_id join public.enrollments e on e.offering_id=o.id
 where l.id=new.lesson_id and o.status='published' and e.ended_at is null on conflict do nothing;
 end if; return new;
end $$;
create trigger notify_published_lesson after insert or update on public.lesson_versions for each row execute function private.notify_published_lesson();

create table private.assessment_notification_publications (
 assessment_id uuid primary key references public.assessments(id) on delete cascade,
 first_published_at timestamptz not null default now()
);
insert into private.assessment_notification_publications(assessment_id)
select distinct assessment_id from public.assessment_versions where status in('published','retired');
alter table private.assessment_notification_publications enable row level security;
revoke all on private.assessment_notification_publications from public,anon,authenticated;
create function private.notify_published_assessment() returns trigger language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
 insert into private.assessment_notification_publications(assessment_id) values(new.assessment_id) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return new; end if;
 insert into private.notification_recipients(event_key,user_id,kind,title,body,target,category,context)
 select distinct 'assessment_published:'||new.assessment_id,e.user_id,'course_content','New course practice','A new assessment is available in one of your courses.','/study','academic',jsonb_build_object('assessment_id',new.assessment_id)
 from public.assessments a join public.course_offerings o on o.course_id=a.course_id join public.enrollments e on e.offering_id=o.id
 where a.id=new.assessment_id and o.status='published' and e.ended_at is null on conflict do nothing;
 end if; return new;
end $$;
create trigger notify_published_assessment after insert or update on public.assessment_versions for each row execute function private.notify_published_assessment();
revoke all on function private.notify_published_assessment() from public,anon,authenticated;

create function private.announcement_recipients(p_actor uuid,p_audience text,p_id text) returns setof uuid language plpgsql security definer set search_path='' as $$
declare admin boolean:=exists(select 1 from public.user_roles where user_id=p_actor and role='admin'); offering uuid;
begin
 if p_audience is null or p_audience not in('offering','role','everyone') then perform private.raise_error('VALIDATION_FAILED'); end if;
 if not admin and (p_audience<>'offering' or not exists(select 1 from public.user_roles r join public.lecturer_applications a on a.user_id=r.user_id where r.user_id=p_actor and r.role='lecturer' and a.status='approved')) then perform private.raise_error('FORBIDDEN'); end if;
 if p_audience='offering' then
   if p_id is null or p_id !~ '^[0-9a-fA-F-]{36}$' then perform private.raise_error('VALIDATION_FAILED'); end if;
   offering:=p_id::uuid;
   if not exists(select 1 from public.course_offerings where id=offering and status='published') then perform private.raise_error('VALIDATION_FAILED'); end if;
   if not admin and not exists(select 1 from public.lecturer_course_assignments where user_id=p_actor and offering_id=offering) then perform private.raise_error('FORBIDDEN'); end if;
   return query select e.user_id from public.enrollments e join public.profiles p on p.id=e.user_id where e.offering_id=offering and e.ended_at is null and p.deactivated_at is null;
 elsif p_audience='role' then
   if p_id is null or p_id not in('student','lecturer','admin') then perform private.raise_error('VALIDATION_FAILED'); end if;
   return query select r.user_id from public.user_roles r join public.profiles p on p.id=r.user_id where r.role=p_id and p.deactivated_at is null;
 else return query select id from public.profiles where deactivated_at is null;
 end if;
end $$;
create function public.preview_announcement_v1(p_audience text,p_audience_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); n integer;
begin select count(*) into n from private.announcement_recipients(u,p_audience,p_audience_id); return private.envelope(jsonb_build_object('recipient_count',n)); end $$;
create function public.send_announcement_v1(p_title text,p_body text,p_target text,p_audience text,p_audience_id text,p_request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); a private.announcements; n integer;
begin
 perform private.require_request_key(p_request_key);
 perform pg_advisory_xact_lock(hashtextextended('announcement:'||u,0));
 select * into a from private.announcements where author_id=u and request_key=p_request_key;
 if a.id is not null then
   if a.title is distinct from btrim(p_title) or a.body is distinct from btrim(p_body) or a.target is distinct from nullif(p_target,'') or a.audience is distinct from p_audience or a.audience_id is distinct from p_audience_id then perform private.raise_error('VALIDATION_FAILED','Request key already used.'); end if;
   return private.envelope(jsonb_build_object('announcement_id',a.id,'recipient_count',a.recipient_count),p_request_key);
 end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 100 or length(btrim(coalesce(p_body,''))) not between 1 and 500
 or (nullif(p_target,'') is not null and (p_target !~ '^/[A-Za-z0-9/_-]*$' or p_target like '//%')) then perform private.raise_error('VALIDATION_FAILED'); end if;
 if (select count(*) from private.announcements where author_id=u and created_at>now()-interval '1 hour') >= (select announcement_hourly_limit from private.push_control) then perform private.raise_error('RATE_LIMITED'); end if;
 -- Snapshot eligible recipients now; fan-out into inbox/jobs is bounded separately.
 insert into private.announcements(author_id,request_key,title,body,target,audience,audience_id) values(u,p_request_key,btrim(p_title),btrim(p_body),nullif(p_target,''),p_audience,p_audience_id) returning * into a;
 insert into private.notification_recipients(event_key,user_id,kind,title,body,target,category,context)
 select 'announcement:'||a.id,x,'announcement',a.title,a.body,a.target,'announcement',jsonb_build_object('audience',p_audience,'audience_id',p_audience_id)
 from private.announcement_recipients(u,p_audience,p_audience_id) x;
 get diagnostics n=row_count;
 update private.announcements set recipient_count=n where id=a.id;
 perform private.audit(u,'send_announcement','announcement',a.id,p_request_key,null,jsonb_build_object('recipient_count',n,'audience',p_audience));
 return private.envelope(jsonb_build_object('announcement_id',a.id,'recipient_count',n),p_request_key);
end $$;

-- Re-evaluated before each send: an invitation/read notification or lost access must not leak.
create function private.push_relevant(n public.notifications) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
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
create function public.prepare_push_batch_v1() returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; p record; local_now timestamp; n integer:=0;
begin
 -- Inbox fan-out also runs while push delivery is disabled.
 for r in select * from private.notification_recipients where processed_at is null order by id for update skip locked limit 200 loop
   perform private.notification_event(r.user_id,r.kind,r.body,r.target,r.event_key||':'||r.user_id,r.category,r.context,r.expires_at,r.title);
   update private.notification_recipients set processed_at=now() where id=r.id; n:=n+1;
 end loop;
 for p in select pref.* from private.notification_preferences pref join public.profiles u on u.id=pref.user_id
 where pref.reminder and u.deactivated_at is null and private.push_allowed(pref.user_id)
 and exists(select 1 from public.push_tokens t where t.user_id=pref.user_id and t.revoked_at is null and t.platform='web')
 and (now() at time zone pref.timezone)::time>=pref.reminder_time
 and not exists(select 1 from public.notifications nn where nn.event_key='study_reminder:'||pref.user_id||':'||(now() at time zone pref.timezone)::date)
 and not exists(select 1 from public.activity_events e where e.user_id=pref.user_id and (e.created_at at time zone pref.timezone)::date=(now() at time zone pref.timezone)::date)
 order by pref.user_id limit 200 loop
   local_now:=now() at time zone p.timezone;
   if not exists(select 1 from public.activity_events e where e.user_id=p.user_id and (e.created_at at time zone p.timezone)::date=local_now::date) then
     perform private.notification_event(p.user_id,'study_reminder',case when exists(select 1 from public.activity_events e where e.user_id=p.user_id and (e.created_at at time zone p.timezone)::date=local_now::date-1) then 'Keep your study streak going with a lesson today.' else 'Make time for a little learning today.' end,'/home','study_reminder:'||p.user_id||':'||local_now::date,'reminder',jsonb_build_object('date',local_now::date),((local_now::date+1)::timestamp at time zone p.timezone),'Time to study');
   end if;
 end loop;
 delete from private.push_jobs where updated_at<now()-interval '30 days' and state not in('pending','sending');
 delete from private.notification_recipients where processed_at<now()-interval '30 days';
 update private.push_jobs j set state='expired',lease=null,lease_until=null,updated_at=now() from public.notifications nn where nn.id=j.notification_id and nn.expires_at<=now() and j.state in('pending','sending');
 return jsonb_build_object('processed',n);
end $$;
create function public.claim_push_jobs_v1(p_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.push_jobs; result jsonb:='[]';
begin
 if not exists(select 1 from private.push_control where enabled) then return result; end if;
 for j in select * from private.push_jobs where (state='pending' and available_at<=now()) or (state='sending' and lease_until<now()) order by available_at for update skip locked limit least(greatest(coalesce(p_limit,20),1),20) loop
   if j.attempts>=8 then update private.push_jobs set state='failed',last_code='attempt_limit',updated_at=now() where id=j.id; continue; end if;
   update private.push_jobs set state='sending',lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
   result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'lease',j.lease));
 end loop; return result;
end $$;
create function public.authorize_push_job_v1(p_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.push_jobs; n public.notifications; t public.push_tokens; p private.notification_preferences; next_at timestamptz;
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
 next_at:=private.push_next_time(now(),p.timezone,p.quiet_start,p.quiet_end);
 if next_at>now() then
   update private.push_jobs set state=case when next_at>=n.expires_at then 'expired' else 'pending' end,available_at=next_at,lease=null,lease_until=null,attempts=greatest(attempts-1,0),updated_at=now() where id=j.id; return null;
 end if;
 return jsonb_build_object('subscription',t.delivery_config,'attempts',j.attempts,'expires_at',n.expires_at,
 'payload',jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'target',coalesce(n.safe_target,'/notification-settings'),'expires_at',n.expires_at,'device_key',t.device_key));
end $$;
create function public.finish_push_job_v1(p_id uuid,p_lease uuid,p_code integer,p_retry_seconds integer default null) returns void language plpgsql security definer set search_path='' as $$
declare j private.push_jobs;
begin
 select * into j from private.push_jobs where id=p_id and lease=p_lease and state='sending' and lease_until>now() for update;
 if not found then return; end if;
 if p_code in(404,410) then update public.push_tokens set revoked_at=now(),delivery_config='{}',updated_at=now() where id=j.token_id; end if;
 update private.push_jobs set state=case when p_code between 200 and 299 then 'accepted' when (p_code=0 or p_code=429 or p_code>=500) and attempts<8 then 'pending' else 'failed' end,
 available_at=now()+make_interval(secs=>greatest(30,least(86400,coalesce(p_retry_seconds,(30*power(2,attempts))::integer)))),last_code=p_code::text,lease=null,lease_until=null,updated_at=now() where id=j.id;
end $$;
create function public.admin_push_health_v1() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user();
begin
 if not exists(select 1 from public.user_roles where user_id=u and role='admin') then perform private.raise_error('FORBIDDEN'); end if;
 return private.envelope(jsonb_build_object('delivery_enabled',(select enabled from private.push_control),
 'states',coalesce((select jsonb_object_agg(state,n) from(select state,count(*) n from private.push_jobs group by state) q),'{}'::jsonb),
 'pending_recipients',(select count(*) from private.notification_recipients where processed_at is null),
 'oldest_pending_at',(select min(created_at) from private.push_jobs where state in('pending','sending')),
 'failures',coalesce((select jsonb_agg(x) from(select id,last_code,attempts,updated_at from private.push_jobs where state='failed' order by updated_at desc limit 20) x),'[]'::jsonb)));
end $$;
create function private.revoke_deactivated_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deactivated_at is not null then
 update public.push_tokens set revoked_at=now(),delivery_config='{}',updated_at=now() where user_id=new.id;
 update private.push_jobs set state='skipped',lease=null,lease_until=null,updated_at=now() where user_id=new.id and state in('pending','sending');
 end if; return new;
end $$;
create trigger revoke_deactivated_push after update of deactivated_at on public.profiles for each row execute function private.revoke_deactivated_push();
-- Revoke every newly-created helper explicitly; only bounded worker RPCs belong to service_role.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in('push_allowed','valid_push_subscription','push_next_time','queue_notification_push','prepare_notification','notification_event','notify_friend_change','notify_battle_acceptance','notify_application_submission','notify_assignment','notify_published_lesson','announcement_recipients','push_relevant','revoke_deactivated_push'))
 or (n.nspname='public' and p.proname in('get_notification_preferences_v1','update_notification_preferences_v1','preview_announcement_v1','send_announcement_v1','prepare_push_batch_v1','claim_push_jobs_v1','authorize_push_job_v1','finish_push_job_v1','admin_push_health_v1')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.get_notification_preferences_v1(),public.update_notification_preferences_v1(jsonb),public.preview_announcement_v1(text,text),public.send_announcement_v1(text,text,text,text,text,uuid),public.admin_push_health_v1() to authenticated;
grant execute on function public.prepare_push_batch_v1(),public.claim_push_jobs_v1(integer),public.authorize_push_job_v1(uuid,uuid),public.finish_push_job_v1(uuid,uuid,integer,integer) to service_role;

create function public.get_announcement_audiences_v1() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); admin boolean;
begin
 admin:=exists(select 1 from public.user_roles where user_id=u and role='admin');
 if not admin and not exists(select 1 from public.user_roles r join public.lecturer_applications a on a.user_id=r.user_id where r.user_id=u and r.role='lecturer' and a.status='approved') then perform private.raise_error('FORBIDDEN'); end if;
 return private.envelope(jsonb_build_object('offerings',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',c.code||' — '||c.title||' · '||d.name||' · '||s.label||' · '||ap.label) order by c.code,o.id)
 from public.course_offerings o join public.courses c on c.id=o.course_id join public.departments d on d.id=o.department_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id
 where o.status='published' and (admin or exists(select 1 from public.lecturer_course_assignments x where x.user_id=u and x.offering_id=o.id))),'[]'::jsonb)));
end $$;
create function public.open_notification_v1(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); n public.notifications;
begin
 select * into n from public.notifications where id=p_id and user_id=u;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=n.id;
 return private.envelope(jsonb_build_object('target',case when private.push_relevant(n) and n.safe_target !~ '^//' then n.safe_target else '/notification-settings' end));
end $$;
revoke all on function public.get_announcement_audiences_v1(),public.open_notification_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_announcement_audiences_v1(),public.open_notification_v1(uuid) to authenticated;
