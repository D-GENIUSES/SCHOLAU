-- Admin-created lecturers receive credentials by email at provisioning time, not via the registration outbox.
begin;

create or replace function private.enqueue_registration_welcome(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.welcome_email_events(user_id)
  select p.id from public.profiles p
  where p.id = p_user_id and p.deactivated_at is null
    and private.registration_is_visible(p.id)
    and exists (select 1 from private.legal_acceptances where user_id = p.id)
    and not exists (
      select 1 from private.admin_created_accounts m
      where m.user_id = p.id and m.role = 'lecturer'
    )
    and (
      p.registration_kind <> 'lecturer_applicant'
      or exists (
        select 1 from public.lecturer_applications where user_id = p.id and status = 'approved'
      )
    )
  on conflict do nothing;
$$;

create function public.admin_provision_welcome_eligible_v1(p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from private.admin_created_accounts m
    join auth.users u on u.id = m.user_id
    where m.user_id = p_user_id and m.role = 'lecturer' and m.finalized
      and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null
  );
$$;

revoke all on function public.admin_provision_welcome_eligible_v1(uuid) from public, anon, authenticated;
grant execute on function public.admin_provision_welcome_eligible_v1(uuid) to service_role;

commit;
