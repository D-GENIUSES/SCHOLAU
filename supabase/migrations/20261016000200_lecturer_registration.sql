-- Lecturer registration is an application, not a self-service role grant.
alter table public.profiles add column registration_kind text not null default 'student'
  check (registration_kind in ('student','lecturer_applicant'));
alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('student','admin','lecturer'));

create table public.lecturer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null check(length(btrim(full_name)) between 2 and 120),
  university text not null check(length(btrim(university)) between 2 and 200),
  faculty text not null check(length(btrim(faculty)) between 2 and 200),
  department text not null check(length(btrim(department)) between 2 and 200),
  position text not null check(length(btrim(position)) between 2 and 120),
  requested_courses text not null check(length(btrim(requested_courses)) between 2 and 2000),
  institutional_profile_url text check(institutional_profile_url is null or (length(institutional_profile_url)<=500 and institutional_profile_url ~ '^https://[^[:space:]]+$')),
  verification_note text not null default '' check(length(verification_note)<=2000),
  status text not null default 'pending' check(status in ('pending','changes_requested','approved','rejected')),
  revision integer not null default 1 check(revision>0),
  applicant_message text not null default '' check(length(applicant_message)<=2000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lecturer_applications_queue on public.lecturer_applications(status,created_at,id);
create table private.lecturer_application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.lecturer_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  applicant_message text not null default '',
  internal_note text not null default '' check(length(internal_note)<=2000),
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique(actor_id,request_key)
);
create table public.lecturer_course_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  offering_id uuid not null references public.course_offerings(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key(user_id,offering_id)
);
alter table public.lecturer_applications enable row level security;
alter table private.lecturer_application_reviews enable row level security;
alter table public.lecturer_course_assignments enable row level security;
revoke all on public.lecturer_applications,public.lecturer_course_assignments from public,anon,authenticated;
revoke all on private.lecturer_application_reviews from public,anon,authenticated;
-- No direct table writes, and no direct application SELECT: RPC payloads omit private notes.

