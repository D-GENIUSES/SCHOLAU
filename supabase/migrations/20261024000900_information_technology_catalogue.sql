-- Information Technology curriculum (100–400 Level), Faculty of Science.
-- Source: imports/information-technology-100-400-course-lists.pdf (user-provided scan), session 2026/2027.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Information Technology',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Science'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;

insert into public.courses(code,title) values
('IFT 203','Introduction to Web Technology'),
('IFT 205','Introduction to Information Technology'),
('AUE-IFT 232','Application Development'),
('INS 202','Human-Computer Interaction'),
('IFT 299','SIWES I'),
('INS 301','Business Process Management'),
('INS 305','Management Theory'),
('AUE-INS 301','Enterprise System'),
('IFT 302','Web Application Development'),
('IFT 304','Web Development using Content Management Systems'),
('IFT 308','Ethics and Legal Issues in IT'),
('IFT 310','Mobile Application Development'),
('IFT 322','IT Innovation and Entrepreneurship'),
('IFT 342','Network Servers and Infrastructure'),
('IFT 399','SIWES II'),
('AUE-IFT 411','Information Technology Security and Risk Management'),
('AUE-IFT 421','Information Technology Audit and Control'),
('AUE-INS 441','Information Technology Infrastructure'),
('IFT 497','Final Year Project I'),
('IFT 410','System Integration and Architecture'),
('IFT 442','Wireless Communication and Networking'),
('AUE-INS 422','Enterprise Architecture'),
('AUE-INS 432','Information Systems Strategy, Management and Acquisition'),
('INS 498','Final Year Project II')
on conflict(code) do nothing;

