-- Confirmed Law elective choices: one at 200/300/400; two at 500, first semester.
-- Rules follow the curriculum into future academic sessions. Existing enrollments are retained.
create table private.elective_selection_rules (
  department_id uuid not null references public.departments(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  semester_number integer not null check(semester_number between 1 and 3),
  elective_group text not null,
  selection_count integer not null check(selection_count>0),
  primary key(department_id,level_id,semester_number,elective_group)
);
revoke all on private.elective_selection_rules from public,anon,authenticated;
create temp table law_elective_choices(level_number int,code text,selection_count int) on commit drop;
insert into law_elective_choices values
(200,'PUL 231',1),(200,'AUE-LAW 201',1),
(300,'PPL 321',1),(300,'PUL 321',1),
(400,'PUL 421',1),(400,'PPL 441',1),
(500,'PUL 541',2),(500,'PUL 521',2),(500,'PPL 521',2);
create temp table law_elective_scope on commit drop as
select d.id department_id,d.university_id,l.id level_id,r.code,r.selection_count,'Law electives - '||r.level_number::text||' Level' elective_group
from law_elective_choices r join public.universities u on u.slug='adeleke-university-ede-osun-state'
join public.departments d on d.university_id=u.id and d.name='Law' and d.active
join public.levels l on l.university_id=u.id and l.sort_order=r.level_number and l.active;
do $$ begin
 if (select count(*) from law_elective_scope)<>9 then raise exception 'Law elective scope mismatch'; end if;
end $$;
insert into private.elective_selection_rules(department_id,level_id,semester_number,elective_group,selection_count)
select distinct department_id,level_id,1,elective_group,selection_count from law_elective_scope;
update public.curriculum_courses cc set requirement_status='E',elective_group=r.elective_group,
source_reference=cc.source_reference||' Elective choice confirmed by owner: choose '||r.selection_count::text||' from this level group.'
from law_elective_scope r,public.courses c where cc.department_id=r.department_id and cc.level_id=r.level_id and cc.semester_number=1 and cc.course_id=c.id and c.code=r.code;
update public.course_offerings o set requirement_status='E',elective_group=r.elective_group
from law_elective_scope r,public.courses c,public.semesters s where o.department_id=r.department_id and o.level_id=r.level_id and o.course_id=c.id and c.code=r.code and s.id=o.semester_id and s.sort_order=1;
do $$ begin
 if (select count(*) from public.curriculum_courses cc join law_elective_scope r on cc.department_id=r.department_id and cc.level_id=r.level_id join public.courses c on c.id=cc.course_id and c.code=r.code where cc.semester_number=1 and cc.requirement_status='E' and cc.elective_group=r.elective_group)<>9 then raise exception 'Expected nine grouped Law curriculum electives'; end if;
end $$;
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
        'lecture_hours',o.lecture_hours,'practical_hours',o.practical_hours,'elective_group',o.elective_group,
        'elective_selection_count', (select r.selection_count from private.elective_selection_rules r where r.department_id=o.department_id and r.level_id=o.level_id and r.semester_number=(select s.sort_order from public.semesters s where s.id=o.semester_id) and r.elective_group=o.elective_group),
        'course', jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'description', c.description),
        'enrolled', exists (select 1 from public.enrollments e where e.user_id = v_uid and e.offering_id = o.id and e.ended_at is null),
        'lesson_count', (select count(*) from public.lessons l
                         where l.course_id = c.id
                           and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')),
        'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
                              where lp.user_id = v_uid and l.course_id = c.id and lp.state = 'completed')
      ) order by coalesce((select cc.position from public.curriculum_courses cc where
        cc.course_id=c.id and cc.department_id=o.department_id and cc.level_id=o.level_id and cc.semester_number=(select sort_order from public.semesters where id=o.semester_id) and cc.active),1000),c.code)
      from public.course_offerings o
      join public.courses c on c.id = o.course_id
      where o.status = 'published' and c.active
        and o.university_id = v_profile.university_id and o.department_id = v_profile.department_id
        and o.level_id = v_profile.level_id and o.semester_id = v_profile.semester_id
    ), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.enroll_course_v1(p_offering_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_offering public.course_offerings;
  v_enrollment public.enrollments;
  v_limit integer;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended('scholau.enrollment:'||v_uid::text,0));
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.university_id is null then
    perform private.raise_error('INVALID_PROFILE', 'Complete your academic profile first.');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id;
  if not found or v_offering.status <> 'published'
     or not exists (select 1 from public.courses c where c.id = v_offering.course_id and c.active) then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  if (v_offering.university_id, v_offering.department_id, v_offering.level_id, v_offering.semester_id)
     is distinct from (v_profile.university_id, v_profile.department_id, v_profile.level_id, v_profile.semester_id) then
    perform private.raise_error('FORBIDDEN', 'This course is not offered for your academic profile.');
  end if;

  if v_offering.elective_group is not null then
    select coalesce((select r.selection_count from private.elective_selection_rules r
      where r.department_id=v_offering.department_id and r.level_id=v_offering.level_id
        and r.semester_number=(select s.sort_order from public.semesters s where s.id=v_offering.semester_id)
        and r.elective_group=v_offering.elective_group),1) into v_limit;
    if (select count(*) from public.enrollments e join public.course_offerings other on other.id=e.offering_id
      where e.user_id=v_uid and e.ended_at is null and other.id<>v_offering.id
        and other.elective_group=v_offering.elective_group and other.semester_id=v_offering.semester_id
        and other.department_id=v_offering.department_id and other.level_id=v_offering.level_id) >= v_limit then
      perform private.raise_error('VALIDATION_FAILED',format('Choose only %s course%s from this elective group.',v_limit,case when v_limit=1 then '' else 's' end));
    end if;
  end if;
  insert into public.enrollments (user_id, offering_id, request_key)
  values (v_uid, p_offering_id, p_request_key)
  on conflict (user_id, offering_id) do update
    set ended_at = null,
        enrolled_at = case when public.enrollments.ended_at is null then public.enrollments.enrolled_at else now() end,
        request_key = case when public.enrollments.ended_at is null then public.enrollments.request_key else excluded.request_key end
  returning * into v_enrollment;

  return private.envelope(jsonb_build_object(
    'offering_id', v_enrollment.offering_id, 'enrolled_at', v_enrollment.enrolled_at, 'active', true), p_request_key);
end;
$$;
