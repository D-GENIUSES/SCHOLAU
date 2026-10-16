-- Shared first-year curriculum requested by the user on 2026-10-16.
-- CYB common sciences confirmed; SEN uses the same provisional list, open to later correction.
-- Preserve the source C/R/E statuses and existing identities/enrollments/progress.
do $$ declare u uuid; cs uuid; l uuid; r record; begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict cs from public.departments where university_id=u and name='Computer Science';
select id into strict l from public.levels where university_id=u and label='100 Level';
if (select count(*) from public.curriculum_courses where department_id=cs and level_id=l and active and semester_number in (1,2))<>18 then raise exception 'Expected 18 first-year source requirements'; end if;
if (select count(*) from public.departments where university_id=u and name in ('Cybersecurity','Software Engineering'))<>2 then raise exception 'Missing target departments'; end if;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
select cc.university_id,d.id,cc.level_id,cc.semester_number,cc.course_id,cc.unit_count,cc.requirement_status,cc.position,
'Shared first-year list requested 2026-10-16; '||case when d.name='Cybersecurity' then 'CYB sciences confirmed by user; ' else 'SEN provisional shared list; ' end||cc.source_reference,
cc.lecture_hours,cc.practical_hours,cc.elective_group,cc.source_code,cc.source_title
from public.curriculum_courses cc join public.departments d on d.university_id=u and d.name in ('Cybersecurity','Software Engineering')
where cc.department_id=cs and cc.level_id=l and cc.active and cc.semester_number in (1,2)
on conflict(department_id,level_id,semester_number,course_id) do nothing;
for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id
where s.university_id=u and s.active and ap.active loop perform private.materialize_curriculum(r.id); end loop;
end $$;
