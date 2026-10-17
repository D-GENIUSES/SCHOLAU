-- Administrator-only account directory and lifecycle. No credentials are returned.
create function private.admin_user_payload(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',u.id,'email',u.email,'display_name',p.display_name,
 'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'email_verified',u.email_confirmed_at is not null,
 'deactivated_at',p.deactivated_at,'updated_at',p.updated_at,'has_profile',p.id is not null,
 'category',case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end,
 'roles',coalesce((select jsonb_agg(role order by role) from public.user_roles where user_id=u.id),'[]'::jsonb),
 'application_status',(select status from public.lecturer_applications where user_id=u.id),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'status',o.status) order by c.code,o.id)
 from public.lecturer_course_assignments a join public.course_offerings o on o.id=a.offering_id join public.courses c on c.id=o.course_id where a.user_id=u.id),'[]'::jsonb))
from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
$$;

create function public.admin_list_users_v1(p_category text default null,p_status text default null,p_search text default '',p_offset integer default 0,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb; total bigint;
begin
 if p_category is not null and p_category not in ('student','lecturer','other') or p_status is not null and p_status not in ('active','frozen')
 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(coalesce(p_search,''))>200 then perform private.raise_error('VALIDATION_FAILED'); end if;
 with filtered as (
 select u.id,u.created_at from auth.users u left join public.profiles p on p.id=u.id
 where (p_category is null or p_category=case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end)
 and (p_status is null or p_status=case when p.deactivated_at is null then 'active' else 'frozen' end)
 and (coalesce(btrim(p_search),'')='' or strpos(lower(coalesce(u.email,'')||' '||coalesce(p.display_name,'')),lower(btrim(p_search)))>0)
 ), page as (select * from filtered order by created_at desc nulls last,id limit p_limit offset p_offset)
 select (select count(*) from filtered),coalesce((select jsonb_agg(private.admin_user_payload(id) order by created_at desc nulls last,id) from page),'[]'::jsonb) into total,result;
 return private.envelope(jsonb_build_object('items',result,'total',total));
end $$;

create function public.admin_get_user_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); result jsonb;
begin
 result:=private.admin_user_payload(p_user_id);
 if result is null then perform private.raise_error('NOT_FOUND'); end if;
 return private.envelope(jsonb_build_object('user',result));
end $$;

