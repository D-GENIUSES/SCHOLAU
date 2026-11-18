-- Preserve the same verified lecturer access paths used by My Courses when
-- checking access to a specific course's content and shared source files.
-- Admin-provisioned lecturers do not have lecturer_applications rows.
create or replace function private.can_manage_ingestion_for_offering(p_uid uuid, p_offering_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_roles r
    where r.user_id = p_uid and r.role = 'admin'
  ) or exists (
    select 1
    from public.user_roles r
    join public.lecturer_course_assignments a on a.user_id = r.user_id
    join auth.users u on u.id = r.user_id and u.email_confirmed_at is not null
    where r.user_id = p_uid
      and r.role = 'lecturer'
      and a.offering_id = p_offering_id
      and (
        exists (
          select 1 from private.admin_created_accounts m
          where m.user_id = p_uid and m.role = 'lecturer' and m.finalized
        )
        or exists (
          select 1 from public.lecturer_applications la
          where la.user_id = p_uid and la.status = 'approved'
        )
      )
  );
$$;