create or replace function private.validate_lecturer_application(p_data jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare k text; v text;
begin
  if p_data is null or jsonb_typeof(p_data)<>'object' then perform private.raise_error('VALIDATION_FAILED','Enter your lecturer details.'); end if;
  foreach k in array array['full_name','university','faculty','department','position','requested_courses'] loop
    v:=btrim(coalesce(p_data->>k,''));
    if jsonb_typeof(p_data->k) is distinct from 'string' or length(v)<2 or length(v)>(case when k='requested_courses' then 2000 when k in('university','faculty','department') then 200 else 120 end) then
      perform private.raise_error('VALIDATION_FAILED','Check your lecturer details.',jsonb_build_object(k,'invalid'));
    end if;
  end loop;
  v:=nullif(btrim(p_data->>'institutional_profile_url'),'');
  if v is not null and (length(v)>500 or v !~ '^https://[^[:space:]]+$') then perform private.raise_error('VALIDATION_FAILED','Use an https institutional profile URL.'); end if;
  if length(coalesce(p_data->>'verification_note',''))>2000 then perform private.raise_error('VALIDATION_FAILED','Verification information is too long.'); end if;
end $$;

-- Initial metadata chooses an application flow only; it can never grant lecturer/admin access.
-- Persist the choice in a non-user-writable column so later metadata edits have no effect.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_kind text; a jsonb;
begin
  v_kind:=case when new.raw_user_meta_data->>'signup_kind'='lecturer' then 'lecturer_applicant' else 'student' end;
  a:=new.raw_user_meta_data->'lecturer_application';
  if v_kind='lecturer_applicant' then perform private.validate_lecturer_application(a); end if;
  v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
  if length(v_name)<2 then v_name:=btrim(split_part(coalesce(new.email,''),'@',1)); end if;
  if length(v_name)<2 then v_name:='User'; end if;
  insert into public.profiles(id,display_name,registration_kind,leaderboard_visible) values(new.id,left(v_name,60),v_kind,v_kind='student') on conflict(id) do nothing;
  if v_kind='student' then
    insert into public.user_roles(user_id,role) values(new.id,'student') on conflict do nothing;
  else
    insert into public.lecturer_applications(user_id,full_name,university,faculty,department,position,requested_courses,institutional_profile_url,verification_note)
    values(new.id,btrim(a->>'full_name'),btrim(a->>'university'),btrim(a->>'faculty'),btrim(a->>'department'),btrim(a->>'position'),btrim(a->>'requested_courses'),nullif(btrim(a->>'institutional_profile_url'),''),btrim(coalesce(a->>'verification_note','')));
  end if;
  return new;
end $$;
create or replace function private.create_user_points()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.user_points(user_id) values(new.id) on conflict do nothing;
  if new.registration_kind='student' then perform private.award_points(new.id,'signup_welcome','signup',new.id,'signup:welcome',10); end if;
  return new;
end $$;

create or replace function private.guard_lecturer_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.registration_kind<>old.registration_kind then perform private.raise_error('FORBIDDEN','Registration type cannot be changed.'); end if;
  if new.registration_kind='lecturer_applicant' then new.leaderboard_visible:=false; end if;
  if new.registration_kind='lecturer_applicant' and (new.university_id is not null or new.faculty_id is not null or new.department_id is not null or new.level_id is not null or new.academic_period_id is not null or new.semester_id is not null) then
    perform private.raise_error('FORBIDDEN','Lecturer accounts use teaching assignments, not student enrollment.');
  end if;
  return new;
end $$;
create trigger lecturer_identity_guard before update on public.profiles for each row execute function private.guard_lecturer_identity();
create or replace function private.guard_lecturer_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.role='lecturer' and not exists(select 1 from public.lecturer_applications a join auth.users u on u.id=a.user_id where a.user_id=new.user_id and a.status='approved' and u.email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN','An approved, verified lecturer application is required.');
  end if;
  if new.role='student' and exists(select 1 from public.profiles p where p.id=new.user_id and p.registration_kind='lecturer_applicant') then
    perform private.raise_error('FORBIDDEN','A lecturer applicant cannot be granted student access.');
  end if;
  return new;
end $$;
create trigger lecturer_role_guard before insert or update on public.user_roles for each row execute function private.guard_lecturer_role();

create or replace function private.lecturer_application_payload(p_id uuid,p_admin boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
  select to_jsonb(a)||jsonb_build_object('email',u.email,'email_verified',u.email_confirmed_at is not null,
    'history',coalesce((select jsonb_agg(jsonb_build_object('action',r.action,'applicant_message',r.applicant_message,'created_at',r.created_at)||case when p_admin then jsonb_build_object('internal_note',r.internal_note,'actor_id',r.actor_id) else '{}'::jsonb end order by r.created_at,r.id) from private.lecturer_application_reviews r where r.application_id=a.id),'[]'::jsonb),
    'assigned_offering_ids',coalesce((select jsonb_agg(x.offering_id order by x.offering_id) from public.lecturer_course_assignments x where x.user_id=a.user_id),'[]'::jsonb))
  from public.lecturer_applications a join auth.users u on u.id=a.user_id where a.id=p_id
$$;
create or replace function public.get_my_lecturer_application_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); v_id uuid;
begin
  select id into v_id from public.lecturer_applications where user_id=v_uid;
  return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(v_id,false)));
end $$;

create or replace function public.resubmit_lecturer_application_v1(p_data jsonb,p_revision integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_user(); a public.lecturer_applications;
begin
  perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where user_id=v_uid for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if exists(select 1 from private.lecturer_application_reviews where actor_id=v_uid and request_key=p_request_key and application_id=a.id and action='resubmitted') then return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,false)),p_request_key); end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status<>'changes_requested' then perform private.raise_error('INVALID_STATE','Only applications returned for changes can be edited.'); end if;
  if not exists(select 1 from auth.users where id=v_uid and email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','Confirm your email first.'); end if;
  perform private.validate_lecturer_application(p_data);
  update public.lecturer_applications set full_name=btrim(p_data->>'full_name'),university=btrim(p_data->>'university'),faculty=btrim(p_data->>'faculty'),department=btrim(p_data->>'department'),position=btrim(p_data->>'position'),requested_courses=btrim(p_data->>'requested_courses'),institutional_profile_url=nullif(btrim(p_data->>'institutional_profile_url'),''),verification_note=btrim(coalesce(p_data->>'verification_note','')),status='pending',revision=revision+1,applicant_message='',updated_at=now() where id=a.id;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,request_key) values(a.id,v_uid,'resubmitted',p_request_key);
  perform private.audit(v_uid,'resubmit_lecturer_application','lecturer_application',a.id,p_request_key);
  return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,false)),p_request_key);
end $$;

