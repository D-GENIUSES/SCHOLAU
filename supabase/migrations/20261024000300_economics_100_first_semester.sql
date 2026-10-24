-- Economics 100 Level, first semester, from the user-provided 2026/2027 selected course list.
-- Credits are copied from that list. It prints no C/R/E column and no contact hours.
-- AUE-GST 201 and ENT 211 keep the status already used for those codes because the printed credits match.
-- The GET rows have no elective marker, so they are stored as C. Hours stay unknown.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Economics',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Business and Social Sciences'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;

insert into public.courses(code,title) values
('GET 209','Engineering Mathematics I'),
('GET 207','Applied Mechanics'),
('GET 205','Fundamentals of Fluid Mechanics'),
('GET 203','Engineering Graphics and Solid Modelling I'),
('GET 201','Applied Electricity I'),
('GET 211','Computing and Software Engineering')
on conflict(code) do nothing;

do $$
declare v_u uuid; r record;
begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,source_code,source_title)
  select v_u,d.id,l.id,1,c.id,src.units,src.status,src.position,
    'User-provided Economics 100 Level first-semester selected course list, 2026/2027',src.code,src.title
  from (values
    ('AUE-GST 201',1,'R',1,'Philosophy of Education'),
    ('GET 209',3,'C',2,'Engineering Mathematics I'),
    ('GET 207',3,'C',3,'Applied Mechanics'),
    ('GET 205',3,'C',4,'Fundamentals of Fluid Mechanics'),
    ('GET 203',3,'C',5,'Engineering Graphics and Solid Modelling I'),
    ('GET 201',3,'C',6,'Applied Electricity I'),
    ('ENT 211',2,'C',7,'Entrepreneurship and Innovation'),
    ('GET 211',3,'C',8,'Computing and Software Engineering')
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
      where d.university_id=v_u and d.name='Economics' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>8
    then raise exception 'Expected 8 Economics 100 Level first-semester courses'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc
      join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Economics' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>21
    then raise exception 'Expected 21 Economics 100 Level first-semester units'; end if;

  for r in select s.id from public.semesters s
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active and s.sort_order=1
  loop
    perform private.materialize_curriculum(r.id);
  end loop;
end;
$$;
