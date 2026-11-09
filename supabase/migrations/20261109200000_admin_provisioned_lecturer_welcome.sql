-- Admin-provisioned lecturers have registration_kind lecturer_applicant but no approved application row.
begin;

create or replace function private.enqueue_registration_welcome(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.welcome_email_events(user_id)
  select p.id from public.profiles p
  where p.id = p_user_id and p.deactivated_at is null
    and private.registration_is_visible(p.id)
    and exists (select 1 from private.legal_acceptances where user_id = p.id)
    and (
      p.registration_kind <> 'lecturer_applicant'
      or exists (select 1 from public.lecturer_applications where user_id = p.id and status = 'approved')
      or exists (
        select 1 from private.admin_created_accounts m
        where m.user_id = p.id and m.role = 'lecturer' and m.finalized
      )
    )
  on conflict do nothing;
$$;

revoke all on function private.enqueue_registration_welcome(uuid) from public, anon, authenticated, service_role;

commit;