create or replace function public.admin_list_lecturer_applications_v1(p_status text default null,p_search text default '',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); result jsonb; v_total integer;
begin
  if p_status is not null and p_status not in('pending','changes_requested','approved','rejected') then perform private.raise_error('VALIDATION_FAILED'); end if;
  if coalesce(length(p_search),0)>200 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100 then perform private.raise_error('VALIDATION_FAILED'); end if;
  select count(*) into v_total from public.lecturer_applications a join auth.users u on u.id=a.user_id where (p_status is null or a.status=p_status) and (coalesce(p_search,'')='' or strpos(lower(a.full_name||' '||a.university||' '||coalesce(u.email,'')),lower(p_search))>0);
  select coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id),'[]'::jsonb) into result from (
    select a.id,a.created_at,to_jsonb(a)||jsonb_build_object('email',u.email,'email_verified',u.email_confirmed_at is not null) as payload
    from public.lecturer_applications a join auth.users u on u.id=a.user_id
    where (p_status is null or a.status=p_status) and (coalesce(p_search,'')='' or strpos(lower(a.full_name||' '||a.university||' '||coalesce(u.email,'')),lower(p_search))>0)
    order by a.created_at desc,a.id offset p_offset limit p_limit
  ) x;
  return private.envelope(jsonb_build_object('items',result,'total',v_total,'pending_count',(select count(*) from public.lecturer_applications where status='pending')));
end $$;
create or replace function public.admin_get_lecturer_application_v1(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); a jsonb;
begin
  a:=private.lecturer_application_payload(p_application_id,true);
  if a is null then perform private.raise_error('NOT_FOUND'); end if;
  return private.envelope(jsonb_build_object('application',a));
end $$;
create or replace function public.admin_review_lecturer_application_v1(p_application_id uuid,p_decision text,p_applicant_message text,p_internal_note text,p_offering_ids uuid[],p_revision integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); a public.lecturer_applications; v_existing private.lecturer_application_reviews;
begin
  perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where id=p_application_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_existing from private.lecturer_application_reviews where actor_id=v_uid and request_key=p_request_key;
  if found then
    if v_existing.application_id<>a.id or v_existing.action<>p_decision then perform private.raise_error('INVALID_STATE','This request key was already used.'); end if;
    return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key);
  end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status<>'pending' then perform private.raise_error('INVALID_STATE','Only pending applications can be reviewed.'); end if;
  if p_decision is null or p_decision not in('approved','changes_requested','rejected') then perform private.raise_error('VALIDATION_FAILED'); end if;
  if length(coalesce(p_applicant_message,''))>2000 or length(coalesce(p_internal_note,''))>2000 or (p_decision<>'approved' and length(btrim(coalesce(p_applicant_message,'')))<8) then perform private.raise_error('VALIDATION_FAILED','Give the applicant clear feedback (8–2000 characters).'); end if;
  if p_decision='approved' and not exists(select 1 from auth.users where id=a.user_id and email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','The applicant must confirm their email before approval.'); end if;
  if coalesce(cardinality(p_offering_ids),0)>100 or exists(select 1 from unnest(p_offering_ids) x(id) where not exists(select 1 from public.course_offerings o where o.id=x.id and o.status='published')) then perform private.raise_error('VALIDATION_FAILED','Select valid published course offerings.'); end if;
  update public.lecturer_applications set status=p_decision,applicant_message=btrim(coalesce(p_applicant_message,'')),reviewed_by=v_uid,reviewed_at=now(),revision=revision+1,updated_at=now() where id=a.id;
  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by) values(a.user_id,'lecturer',v_uid) on conflict do nothing;
    insert into public.lecturer_course_assignments(user_id,offering_id,assigned_by) select a.user_id,x,v_uid from unnest(coalesce(p_offering_ids,'{}'::uuid[])) x on conflict do nothing;
  end if;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,applicant_message,internal_note,request_key) values(a.id,v_uid,p_decision,btrim(coalesce(p_applicant_message,'')),btrim(coalesce(p_internal_note,'')),p_request_key);
  insert into public.notifications(user_id,kind,body,safe_target,event_key) values(a.user_id,'lecturer_application',case p_decision when 'approved' then 'Your lecturer application has been approved.' when 'changes_requested' then 'Your lecturer application needs changes. Sign in to read the feedback.' else 'Your lecturer application has been reviewed. Sign in to read the decision.' end,'/lecturer/application','lecturer_application:'||a.id||':'||(a.revision+1));
  perform private.audit(v_uid,'review_lecturer_application','lecturer_application',a.id,p_request_key,null,jsonb_build_object('decision',p_decision));
  return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key);
