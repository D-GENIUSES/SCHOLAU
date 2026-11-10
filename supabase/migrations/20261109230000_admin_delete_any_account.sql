-- Allow permanent deletion for any non-admin auth account (student, lecturer, applicant).
begin;

create or replace function private.admin_user_payload(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'display_name', p.display_name,
    'xp_total', coalesce((select total from public.user_points where user_id = u.id), 0),
    'avatar_path', p.avatar_path,
    'registered_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'email_verified', u.email_confirmed_at is not null,
    'deactivated_at', p.deactivated_at,
    'updated_at', coalesce(p.updated_at, u.updated_at),
    'has_profile', p.id is not null,
    'category', case
      when exists (select 1 from public.user_roles where user_id = u.id and role = 'lecturer')
        or p.registration_kind = 'lecturer_applicant' then 'lecturer'
      when exists (select 1 from public.user_roles where user_id = u.id and role = 'student') then 'student'
      else 'other'
    end,
    'roles', coalesce((select jsonb_agg(role order by role) from public.user_roles where user_id = u.id), '[]'::jsonb),
    'application_status', (select status from public.lecturer_applications where user_id = u.id),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'code', c.code, 'title', c.title, 'status', o.status) order by c.code, o.id)
      from public.lecturer_course_assignments a
      join public.course_offerings o on o.id = a.offering_id
      join public.courses c on c.id = o.course_id
      where a.user_id = u.id
    ), '[]'::jsonb)
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
$$;

create or replace function public.admin_delete_user_v1(
  p_user_id uuid, p_confirm_email text, p_expected_updated_at timestamptz, p_reason text, p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.require_admin();
declare target_email text;
declare has_profile boolean;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  if exists (
    select 1 from private.audit_log
    where actor_id = actor and action = 'delete_user' and request_key = p_request_key and entity_id is distinct from p_user_id
  ) then
    perform private.raise_error('VALIDATION_FAILED', 'Request key already belongs to another account.');
  end if;
  if exists (
    select 1 from private.audit_log
    where actor_id = actor and action = 'delete_user' and request_key = p_request_key and entity_id = p_user_id
  ) then
    return private.envelope(jsonb_build_object('deleted', true), p_request_key);
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;

  select email into target_email from auth.users where id = p_user_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;

  select exists (select 1 from public.profiles where id = p_user_id) into has_profile;
  if has_profile then
    perform private.lock_managed_target(p_user_id, p_expected_updated_at);
  else
    if exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
      perform private.raise_error('FORBIDDEN', 'Administrator accounts are protected.');
    end if;
    if p_expected_updated_at is not null and (
      select u.updated_at from auth.users u where u.id = p_user_id
    ) is distinct from p_expected_updated_at then
      perform private.raise_error('STALE_REVISION');
    end if;
  end if;

  if nullif(btrim(p_confirm_email), '') is null
    or lower(btrim(p_confirm_email)) is distinct from lower(target_email) then
    perform private.raise_error('VALIDATION_FAILED', 'Type the account email to confirm deletion.');
  end if;

  delete from auth.users where id = p_user_id;
  perform private.audit(actor, 'delete_user', 'account', p_user_id, p_request_key, p_reason);
  return private.envelope(jsonb_build_object('deleted', true), p_request_key);
end $$;

commit;
