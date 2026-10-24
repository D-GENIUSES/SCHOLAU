-- Notify every active administrator (inbox + web push) when a self-service user finishes registration.
begin;

create function private.notify_admins_user_registered(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if exists (select 1 from private.admin_created_accounts where user_id = p_user_id) then
    return;
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and registration_kind = 'lecturer_applicant'
  ) then
    return;
  end if;
  select display_name into v_name from public.profiles where id = p_user_id and deactivated_at is null;
  if not found then
    return;
  end if;
  insert into private.notification_recipients(
    event_key, user_id, kind, title, body, target, category, context
  )
  select
    'user_registered:' || p_user_id,
    r.user_id,
    'user_registered',
    'New user signup',
    format('A new user signed up as %s.', v_name),
    '/admin/users',
    'account',
    jsonb_build_object('admin_only', true, 'registered_user_id', p_user_id)
  from public.user_roles r
  join public.profiles p on p.id = r.user_id
  where r.role = 'admin'
    and p.deactivated_at is null
    and r.user_id <> p_user_id
  on conflict do nothing;
end;
$$;

create or replace function private.record_registration_legal(p_user_id uuid, p_email text, m jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.legal_settings%rowtype;
begin
  select * into s from private.legal_settings where singleton;
  if s.singleton is null
    or m->'terms_accepted' is distinct from 'true'::jsonb
    or m->>'terms_version' is distinct from s.terms_version
    or m->>'privacy_version' is distinct from s.privacy_version then
    raise exception using errcode = 'P0001', message = 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  insert into private.legal_acceptances(user_id, terms_version, privacy_version, age_declaration, guardian_consent_id)
    values (p_user_id, s.terms_version, s.privacy_version, 'adult', null);
  perform private.notify_admins_user_registered(p_user_id);
end;
$$;

revoke all on function private.notify_admins_user_registered(uuid) from public, anon, authenticated, service_role;

commit;
