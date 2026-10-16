-- Trusted Auth app_metadata is written only by the server's Auth Admin API.
-- No existing accounts, enrollments, applications or passwords are modified.
create table private.admin_created_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  role text not null check(role in ('student','lecturer')),
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique(created_by,request_key)
);
alter table private.admin_created_accounts enable row level security;
revoke all on private.admin_created_accounts from public,anon,authenticated;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_kind text; a jsonb; m jsonb; actor uuid; managed_role text; request_key uuid;
begin
  m:=new.raw_app_meta_data->'scholau_provision';
  if m is not null then
    actor:=(m->>'actor_id')::uuid; managed_role:=m->>'role'; request_key:=(m->>'request_key')::uuid;
    if actor is null or not private.user_is_admin(actor) then perform private.raise_error('FORBIDDEN','Active administrator required.'); end if;
    if managed_role is null or managed_role not in ('student','lecturer') or request_key is null then perform private.raise_error('VALIDATION_FAILED','Invalid managed account details.'); end if;
    if new.email_confirmed_at is null then perform private.raise_error('VALIDATION_FAILED','Administrator-created accounts must be confirmed.'); end if;
    v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
    if length(v_name) not between 2 and 60 then perform private.raise_error('VALIDATION_FAILED','Enter a valid name.'); end if;
    insert into public.profiles(id,display_name,registration_kind,leaderboard_visible)
      values(new.id,v_name,case when managed_role='lecturer' then 'lecturer_applicant' else 'student' end,managed_role='student');
    insert into private.admin_created_accounts(user_id,created_by,role,request_key) values(new.id,actor,managed_role,request_key);
    insert into public.user_roles(user_id,role) values(new.id,managed_role);
    perform private.audit(actor,'create_user','profile',new.id,request_key,null,jsonb_build_object('role',managed_role));
    return new;
  end if;
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
create or replace function private.guard_lecturer_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.role='lecturer' and not exists(select 1 from private.admin_created_accounts m join auth.users u on u.id=m.user_id where m.user_id=new.user_id and m.role='lecturer' and u.email_confirmed_at is not null) and not exists(select 1 from public.lecturer_applications a join auth.users u on u.id=a.user_id where a.user_id=new.user_id and a.status='approved' and u.email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN','An approved, verified lecturer application is required.');
  end if;
  if new.role='student' and exists(select 1 from public.profiles p where p.id=new.user_id and p.registration_kind='lecturer_applicant') then
    perform private.raise_error('FORBIDDEN','A lecturer applicant cannot be granted student access.');
  end if;
  return new;
end $$;

create function public.admin_user_creation_access_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
begin return jsonb_build_object('actor_id',private.require_admin()); end $$;
revoke all on function public.admin_user_creation_access_v1() from public,anon,authenticated;
grant execute on function public.admin_user_creation_access_v1() to authenticated;
revoke all on function private.handle_new_user(),private.guard_lecturer_role() from public,anon,authenticated;

create or replace function public.get_my_lecturer_courses_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if not exists(select 1 from private.admin_created_accounts m join public.user_roles r on r.user_id=m.user_id and r.role='lecturer' join auth.users u on u.id=m.user_id where m.user_id=v_uid and m.role='lecturer' and u.email_confirmed_at is not null) and not exists(select 1 from public.user_roles r join public.lecturer_applications a on a.user_id=r.user_id join auth.users u on u.id=r.user_id where r.user_id=v_uid and r.role='lecturer' and a.status='approved' and u.email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','Approved lecturer access required.'); end if;
  return private.envelope(jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'university',u.name,'department',d.name,'semester',s.label,'period',ap.label) order by c.code,o.id) from public.lecturer_course_assignments x join public.course_offerings o on o.id=x.offering_id join public.courses c on c.id=o.course_id join public.universities u on u.id=o.university_id join public.departments d on d.id=o.department_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id where x.user_id=v_uid and o.status='published'),'[]'::jsonb)));
end $$;

