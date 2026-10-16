-- Source: the three user-provided 200-level first-semester curriculum screenshots.
-- Session confirmed by the user: 2026/2027. No calendar dates or learning content were supplied.
-- Preserve unknown dates instead of fabricating a university calendar.
alter table public.academic_periods alter column starts_on drop not null;
alter table public.academic_periods alter column ends_on drop not null;
alter table public.academic_periods add constraint academic_period_dates_together
  check ((starts_on is null) = (ends_on is null));

alter table public.course_offerings add column unit_count integer check (unit_count>0);
alter table public.course_offerings add column requirement_status text check (requirement_status in ('C','R'));

create table public.curriculum_courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  department_id uuid not null,
  level_id uuid not null,
  semester_number integer not null check (semester_number between 1 and 3),
  course_id uuid not null references public.courses(id),
  unit_count integer not null check (unit_count>0),
  requirement_status text not null check (requirement_status in ('C','R')),
  position integer not null check (position>0),
  source_reference text not null,
  active boolean not null default true,
  foreign key(department_id,university_id) references public.departments(id,university_id),
  foreign key(level_id,university_id) references public.levels(id,university_id),
  unique(department_id,level_id,semester_number,course_id)
);
alter table public.curriculum_courses enable row level security;
revoke all on public.curriculum_courses from public,anon,authenticated;
grant select on public.curriculum_courses to authenticated;
create policy curriculum_courses_read on public.curriculum_courses for select to authenticated using (
  authz.is_admin() or (active and exists(select 1 from public.profiles p where p.id=(select auth.uid())
    and (p.university_id,p.department_id,p.level_id)=(curriculum_courses.university_id,curriculum_courses.department_id,curriculum_courses.level_id)))
);

