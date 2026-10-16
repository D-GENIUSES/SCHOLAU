-- GoTrue inserts users, updates app_metadata, then confirms email in one transaction.
-- Prepare an unprivileged profile at INSERT; finalize only from trusted app_metadata.
-- A deferred check prevents any unfinalized managed signup from committing.
alter table private.admin_created_accounts add column finalized boolean not null default true;
alter table private.admin_created_accounts add column creation_transaction bigint;
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_kind text; a jsonb;
begin
  if new.raw_user_meta_data->>'signup_kind'='admin_managed' then
    v_kind:=case when new.raw_user_meta_data->>'managed_role'='lecturer' then 'lecturer_applicant' else 'student' end;
    v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
    if length(v_name) not between 2 and 60 then perform private.raise_error('VALIDATION_FAILED','Enter a valid name.'); end if;
    insert into public.profiles(id,display_name,registration_kind,leaderboard_visible) values(new.id,v_name,v_kind,v_kind='student');
    insert into private.admin_created_accounts(user_id,role,request_key,finalized,creation_transaction)
      values(new.id,case when v_kind='student' then 'student' else 'lecturer' end,gen_random_uuid(),false,txid_current());
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

create function private.finalize_admin_created_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare m jsonb:=new.raw_app_meta_data->'scholau_provision'; actor uuid; account_role text; req uuid; pending private.admin_created_accounts%rowtype;
begin
  if m is null or new.email_confirmed_at is null then return new; end if;
  select * into pending from private.admin_created_accounts where user_id=new.id for update;
  if found and pending.finalized then return new; end if;
  if pending.user_id is null or pending.creation_transaction is distinct from txid_current() then
    perform private.raise_error('FORBIDDEN','Managed accounts must be provisioned during creation.');
  end if;
  actor:=(m->>'actor_id')::uuid; account_role:=m->>'role'; req:=(m->>'request_key')::uuid;
  if actor is null or not private.user_is_admin(actor) then perform private.raise_error('FORBIDDEN','Active administrator required.'); end if;
  if account_role is null or account_role not in ('student','lecturer') or account_role<>pending.role or req is null then
    perform private.raise_error('VALIDATION_FAILED','Invalid managed account details.');
  end if;
  update private.admin_created_accounts set created_by=actor,request_key=req,finalized=true where user_id=new.id;
  insert into public.user_roles(user_id,role) values(new.id,account_role);
  perform private.audit(actor,'create_user','profile',new.id,req,null,jsonb_build_object('role',account_role));
  return new;
end $$;
create trigger admin_creation_finalize after update of raw_app_meta_data,email_confirmed_at on auth.users
for each row execute function private.finalize_admin_created_user();
create function private.assert_admin_creation_complete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.raw_user_meta_data->>'signup_kind'='admin_managed' and exists(select 1 from auth.users where id=new.id)
    and not exists(select 1 from private.admin_created_accounts where user_id=new.id and finalized) then
    perform private.raise_error('VALIDATION_FAILED','Managed account creation was not completed.');
  end if;
  return null;
end $$;
create constraint trigger admin_creation_complete after insert on auth.users deferrable initially deferred
for each row execute function private.assert_admin_creation_complete();
revoke all on function private.finalize_admin_created_user(),private.assert_admin_creation_complete(),private.handle_new_user() from public,anon,authenticated;
create or replace function private.guard_lecturer_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.role='lecturer' and not exists(select 1 from private.admin_created_accounts m join auth.users u on u.id=m.user_id where m.user_id=new.user_id and m.role='lecturer' and m.finalized and u.email_confirmed_at is not null) and not exists(select 1 from public.lecturer_applications a join auth.users u on u.id=a.user_id where a.user_id=new.user_id and a.status='approved' and u.email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN','An approved, verified lecturer application is required.');
  end if;
  if new.role='student' and exists(select 1 from public.profiles p where p.id=new.user_id and p.registration_kind='lecturer_applicant') then
    perform private.raise_error('FORBIDDEN','A lecturer applicant cannot be granted student access.');
  end if;
  return new;
end $$;

create or replace function public.get_my_lecturer_courses_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_user();
begin
  if not exists(select 1 from private.admin_created_accounts m join public.user_roles r on r.user_id=m.user_id and r.role='lecturer' join auth.users u on u.id=m.user_id where m.user_id=v_uid and m.role='lecturer' and m.finalized and u.email_confirmed_at is not null) and not exists(select 1 from public.user_roles r join public.lecturer_applications a on a.user_id=r.user_id join auth.users u on u.id=r.user_id where r.user_id=v_uid and r.role='lecturer' and a.status='approved' and u.email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','Approved lecturer access required.'); end if;
  return private.envelope(jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'university',u.name,'department',d.name,'semester',s.label,'period',ap.label) order by c.code,o.id) from public.lecturer_course_assignments x join public.course_offerings o on o.id=x.offering_id join public.courses c on c.id=o.course_id join public.universities u on u.id=o.university_id join public.departments d on d.id=o.department_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id where x.user_id=v_uid and o.status='published'),'[]'::jsonb)));
end $$;