-- Serializes directory mutations and rejects stale account details and protected admins.
create function private.lock_managed_target(p_user_id uuid,p_expected_updated_at timestamptz,p_protect_admin boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 select * into target from public.profiles where id=p_user_id for update;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 if p_protect_admin and (p_user_id=auth.uid() or exists(select 1 from public.user_roles where user_id=p_user_id and role='admin')) then perform private.raise_error('FORBIDDEN','Administrator accounts are protected.'); end if;
 if p_expected_updated_at is null or target.updated_at is distinct from p_expected_updated_at then perform private.raise_error('STALE_REVISION'); end if;
end $$;

create function public.admin_set_user_frozen_v1(p_user_id uuid,p_frozen boolean,p_expected_updated_at timestamptz,p_reason text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin();
begin
 perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
 if exists(select 1 from private.audit_log where actor_id=actor and action='set_user_frozen' and request_key=p_request_key and entity_id is distinct from p_user_id) then perform private.raise_error('VALIDATION_FAILED','Request key already belongs to another account.'); end if;
 if exists(select 1 from private.audit_log where actor_id=actor and action='set_user_frozen' and request_key=p_request_key and (safe_metadata->>'frozen')::boolean is distinct from p_frozen) then perform private.raise_error('VALIDATION_FAILED'); end if;
 if exists(select 1 from private.audit_log where actor_id=actor and action='set_user_frozen' and request_key=p_request_key and entity_id=p_user_id) then return private.envelope(jsonb_build_object('user',private.admin_user_payload(p_user_id)),p_request_key); end if;
 if p_frozen is null or length(btrim(coalesce(p_reason,''))) not between 3 and 500 then perform private.raise_error('VALIDATION_FAILED'); end if;
 perform private.lock_managed_target(p_user_id,p_expected_updated_at);
 update public.profiles set deactivated_at=case when p_frozen then coalesce(deactivated_at,now()) else null end where id=p_user_id;
 perform private.audit(actor,'set_user_frozen','profile',p_user_id,p_request_key,p_reason,jsonb_build_object('frozen',p_frozen));
 return private.envelope(jsonb_build_object('user',private.admin_user_payload(p_user_id)),p_request_key);
end $$;

create function public.admin_set_user_courses_v1(p_user_id uuid,p_offering_ids uuid[],p_expected_offering_ids uuid[],p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); current_ids uuid[]; wanted uuid[]; expected uuid[]; app public.lecturer_applications;
begin
 perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
 perform 1 from public.profiles where id=p_user_id and deactivated_at is null for update;
 if not found then perform private.raise_error('INVALID_STATE','An active lecturer account is required.'); end if;
 select * into app from public.lecturer_applications where user_id=p_user_id for update;
 if exists(select 1 from private.audit_log where actor_id=actor and action='set_user_courses' and request_key=p_request_key and entity_id is distinct from p_user_id) then perform private.raise_error('VALIDATION_FAILED','Request key already belongs to another account.'); end if;
 if exists(select 1 from private.audit_log where actor_id=actor and action='set_user_courses' and request_key=p_request_key and entity_id=p_user_id) then return private.envelope(jsonb_build_object('user',private.admin_user_payload(p_user_id)),p_request_key); end if;
 if not exists(select 1 from public.user_roles where user_id=p_user_id and role='lecturer') or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','Approved lecturer access is required.'); end if;
 if p_offering_ids is null or p_expected_offering_ids is null or cardinality(p_offering_ids)>100 or array_position(p_offering_ids,null) is not null then perform private.raise_error('VALIDATION_FAILED'); end if;
 select coalesce(array_agg(offering_id order by offering_id),'{}') into current_ids from public.lecturer_course_assignments where user_id=p_user_id;
 select coalesce(array_agg(distinct x order by x),'{}') into expected from unnest(p_expected_offering_ids) x;
 if expected is distinct from current_ids then perform private.raise_error('STALE_REVISION'); end if;
 select coalesce(array_agg(distinct x order by x),'{}') into wanted from unnest(p_offering_ids) x;
 if exists(select 1 from unnest(wanted) x where not exists(select 1 from public.course_offerings where id=x and (status='published' or x=any(current_ids)))) then perform private.raise_error('VALIDATION_FAILED','Choose published course offerings.'); end if;
 delete from public.lecturer_course_assignments where user_id=p_user_id and not(offering_id=any(wanted));
 insert into public.lecturer_course_assignments(user_id,offering_id,assigned_by) select p_user_id,x,actor from unnest(wanted) x on conflict do nothing;
 if app.id is not null then
  update public.lecturer_applications set revision=revision+1,updated_at=now() where id=app.id;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,request_key) values(app.id,actor,'courses_assigned',p_request_key);
 end if;
 perform private.audit(actor,'set_user_courses','profile',p_user_id,p_request_key,null,jsonb_build_object('offering_ids',to_jsonb(wanted)));
 return private.envelope(jsonb_build_object('user',private.admin_user_payload(p_user_id)),p_request_key);
end $$;

create function public.admin_delete_user_v1(p_user_id uuid,p_confirm_email text,p_expected_updated_at timestamptz,p_reason text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_admin(); target_email text;
begin
 perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
 if exists(select 1 from private.audit_log where actor_id=actor and action='delete_user' and request_key=p_request_key and entity_id is distinct from p_user_id) then perform private.raise_error('VALIDATION_FAILED','Request key already belongs to another account.'); end if;
 if exists(select 1 from private.audit_log where actor_id=actor and action='delete_user' and request_key=p_request_key and entity_id=p_user_id) then return private.envelope(jsonb_build_object('deleted',true),p_request_key); end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 500 then perform private.raise_error('VALIDATION_FAILED'); end if;
 -- Lock Auth first, matching the existing Auth deletion/erasure trigger's lock order.
 select email into target_email from auth.users where id=p_user_id for update;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 perform private.lock_managed_target(p_user_id,p_expected_updated_at);
 if nullif(btrim(p_confirm_email),'') is null or lower(btrim(p_confirm_email)) is distinct from lower(target_email) then perform private.raise_error('VALIDATION_FAILED','Type the account email to confirm deletion.'); end if;
 -- Existing BEFORE DELETE erasure handles student progress, attribution, roles and profile.
 -- Auth's own foreign keys cascade identities and sessions. Any failure rolls everything back.
 delete from auth.users where id=p_user_id;
 perform private.audit(actor,'delete_user','account',p_user_id,p_request_key,p_reason);
 return private.envelope(jsonb_build_object('deleted',true),p_request_key);
end $$;

-- Suspensions also block direct RLS reads by a previously issued JWT.
create function authz.is_active_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and deactivated_at is null)
$$;
revoke all on function authz.is_active_user() from public,anon,authenticated;
grant execute on function authz.is_active_user() to authenticated;
do $$ declare t record; begin
 for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname not in ('universities','faculties','departments','levels','academic_periods','semesters','app_config','courses','course_offerings','battle_rules') loop
  execute format('create policy active_account_required on public.%I as restrictive for select to authenticated using ((select authz.is_active_user()))',t.relname);
 end loop;
end $$;
revoke all on function private.admin_user_payload(uuid),private.lock_managed_target(uuid,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.admin_list_users_v1(text,text,text,integer,integer),public.admin_get_user_v1(uuid),public.admin_set_user_frozen_v1(uuid,boolean,timestamptz,text,uuid),public.admin_set_user_courses_v1(uuid,uuid[],uuid[],uuid),public.admin_delete_user_v1(uuid,text,timestamptz,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_list_users_v1(text,text,text,integer,integer),public.admin_get_user_v1(uuid),public.admin_set_user_frozen_v1(uuid,boolean,timestamptz,text,uuid),public.admin_set_user_courses_v1(uuid,uuid[],uuid[],uuid),public.admin_delete_user_v1(uuid,text,timestamptz,text,uuid) to authenticated;

-- Serializes role grants against account suspension/deletion.
create or replace function private.guard_lecturer_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=new.user_id for update;
  if new.role='lecturer' and not exists(select 1 from private.admin_created_accounts m join auth.users u on u.id=m.user_id where m.user_id=new.user_id and m.role='lecturer' and m.finalized and u.email_confirmed_at is not null) and not exists(select 1 from public.lecturer_applications a join auth.users u on u.id=a.user_id where a.user_id=new.user_id and a.status='approved' and u.email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN','An approved, verified lecturer application is required.');
  end if;
  if new.role='student' and exists(select 1 from public.profiles p where p.id=new.user_id and p.registration_kind='lecturer_applicant') then
    perform private.raise_error('FORBIDDEN','A lecturer applicant cannot be granted student access.');
  end if;
  return new;
end $$;

