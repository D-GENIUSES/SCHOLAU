-- Course picker for Gemini ingestion: lecturers see assignments; admins see all published offerings.

create or replace function public.get_material_ingestion_offerings_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_is_admin boolean;
  v_is_lecturer boolean;
  v_items jsonb;
begin
  v_is_admin := exists(select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'admin');
  v_is_lecturer := exists(
    select 1 from public.user_roles r
    join public.lecturer_applications a on a.user_id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.user_id = v_uid and r.role = 'lecturer' and a.status = 'approved' and u.email_confirmed_at is not null
  ) or exists(
    select 1 from private.admin_created_accounts m
    join public.user_roles r on r.user_id = m.user_id and r.role = 'lecturer'
    join auth.users u on u.id = m.user_id
    where m.user_id = v_uid and m.role = 'lecturer' and m.finalized and u.email_confirmed_at is not null
  );

  if not v_is_admin and not v_is_lecturer then
    perform private.raise_error('FORBIDDEN', 'Lecturer or administrator access required.');
  end if;

  if v_is_admin then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'code', c.code, 'title', c.title,
      'university', u.name, 'department', d.name, 'semester', s.label, 'period', ap.label
    ) order by c.code, o.id), '[]'::jsonb) into v_items
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.universities u on u.id = o.university_id
    join public.departments d on d.id = o.department_id
    join public.semesters s on s.id = o.semester_id
    join public.academic_periods ap on ap.id = s.academic_period_id
    where o.status = 'published';
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'code', c.code, 'title', c.title,
      'university', u.name, 'department', d.name, 'semester', s.label, 'period', ap.label
    ) order by c.code, o.id), '[]'::jsonb) into v_items
    from public.lecturer_course_assignments x
    join public.course_offerings o on o.id = x.offering_id
    join public.courses c on c.id = o.course_id
    join public.universities u on u.id = o.university_id
    join public.departments d on d.id = o.department_id
    join public.semesters s on s.id = o.semester_id
    join public.academic_periods ap on ap.id = s.academic_period_id
    where x.user_id = v_uid and o.status = 'published';
  end if;

  return private.envelope(jsonb_build_object('items', v_items, 'role', case when v_is_admin then 'admin' else 'lecturer' end));
end;
$$;

revoke all on function public.get_material_ingestion_offerings_v1() from public, anon;
grant execute on function public.get_material_ingestion_offerings_v1() to authenticated;