do $$
declare v_u uuid; r record;
begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';

  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
  select v_u,d.id,l.id,src.semester,c.id,src.units,src.status,src.position,
    'Information Technology 100 to 400 course lists.pdf (Faculty of Science), 2026/2027',src.lh,src.ph,null,src.code,src.title
  from (values
    (100,1,'GST 111',2,'C',1,15,45,'Communication in English (Use of English I)'),
    (100,1,'AUE-GST 100',0,'R',2,15,null,'Students Life Seminar'),
    (100,1,'AUE-GST 101',2,'C',3,30,0,'Use of Library'),
    (100,1,'MTH 101',2,'C',4,30,null,'Elementary Mathematics I'),
    (100,1,'PHY 101',2,'C',5,30,null,'General Physics I'),
    (100,1,'PHY 107',1,'C',6,null,45,'General Physics Practical I'),
    (100,1,'STA 111',3,'C',7,45,null,'Descriptive Statistics'),
    (100,1,'COS 101',3,'C',8,30,45,'Introduction to Computing Sciences'),
    (100,1,'CHM 101',2,'E',9,30,null,'General Chemistry I'),
    (100,1,'BIO 101',2,'E',10,30,null,'General Biology I'),
    (100,2,'GST 112',2,'C',1,30,null,'Nigerian Peoples and Culture'),
    (100,2,'AUE-GST 102',1,'R',2,15,null,'God in Modern Society'),
    (100,2,'MTH 102',2,'C',3,30,null,'Elementary Mathematics II'),
    (100,2,'PHY 102',2,'C',4,30,null,'General Physics II'),
    (100,2,'PHY 108',1,'C',5,null,45,'General Physics Practical II'),
    (100,2,'COS 102',3,'C',6,30,45,'Problem Solving'),
    (100,2,'STA 112',3,'C',7,30,45,'Probability I'),
    (100,2,'AUE-CSC 104',3,'C',8,30,45,'Computer Hardware'),
    (200,1,'ENT 211',2,'C',1,30,null,'Entrepreneurship and Innovation'),
    (200,1,'AUE-GST 221',2,'R',2,30,null,'Communication in French'),
    (200,1,'AUE-GST 201',1,'C',3,15,null,'Philosophy of Education'),
    (200,1,'IFT 203',2,'C',4,15,45,'Introduction to Web Technology'),
    (200,1,'IFT 205',2,'C',5,30,null,'Introduction to Information Technology'),
    (200,1,'IFT 211',2,'C',6,15,45,'Digital Logic Design'),
    (200,1,'COS 201',3,'C',7,30,45,'Computer Programming I'),
    (200,1,'SEN 201',2,'C',8,30,null,'Introduction to Software Engineering'),
    (200,1,'CYB 201',2,'C',9,30,null,'Introduction to Cybersecurity and Strategy'),
    (200,2,'GST 212',2,'C',1,30,null,'Philosophy, Logic and Human Existence'),
    (200,2,'AUE-GST 200',0,'R',2,15,null,'Student Life Seminar'),
    (200,2,'AUE-GST 202',1,'C',3,15,null,'Life and Teachings of Christ'),
    (200,2,'IFT 212',2,'C',4,30,null,'Computer Organization and Architecture'),
    (200,2,'AUE-IFT 232',3,'C',5,30,45,'Application Development'),
    (200,2,'INS 202',2,'C',6,30,null,'Human-Computer Interaction'),
    (200,2,'INS 204',3,'C',7,30,45,'System Analysis and Design'),
    (200,2,'COS 202',3,'C',8,30,45,'Computer Programming II'),
    (200,2,'IFT 299',3,'C',9,null,135,'SIWES I'),
    (300,1,'INS 301',2,'C',1,30,null,'Business Process Management'),
    (300,1,'INS 305',2,'C',2,30,null,'Management Theory'),
    (300,1,'INS 311',2,'C',3,30,null,'E-Business Systems Development'),
    (300,1,'CYB 305',2,'C',4,30,null,'Digital Forensic and Investigation Methods'),
    (300,1,'ICT 305',3,'C',5,45,null,'Data Communication System and Networking'),
    (300,1,'CSC 301',3,'C',6,30,45,'Data Structure'),
    (300,1,'AUE-INS 301',3,'C',7,30,45,'Enterprise System'),
    (300,1,'AUE-CSC 301',2,'E',8,30,null,'Formal Theory of Computation and Automata'),
    (300,1,'AUE-CSC 303',3,'C',9,30,45,'E-Commerce'),
    (300,2,'GST 312',2,'C',1,30,null,'Peace and Conflict Resolution'),
    (300,2,'ENT 312',2,'C',2,15,45,'Venture and Creation'),
    (300,2,'IFT 302',2,'C',3,30,null,'Web Application Development'),
    (300,2,'IFT 304',2,'C',4,15,45,'Web Development using Content Management Systems'),
    (300,2,'IFT 308',2,'C',5,30,null,'Ethics and Legal Issues in IT'),
    (300,2,'IFT 310',2,'C',6,15,45,'Mobile Application Development'),
    (300,2,'IFT 322',2,'C',7,15,45,'IT Innovation and Entrepreneurship'),
    (300,2,'IFT 342',2,'C',8,15,45,'Network Servers and Infrastructure'),
    (300,2,'CSC 308',3,'C',9,30,45,'Operating Systems'),
    (300,2,'AUE-CSC 302',2,'E',10,30,null,'Information System Concept'),
    (300,2,'IFT 399',3,'C',11,0,135,'SIWES II'),
    (400,1,'IFT 403',2,'C',1,15,45,'Mobile and Persuasive Computing'),
    (400,1,'INS 401',2,'C',2,30,null,'Project Management'),
    (400,1,'CSC 401',2,'E',3,30,null,'Algorithms and Complexity Analysis'),
    (400,1,'AUE-IFT 411',3,'C',4,45,null,'Information Technology Security and Risk Management'),
    (400,1,'AUE-IFT 421',3,'C',5,45,null,'Information Technology Audit and Control'),
    (400,1,'AUE-INS 441',3,'C',6,45,null,'Information Technology Infrastructure'),
    (400,1,'IFT 497',3,'C',7,0,135,'Final Year Project I'),
    (400,2,'IFT 410',2,'C',1,30,null,'System Integration and Architecture'),
    (400,2,'IFT 442',2,'C',2,15,45,'Wireless Communication and Networking'),
    (400,2,'COS 409',3,'C',3,45,null,'Research Methodology and Technical Report Writing'),
    (400,2,'CYB 404',2,'C',4,30,null,'Cloud Computing Security'),
    (400,2,'AUE-INS 422',3,'C',5,45,null,'Enterprise Architecture'),
    (400,2,'AUE-INS 432',3,'C',6,45,null,'Information Systems Strategy, Management and Acquisition'),
    (400,2,'AUE-CSC 402',2,'E',7,30,null,'Collaborating Computing'),
    (400,2,'AUE-CSC 404',2,'C',8,30,null,'Information Theory System'),
    (400,2,'INS 498',3,'C',9,0,135,'Final Year Project II')
  ) src(level,semester,code,units,status,position,lh,ph,title)
  join public.departments d on d.university_id=v_u and d.name='Information Technology'
  join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Science'
  join public.levels l on l.university_id=v_u and l.label=src.level::text||' Level'
  join public.courses c on c.code=src.code
  on conflict(department_id,level_id,semester_number,course_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
    source_reference=excluded.source_reference,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,
    elective_group=excluded.elective_group,source_code=excluded.source_code,source_title=excluded.source_title,active=true;

  if (select count(*) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      where d.university_id=v_u and d.name='Information Technology' and cc.active)<>72
    then raise exception 'Expected 72 Information Technology curriculum rows'; end if;

  if (select count(*) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Information Technology' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>10
    then raise exception 'Expected 10 Information Technology 100 Level first-semester courses'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Information Technology' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>19
    then raise exception 'Expected 19 Information Technology 100 Level first-semester units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Information Technology' and l.label='100 Level' and cc.semester_number=2 and cc.active)<>17
    then raise exception 'Expected 17 Information Technology 100 Level second-semester units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Information Technology' and l.label='200 Level' and cc.semester_number=1 and cc.active)<>18
    then raise exception 'Expected 18 Information Technology 200 Level first-semester units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Information Technology' and l.label='200 Level' and cc.semester_number=2 and cc.active)<>19
    then raise exception 'Expected 19 Information Technology 200 Level second-semester units'; end if;

  for r in select s.id from public.semesters s
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active
  loop
    perform private.materialize_curriculum(r.id);
  end loop;
end;
$$;
