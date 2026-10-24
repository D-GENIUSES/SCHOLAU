-- Correct Economics 100 Level first-semester catalogue (replaces mistaken GET/ENT rows from 20261024000300).
-- Source: user-provided 2026/2027 selected course list for Department of Economics.
insert into public.courses(code,title) values
('ACC 101','Principles of Accounting I'),
('AMS 101','Principles of Management'),
('AUE-ECO 105','Introduction to Quantitative Maths'),
('BUA 101','Introduction to Business I'),
('ECO 101','Principles of Economics I'),
('ECO 103','Introductory Mathematics I')
on conflict(code) do update set title = excluded.title;
do $$
declare v_u uuid; r record;
begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';

  update public.curriculum_courses cc
  set active = false
  from public.departments d, public.levels l, public.courses c
  where cc.department_id = d.id and cc.level_id = l.id and cc.course_id = c.id
    and d.university_id = v_u and d.name = 'Economics' and l.label = '100 Level'
    and cc.semester_number = 1
    and c.code in (
      'AUE-GST 201','GET 201','GET 203','GET 205','GET 207','GET 209','GET 211','ENT 211'
    );

  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,source_code,source_title)
  select v_u,d.id,l.id,1,c.id,src.units,src.status,src.position,
    'User-provided Economics 100 Level first-semester selected course list, 2026/2027',src.code,src.title
  from (values
    ('AUE-GST 100',0,'R',1,'Students Life Seminar'),
    ('ACC 101',3,'C',2,'Principles of Accounting I'),
    ('AMS 101',2,'C',3,'Principles of Management'),
    ('AUE-ECO 105',3,'C',4,'Introduction to Quantitative Maths'),
    ('AUE-GST 101',2,'C',5,'Use of Library'),
    ('BUA 101',2,'C',6,'Introduction to Business I'),
    ('ECO 101',2,'C',7,'Principles of Economics I'),
    ('ECO 103',2,'C',8,'Introductory Mathematics I'),
    ('GST 111',2,'C',9,'Communication in English')
  ) src(code,units,status,position,title)
  join public.departments d on d.university_id=v_u and d.name='Economics'
  join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Business and Social Sciences'
  join public.levels l on l.university_id=v_u and l.label='100 Level'
  join public.courses c on c.code=src.code
  on conflict(department_id,level_id,semester_number,course_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
    source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,active=true;

  if (select count(*) from public.curriculum_courses cc
      join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Economics' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>9
    then raise exception 'Expected 9 Economics 100 Level first-semester courses'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc
      join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Economics' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>18
    then raise exception 'Expected 18 Economics 100 Level first-semester units'; end if;

  for r in select s.id from public.semesters s
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active and s.sort_order=1
  loop
    perform private.materialize_curriculum(r.id);
  end loop;
end;
$$;
