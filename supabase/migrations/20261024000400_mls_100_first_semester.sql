-- Medical Laboratory Science, 100 Level, first semester.
-- Source: user-provided course checklist. Codes, titles, credits, and C/R/E status are copied as printed.
-- Contact hours and elective selection rules were not printed, so they stay unknown.
-- AUE-GST 131 is elective and is not auto-assigned.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Medical Laboratory Science',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Basic Medical Sciences'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;

insert into public.courses(code,title) values
('AUE-GST 131','Environment and Sustainable Development'),
('BIO 107','General Biology Practical I'),
('CHM 107','Practical Chemistry I')
on conflict(code) do nothing;

do $$
declare v_u uuid; r record;
begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,source_code,source_title)
  select v_u,d.id,l.id,1,c.id,src.units,src.status,src.position,
    'User-provided Medical Laboratory Science 100 Level first-semester course checklist',src.code,src.title
  from (values
    ('AUE-GST 100',0,'R',1,'Students Life Seminar'),
    ('AUE-GST 101',2,'C',2,'Use of Library'),
    ('AUE-GST 131',2,'E',3,'Environment and Sustainable Development'),
    ('BIO 101',2,'C',4,'General Biology I'),
    ('BIO 107',1,'C',5,'General Biology Practical I'),
    ('CHM 101',2,'C',6,'General Chemistry I'),
    ('CHM 107',1,'C',7,'Practical Chemistry I'),
    ('COS 101',3,'C',8,'Introduction to Computing Sciences'),
    ('GST 111',2,'C',9,'Communication in English')
  ) src(code,units,status,position,title)
  join public.departments d on d.university_id=v_u and d.name='Medical Laboratory Science'
  join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Basic Medical Sciences'
  join public.levels l on l.university_id=v_u and l.label='100 Level'
  join public.courses c on c.code=src.code
  on conflict(department_id,level_id,semester_number,course_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
    source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,active=true;

  if (select count(*) from public.curriculum_courses cc
      join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Medical Laboratory Science' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>9
    then raise exception 'Expected 9 Medical Laboratory Science 100 Level first-semester courses'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc
      join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Medical Laboratory Science' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>15
    then raise exception 'Expected 15 Medical Laboratory Science 100 Level first-semester units'; end if;

  for r in select s.id from public.semesters s
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active and s.sort_order=1
  loop
    perform private.materialize_curriculum(r.id);
  end loop;
end;
$$;
