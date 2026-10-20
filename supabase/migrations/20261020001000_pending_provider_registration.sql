-- OAuth cannot send application consent metadata before GoTrue inserts its user.
-- Keep those accounts pending until the actual user completes the in-app form.
begin;
create table private.pending_registrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  kind text not null check(kind in ('google','managed')),
  leaderboard_visible boolean not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table private.pending_registrations enable row level security;
revoke all on private.pending_registrations from public,anon,authenticated,service_role;

create function private.record_registration_legal(p_user_id uuid,p_email text,m jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s private.legal_settings%rowtype; g private.guardian_consents%rowtype; age text; approval uuid;
begin
  select * into s from private.legal_settings where singleton;
  age:=m->>'age_declaration';
  if s.singleton is null or m->'terms_accepted' is distinct from 'true'::jsonb
    or m->>'terms_version' is distinct from s.terms_version
    or m->>'privacy_version' is distinct from s.privacy_version
    or age is null or age not in ('adult','under18') then
    raise exception using errcode='P0001',message='LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  if age='under18' then
    if not private.guardian_registration_ready() then
      raise exception using errcode='P0001',message='GUARDIAN_REGISTRATION_CLOSED';
    end if;
    begin approval:=(m->>'guardian_approval')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode='P0001',message='GUARDIAN_APPROVAL_REQUIRED';
    end;
    select * into g from private.guardian_consents where id=approval for update;
    if g.id is null or g.status<>'approved' or g.user_id is not null
      or g.expires_at<=clock_timestamp() or g.applicant_email is distinct from lower(btrim(p_email))
      or g.terms_version<>s.terms_version or g.privacy_version<>s.privacy_version then
      raise exception using errcode='P0001',message='GUARDIAN_APPROVAL_REQUIRED';
    end if;
    update private.guardian_consents set user_id=p_user_id,consumed_at=clock_timestamp() where id=g.id;
  end if;
  insert into private.legal_acceptances(user_id,terms_version,privacy_version,age_declaration,guardian_consent_id)
    values(p_user_id,s.terms_version,s.privacy_version,age,case when age='under18' then g.id else null end);
end $$;

create or replace function private.capture_registration_legal() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  -- app_metadata is set by GoTrue, unlike editable user_metadata.
  if new.raw_app_meta_data->>'provider'='google' then kind:='google';
  elsif new.raw_user_meta_data->>'signup_kind'='admin_managed'
    and new.raw_user_meta_data->'terms_accepted' is distinct from 'true'::jsonb
    and exists(select 1 from private.admin_created_accounts where user_id=new.id and creation_transaction=txid_current()) then
    -- The existing deferred provisioning trigger still requires trusted admin
    -- app_metadata and successful finalization before this transaction commits.
    kind:='managed';
  end if;
  if kind is not null then
    insert into private.pending_registrations(user_id,kind,leaderboard_visible)
      select new.id,kind,leaderboard_visible from public.profiles where id=new.id;
    update public.profiles set leaderboard_visible=false where id=new.id;
  else
    perform private.record_registration_legal(new.id,new.email,coalesce(new.raw_user_meta_data,'{}'::jsonb));
  end if;
  return new;
end $$;

create or replace function private.require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_deactivated timestamptz;
begin
  if v_uid is null then perform private.raise_error('UNAUTHENTICATED'); end if;
  select deactivated_at into v_deactivated from public.profiles where id=v_uid;
  if not found then perform private.raise_error('UNAUTHENTICATED','No ScholAu profile exists for this session.'); end if;
  if v_deactivated is not null then perform private.raise_error('FORBIDDEN','This account is deactivated.'); end if;
  if exists(select 1 from private.pending_registrations where user_id=v_uid) then
    perform private.raise_error('INVALID_STATE','Complete your registration to continue.',jsonb_build_object('registration_required',true));
  end if;
  return v_uid;
end $$;

create or replace function authz.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from private.pending_registrations where user_id=auth.uid())
    and exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
      where r.user_id=auth.uid() and r.role='admin' and p.deactivated_at is null)
$$;
create or replace function authz.is_enrolled_in_course(p_course_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from private.pending_registrations where user_id=auth.uid())
    and exists(select 1 from public.enrollments e join public.course_offerings o on o.id=e.offering_id
      join public.profiles p on p.id=e.user_id where e.user_id=auth.uid() and e.ended_at is null
      and o.course_id=p_course_id and o.status='published' and p.deactivated_at is null)
$$;
-- Preserve the current realtime topic rules while adding the registration gate.
do $$
declare definition text;
begin
  select pg_get_functiondef('authz.can_access_topic(text)'::regprocedure) into definition;
  if strpos(definition,'if v_uid is null or p_topic is null then')=0 then raise exception 'Unexpected topic authorization definition'; end if;
  execute replace(definition,'if v_uid is null or p_topic is null then',
    'if v_uid is null or p_topic is null or exists(select 1 from private.pending_registrations where user_id=v_uid) then');
end $$;

create function public.get_my_registration_status_v1() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null or not exists(select 1 from public.profiles where id=uid and deactivated_at is null) then
    perform private.raise_error('UNAUTHENTICATED');
  end if;
  return jsonb_build_object('pending',exists(select 1 from private.pending_registrations where user_id=uid));
end $$;

create function public.complete_registration_v1(p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); account_email text; pending private.pending_registrations%rowtype;
begin
  select u.email into account_email from auth.users u join public.profiles p on p.id=u.id
    where u.id=uid and u.email_confirmed_at is not null and p.deactivated_at is null;
  if account_email is null then perform private.raise_error('UNAUTHENTICATED'); end if;
  select * into pending from private.pending_registrations where user_id=uid for update;
  if not found then
    if exists(select 1 from private.legal_acceptances where user_id=uid) then return jsonb_build_object('completed',true); end if;
    perform private.raise_error('INVALID_STATE','This account does not have a pending registration.');
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object' or octet_length(p_metadata::text)>2048 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  perform private.record_registration_legal(uid,account_email,p_metadata);
  update public.profiles set leaderboard_visible=pending.leaderboard_visible where id=uid;
  delete from private.pending_registrations where user_id=uid;
  return jsonb_build_object('completed',true);
end $$;

revoke all on function private.record_registration_legal(uuid,text,jsonb),private.capture_registration_legal(),private.require_user() from public,anon,authenticated,service_role;
revoke all on function public.get_my_registration_status_v1(),public.complete_registration_v1(jsonb) from public,anon,service_role;
grant execute on function public.get_my_registration_status_v1(),public.complete_registration_v1(jsonb) to authenticated;
commit;