-- Copy the curriculum into matching semester offerings. Safe to repeat and never republishes
-- a deliberately retired/draft existing offering. Learning readiness still requires published content.
create or replace function private.materialize_curriculum(p_semester_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_rows integer; begin
  insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status)
  select cc.course_id,cc.university_id,cc.department_id,cc.level_id,s.id,'published',cc.unit_count,cc.requirement_status
    from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    join public.curriculum_courses cc on cc.university_id=s.university_id and cc.semester_number=s.sort_order and cc.active
    join public.universities u on u.id=cc.university_id and u.active
    join public.departments d on d.id=cc.department_id and d.active
    join public.levels l on l.id=cc.level_id and l.active
    join public.courses c on c.id=cc.course_id and c.active
    where s.id=p_semester_id and s.active
  on conflict(course_id,department_id,level_id,semester_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status;
  get diagnostics v_rows=row_count; return v_rows;
end;
$$;
create or replace function private.semester_curriculum_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.materialize_curriculum(new.id); return new; end;
$$;
revoke all on function private.materialize_curriculum(uuid),private.semester_curriculum_sync() from public,anon,authenticated;
grant execute on function private.materialize_curriculum(uuid) to service_role;
create trigger semester_curriculum_sync after insert or update of active,sort_order on public.semesters
  for each row execute function private.semester_curriculum_sync();

create or replace function private.period_curriculum_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; begin
  if new.active then
    for r in select id from public.semesters where academic_period_id=new.id and active loop
      perform private.materialize_curriculum(r.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.period_curriculum_sync() from public,anon,authenticated;
create trigger period_curriculum_sync after update of active on public.academic_periods
  for each row execute function private.period_curriculum_sync();

do $$
declare v_u uuid; v_f uuid; v_level uuid; v_period uuid; v_semester uuid; r record;
begin
  insert into public.universities(name,slug) values('Adeleke University, Ede, Osun State','adeleke-university-ede-osun-state')
    on conflict(slug) do update set active=true returning id into v_u;
  insert into public.faculties(university_id,name) values(v_u,'Computing Sciences')
    on conflict(university_id,name) do update set active=true returning id into v_f;
  insert into public.departments(university_id,faculty_id,name)
    select v_u,v_f,name from (values('Computer Science'),('Cybersecurity'),('Software Engineering')) p(name)
    on conflict(faculty_id,name) do update set active=true;
  insert into public.levels(university_id,label,sort_order) values(v_u,'200 Level',200)
    on conflict(university_id,label) do update set active=true returning id into v_level;
  insert into public.academic_periods(university_id,label,starts_on,ends_on) values(v_u,'2026/2027',null,null)
    on conflict(university_id,label) do update set active=true returning id into v_period;
  insert into public.semesters(university_id,academic_period_id,label,sort_order) values(v_u,v_period,'First semester',1)
    on conflict(academic_period_id,label) do update set active=true returning id into v_semester;
  insert into public.courses(code,title) values
('AUE-GST 201','Philosophy of Education'),
('AUE-GST 221','Communication in French'),
('ENT 211','Entrepreneurship and Innovation'),
('COS 201','Computer Programming I'),
('CSC 203','Discrete Structures'),
('CYB 201','Introduction to Cybersecurity and Strategy'),
('CYB 203','Cybercrime, Law and Countermeasures'),
('IFT 211','Digital Logic Design'),
('SEN 201','Introduction to Software Engineering'),
('STA 121','Statistical Inference I'),
('MTH 201','Mathematical Methods I')
  on conflict(code) do update set title=excluded.title;
  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference)
  select v_u,d.id,v_level,1,c.id,req.units,req.status,req.position,'User-provided 200 Level First Semester ('||req.programme||') screenshot'
    from (values
('Computer Science','AUE-GST 201',1,'R',1),
('Computer Science','AUE-GST 221',2,'R',2),
('Computer Science','ENT 211',2,'C',3),
('Computer Science','COS 201',3,'C',4),
('Computer Science','CSC 203',2,'C',5),
('Computer Science','CYB 201',2,'C',6),
('Computer Science','IFT 211',2,'C',7),
('Computer Science','SEN 201',2,'C',8),
('Computer Science','STA 121',3,'C',9),
('Computer Science','MTH 201',2,'C',10),
('Cybersecurity','AUE-GST 201',1,'R',1),
('Cybersecurity','AUE-GST 221',2,'R',2),
('Cybersecurity','ENT 211',2,'C',3),
('Cybersecurity','COS 201',3,'C',4),
('Cybersecurity','CYB 201',2,'C',5),
('Cybersecurity','CYB 203',2,'C',6),
('Cybersecurity','SEN 201',2,'C',7),
('Cybersecurity','STA 121',3,'C',8),
('Cybersecurity','MTH 201',2,'C',9),
('Software Engineering','AUE-GST 201',1,'R',1),
('Software Engineering','AUE-GST 221',2,'R',2),
('Software Engineering','ENT 211',2,'C',3),
('Software Engineering','COS 201',3,'C',4),
('Software Engineering','CSC 203',2,'C',5),
('Software Engineering','IFT 211',2,'C',6),
('Software Engineering','SEN 201',2,'C',7),
('Software Engineering','STA 121',3,'C',8),
('Software Engineering','MTH 201',2,'C',9)) req(programme,code,units,status,position)
    join public.departments d on d.faculty_id=v_f and d.name=req.programme
    join public.courses c on c.code=req.code
  on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,
    requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference;
  perform private.materialize_curriculum(v_semester);
end;
$$;

create or replace function public.get_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.university_id is null then
    return private.envelope(jsonb_build_object('needs_onboarding', true, 'offerings', '[]'::jsonb));
  end if;
  return private.envelope(jsonb_build_object(
    'needs_onboarding', false,
    'offerings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'offering_id', o.id,
        'unit_count', o.unit_count, 'requirement_status', o.requirement_status,
        'course', jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'description', c.description),
        'enrolled', exists (select 1 from public.enrollments e where e.user_id = v_uid and e.offering_id = o.id and e.ended_at is null),
        'lesson_count', (select count(*) from public.lessons l
                         where l.course_id = c.id
                           and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')),
        'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
                              where lp.user_id = v_uid and l.course_id = c.id and lp.state = 'completed')
      ) order by coalesce((select cc.position from public.curriculum_courses cc where
        cc.course_id=c.id and cc.department_id=o.department_id and cc.level_id=o.level_id and cc.semester_number=1 and cc.active),1000),c.code)
      from public.course_offerings o
      join public.courses c on c.id = o.course_id
      where o.status = 'published' and c.active
        and o.university_id = v_profile.university_id and o.department_id = v_profile.department_id
        and o.level_id = v_profile.level_id and o.semester_id = v_profile.semester_id
    ), '[]'::jsonb)
  ));