end $$;
create or replace function public.admin_get_lecturer_offerings_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin();
begin
  return private.envelope(jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'university',u.name,'department',d.name,'semester',s.label,'period',ap.label) order by u.name,c.code,o.id) from public.course_offerings o join public.courses c on c.id=o.course_id join public.universities u on u.id=o.university_id join public.departments d on d.id=o.department_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id where o.status='published'),'[]'::jsonb)));
end $$;
create or replace function public.admin_assign_lecturer_courses_v1(p_application_id uuid,p_offering_ids uuid[],p_revision integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); a public.lecturer_applications;
begin
  perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where id=p_application_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if exists(select 1 from private.lecturer_application_reviews where application_id=a.id and actor_id=v_uid and request_key=p_request_key and action='courses_assigned') then return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key); end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status<>'approved' or not exists(select 1 from public.user_roles where user_id=a.user_id and role='lecturer') then perform private.raise_error('INVALID_STATE','Approve the lecturer before assigning courses.'); end if;
  if coalesce(cardinality(p_offering_ids),0)>100 or exists(select 1 from unnest(p_offering_ids) x(id) where not exists(select 1 from public.course_offerings o where o.id=x.id and o.status='published')) then perform private.raise_error('VALIDATION_FAILED'); end if;
  delete from public.lecturer_course_assignments where user_id=a.user_id;
  insert into public.lecturer_course_assignments(user_id,offering_id,assigned_by) select a.user_id,x,v_uid from unnest(coalesce(p_offering_ids,'{}'::uuid[])) x on conflict do nothing;
  update public.lecturer_applications set revision=revision+1,updated_at=now() where id=a.id;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,request_key) values(a.id,v_uid,'courses_assigned',p_request_key);
  perform private.audit(v_uid,'assign_lecturer_courses','lecturer_application',a.id,p_request_key);
  return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key);
end $$;
create or replace function public.get_my_lecturer_courses_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if not exists(select 1 from public.user_roles r join public.lecturer_applications a on a.user_id=r.user_id join auth.users u on u.id=r.user_id where r.user_id=v_uid and r.role='lecturer' and a.status='approved' and u.email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','Approved lecturer access required.'); end if;
  return private.envelope(jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'university',u.name,'department',d.name,'semester',s.label,'period',ap.label) order by c.code,o.id) from public.lecturer_course_assignments x join public.course_offerings o on o.id=x.offering_id join public.courses c on c.id=o.course_id join public.universities u on u.id=o.university_id join public.departments d on d.id=o.department_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id where x.user_id=v_uid and o.status='published'),'[]'::jsonb)));
end $$;

-- Restrict all helpers, including functions created under a privileged migration role.
revoke all on function private.validate_lecturer_application(jsonb),private.handle_new_user(),private.create_user_points(),private.guard_lecturer_identity(),private.guard_lecturer_role(),private.lecturer_application_payload(uuid,boolean) from public,anon,authenticated;
revoke all on function public.get_my_lecturer_application_v1(),public.resubmit_lecturer_application_v1(jsonb,integer,uuid),public.admin_list_lecturer_applications_v1(text,text,integer,integer),public.admin_get_lecturer_application_v1(uuid),public.admin_review_lecturer_application_v1(uuid,text,text,text,uuid[],integer,uuid),public.admin_get_lecturer_offerings_v1(),public.admin_assign_lecturer_courses_v1(uuid,uuid[],integer,uuid),public.get_my_lecturer_courses_v1() from public,anon,authenticated;
insert into public.app_config(platform,feature_flags) values('web','{"lecturer_applications":true}'::jsonb) on conflict(platform) do update set feature_flags=public.app_config.feature_flags||excluded.feature_flags;
grant execute on function public.get_my_lecturer_application_v1(),public.resubmit_lecturer_application_v1(jsonb,integer,uuid),public.admin_list_lecturer_applications_v1(text,text,integer,integer),public.admin_get_lecturer_application_v1(uuid),public.admin_review_lecturer_application_v1(uuid,text,text,text,uuid[],integer,uuid),public.admin_get_lecturer_offerings_v1(),public.admin_assign_lecturer_courses_v1(uuid,uuid[],integer,uuid),public.get_my_lecturer_courses_v1() to authenticated;

