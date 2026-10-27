-- Public academic names only. Course requests never grant teaching assignments.
create or replace function public.get_lecturer_registration_courses_v1(
  p_university_id uuid, p_faculty_id uuid, p_department_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title)
    order by c.code, c.title), '[]'::jsonb)
  from public.courses c
  where c.active and exists (
    select 1 from public.universities u
    join public.faculties f on f.university_id=u.id and f.active
    join public.departments d on d.university_id=u.id and d.faculty_id=f.id and d.active
    where u.id=p_university_id and u.active and f.id=p_faculty_id and d.id=p_department_id
    and (
      exists (select 1 from public.curriculum_courses cc
        join public.levels l on l.id=cc.level_id and l.university_id=u.id and l.active
        where cc.university_id=u.id and cc.department_id=d.id and cc.course_id=c.id and cc.active)
      or exists (select 1 from public.course_offerings o
        join public.levels l on l.id=o.level_id and l.university_id=u.id and l.active
        join public.semesters s on s.id=o.semester_id and s.university_id=u.id and s.active
        join public.academic_periods a on a.id=s.academic_period_id and a.active
        where o.university_id=u.id and o.department_id=d.id and o.course_id=c.id and o.status='published')
    )
  );
$$;
revoke all on function public.get_lecturer_registration_courses_v1(uuid,uuid,uuid) from public;
grant execute on function public.get_lecturer_registration_courses_v1(uuid,uuid,uuid) to anon,authenticated;