end;
$$;
create or replace function public.get_course_overview_v1(p_offering_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_total integer;
  v_done integer;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  select * into v_course from public.courses where id = v_offering.course_id;

  select count(*), count(*) filter (where lp.state = 'completed')
    into v_total, v_done
    from public.lessons l
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
   where l.course_id = v_course.id
     and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published');

  return private.envelope(jsonb_build_object(
    'offering_id', v_offering.id,
    'unit_count', v_offering.unit_count, 'requirement_status', v_offering.requirement_status,
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title, 'description', v_course.description),
    'progress', jsonb_build_object('lessons_total', v_total, 'lessons_completed', v_done,
                                   'percent', case when v_total > 0 then round(100.0 * v_done / v_total) else 0 end),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'position', m.position,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'lesson_id', l.id, 'lesson_version_id', lv.id, 'position', l.position, 'title', lv.title,
            'objective', lv.objective, 'estimated_minutes', lv.estimated_minutes,
            'state', coalesce(lp.state, 'not_started'), 'completed_at', lp.completed_at
          ) order by l.position)
          from public.lessons l
          join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
          left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
          where l.module_id = m.id), '[]'::jsonb)
      ) order by m.position)
      from public.modules m where m.course_id = v_course.id
        and exists (select 1 from public.lessons l join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
                    where l.module_id = m.id)), '[]'::jsonb),
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assessment_id', a.id, 'assessment_version_id', av.id, 'kind', a.kind, 'title', a.title, 'lesson_id', a.lesson_id,
        'question_count', av.question_count, 'duration_seconds', av.duration_seconds, 'feedback_mode', av.feedback_mode,
        'active_attempt_id', (select at.id from public.assessment_attempts at
                              where at.user_id = v_uid and at.assessment_id = a.id and at.status = 'active' limit 1),
        'completed_attempts', (select count(*) from public.assessment_attempts at
                               where at.user_id = v_uid and at.assessment_id = a.id and at.status in ('submitted', 'expired')),
        'best_percent', (select max(round(100.0 * at.correct_count / at.total_count)) from public.assessment_attempts at
                         where at.user_id = v_uid and at.assessment_id = a.id and at.status in ('submitted', 'expired')),
        'first_completion_rewarded', exists (
          select 1 from public.points_ledger pl where pl.user_id = v_uid
            and pl.event_key in ('practice_first:' || a.id::text, 'mock_first:' || a.id::text))
      ) order by case a.kind when 'review' then 1 when 'practice' then 2 else 3 end, a.position)
      from public.assessments a
      join public.assessment_versions av on av.assessment_id = a.id and av.status = 'published'
      where a.course_id = v_course.id), '[]'::jsonb),
    'battle_ready', (select count(*) from public.questions q
                     where q.course_id = v_course.id and q.pool = 'battle'
                       and exists (select 1 from public.question_versions qv where qv.question_id = q.id
                                   and qv.status = 'published' and 'battle' = any (qv.usage)))
                    >= coalesce((select br.round_count from public.battle_rules br where br.published_at is not null
                                 and br.published_at <= now() order by br.version desc limit 1), 5)
  ));
end;
$$;
