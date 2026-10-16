-- Assign required courses from the validated academic profile; electives remain explicit choices.
create or replace function private.assign_required_courses(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.enrollments(user_id, offering_id)
  select p.id, o.id
  from public.profiles p
  join public.universities u on u.id=p.university_id and u.active
  join public.faculties f on f.id=p.faculty_id and f.active
  join public.departments d on d.id=p.department_id and d.active
  join public.levels l on l.id=p.level_id and l.active
  join public.academic_periods ap on ap.id=p.academic_period_id and ap.active
  join public.semesters s on s.id=p.semester_id and s.active
  join public.course_offerings o on
    (o.university_id,o.department_id,o.level_id,o.semester_id)=
    (p.university_id,p.department_id,p.level_id,p.semester_id)
  join public.courses c on c.id=o.course_id and c.active
  where p.id=p_user_id and p.deactivated_at is null
    and o.status='published' and o.elective_group is null
    and coalesce(o.requirement_status,'C') <> 'E'
  on conflict(user_id,offering_id) do update
    set ended_at=null, enrolled_at=now()
    where public.enrollments.ended_at is not null;
$$;

create or replace function private.profile_assign_courses()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.assign_required_courses(new.id);
  return new;
end;
$$;
create trigger profile_assign_courses after insert or update of university_id,faculty_id,
  department_id,level_id,academic_period_id,semester_id,deactivated_at on public.profiles
  for each row execute function private.profile_assign_courses();

-- Publishing a course also reaches students who completed signup before it existed.
create or replace function private.offering_assign_courses()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.status='published' then
    for r in select p.id from public.profiles p where
      (p.university_id,p.department_id,p.level_id,p.semester_id)=
      (new.university_id,new.department_id,new.level_id,new.semester_id)
      and p.deactivated_at is null order by p.id
    loop perform private.assign_required_courses(r.id); end loop;
  end if;
  return new;
end;
$$;
create trigger offering_assign_courses after insert or update of status,university_id,
  department_id,level_id,semester_id,course_id,requirement_status,elective_group on public.course_offerings
  for each row execute function private.offering_assign_courses();

revoke all on function private.assign_required_courses(uuid),private.profile_assign_courses(),
  private.offering_assign_courses() from public,anon,authenticated;

-- Existing students gain matching required courses without losing progress or elective choices.
do $$ declare r record; begin
  for r in select id from public.profiles where university_id is not null and deactivated_at is null order by id
  loop perform private.assign_required_courses(r.id); end loop;
end $$;
