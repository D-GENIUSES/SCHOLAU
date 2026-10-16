-- Complete tables transcribed from seven user-supplied AU handbook photographs.
-- Reuses existing course identities and 2026/2027. No learning content is generated.
alter table public.curriculum_courses drop constraint curriculum_courses_unit_count_check;
alter table public.curriculum_courses add constraint curriculum_courses_unit_count_check check(unit_count>=0);
alter table public.curriculum_courses drop constraint curriculum_courses_requirement_status_check;
alter table public.curriculum_courses add constraint curriculum_courses_requirement_status_check check(requirement_status in ('C','R','E'));
alter table public.course_offerings drop constraint course_offerings_unit_count_check;
alter table public.course_offerings add constraint course_offerings_unit_count_check check(unit_count>=0);
alter table public.course_offerings drop constraint course_offerings_requirement_status_check;
alter table public.course_offerings add constraint course_offerings_requirement_status_check check(requirement_status in ('C','R','E'));
alter table public.curriculum_courses add column lecture_hours integer check(lecture_hours>=0);
alter table public.curriculum_courses add column practical_hours integer check(practical_hours>=0);
alter table public.curriculum_courses add column elective_group text;
alter table public.curriculum_courses add column source_code text;
alter table public.curriculum_courses add column source_title text;
alter table public.course_offerings add column lecture_hours integer check(lecture_hours>=0);
alter table public.course_offerings add column practical_hours integer check(practical_hours>=0);
alter table public.course_offerings add column elective_group text;
alter table public.course_offerings add column source_code text;
alter table public.course_offerings add column source_title text;

create or replace function private.materialize_curriculum(p_semester_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_rows integer; begin
  insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,lecture_hours,practical_hours,elective_group,source_code,source_title)
  select cc.course_id,cc.university_id,cc.department_id,cc.level_id,s.id,'published',cc.unit_count,cc.requirement_status,cc.lecture_hours,cc.practical_hours,cc.elective_group,cc.source_code,cc.source_title
    from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    join public.curriculum_courses cc on cc.university_id=s.university_id and cc.semester_number=s.sort_order and cc.active
    join public.universities u on u.id=cc.university_id and u.active
    join public.departments d on d.id=cc.department_id and d.active
    join public.levels l on l.id=cc.level_id and l.active
    join public.courses c on c.id=cc.course_id and c.active
    where s.id=p_semester_id and s.active
  on conflict(course_id,department_id,level_id,semester_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,
    lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,elective_group=excluded.elective_group,
    source_code=excluded.source_code,source_title=excluded.source_title;
  get diagnostics v_rows=row_count; return v_rows;
end;
$$;
insert into public.courses(code,title) values
('GST 111','Communication in English'),
('AUE-GST 100','Students Life Seminar'),
('AUE-GST 101','Use of Library'),
('MTH 101','Elementary Mathematics I'),
('PHY 101','General Physics I'),
('PHY 107','General Practical Physics I'),
('STA 111','Descriptive Statistics'),
('COS 101','Introduction to Computing Sciences'),
('CHM 101','General Chemistry I'),
('BIO 101','General Biology I'),
('GST 112','Nigerian Peoples and Culture'),
('AUE-GST 102','God in Modern Society'),
('AUE-CSC 104','Computer Hardware'),
('MTH 102','Elementary Mathematics II'),
('PHY 102','General Physics II'),
('PHY 108','General Practical Physics II'),
('COS 102','Problem Solving'),
('STA 112','Probability I'),
('ENT 211','Entrepreneurship and Innovation'),
('AUE-GST 201','Philosophy of Education'),
('AUE-GST 221','Communication in French'),
('COS 201','Computer Programming I'),
('CSC 203','Discrete Structures'),
('IFT 211','Digital Logic Design'),
('SEN 201','Introduction to Software Engineering'),
('CYB 201','Introduction to Cybersecurity and Strategy'),
('STA 121','Statistical Inference I'),
('MTH 201','Mathematical Methods I'),
('GST 212','Philosophy, Logic and Human Existence'),
('AUE-GST 200','Student Life Seminar'),
('AUE-GST 202','Life and Teachings of Christ'),
('MTH 202','Mathematical Methods II'),
('COS 202','Computer Programming II'),
('IFT 212','Computer Architecture and Organization'),
('AUE-CSC 202','System Analysis and Design'),
('AUE-CSC 204','Web Technologies'),
('CSC 299','SIWES I'),
('CSC 301','Data Structures'),
('CSC 309','Artificial Intelligence'),
('ICT 305','Data Communication System & Network'),
('AUE-CSC 301','Formal Theory of Computation and Automata'),
('AUE-CSC 303','E-Commerce'),
('MTH 203','Sets, Logic and Algebra I'),
('CYB 305','Digital Forensics and Investigation Methods'),
('INS 311','Business Process Management'),
('GST 312','Peace and Conflict Resolution'),
('ENT 312','Venture Creation'),
('CSC 308','Operating Systems'),
('CSC 322','Computer Science Innovation and New Technologies'),
('DTS 304','Data Management I'),
('AUE-CSC 302','Information System Concept'),
('CSC 399','SIWES II'),
('CYB 203','Cybercrime, Law and Countermeasures'),
('AUE-CYB 202','System and Network Administration'),
('INS 204','Systems Analysis and Design'),
('CYB 299','SIWES I'),
('CYB 301','Cryptography Techniques, Algorithms and Applications'),
('CYB 303','Cybersecurity Risks Analysis, Challenges and Mitigation'),
('AUE-CYB 303','Linux Fundamentals'),
('AUE-CYB 307','Software Defined Networks'),
('CYB 302','Biometrics Security'),
('CYB 304','Information and Big Data Security'),
('CYB 322','Cybersecurity Innovation and Entrepreneurship'),
('CYB 399','SIWES II'),
('SEN 299','SIWES I'),
('SEN 301','Object-Oriented Analysis and Design'),
('AUE-CYB 305','Threat, Exploits and Counter measures'),
('SEN 304','Software Testing and Quality Assurance'),
('SEN 306','Software Construction'),
('SEN 322','Software Engineering Innovation and New Technology'),
('SEN 399','SIWES II')
on conflict(code) do nothing;
do $$ declare v_u uuid; v_p uuid; v_s uuid; r record; begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
  select id into strict v_p from public.academic_periods where university_id=v_u and label='2026/2027';
  insert into public.levels(university_id,label,sort_order) values(v_u,'100 Level',100),(v_u,'300 Level',300)
    on conflict(university_id,label) do nothing;
  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
  select v_u,d.id,l.id,src.semester,c.id,src.units,src.status,src.position,
    'User-provided handbook photograph '||src.photo::text,src.lh,src.ph,src.elective_group,src.source_code,src.source_title
  from (values
('Computer Science',100,1,'GST 111',2,'C',1,1,15,45,null,'GST 111','Communication in English'),
('Computer Science',100,1,'AUE-GST 100',0,'R',2,1,15,0,null,'AUE-GST 100','Students Life Seminar'),
('Computer Science',100,1,'AUE-GST 101',2,'C',3,1,30,0,null,'AUE-GST 101','Use of Library'),
('Computer Science',100,1,'MTH 101',2,'C',4,1,30,0,null,'MTH 101','Elementary Mathematics I'),
('Computer Science',100,1,'PHY 101',2,'C',5,1,30,0,null,'PHY 101','General Physics I'),
('Computer Science',100,1,'PHY 107',1,'C',6,1,0,45,null,'PHY 107','General Practical Physics I'),
('Computer Science',100,1,'STA 111',3,'C',7,1,45,0,null,'STA 111','Descriptive Statistics'),
('Computer Science',100,1,'COS 101',3,'C',8,1,30,45,null,'COS 101','Introduction to Computing Sciences'),
('Computer Science',100,1,'CHM 101',2,'E',9,1,30,0,null,'CHM 101','General Chemistry I'),
('Computer Science',100,1,'BIO 101',2,'E',10,1,30,0,null,'BIO 101','General Biology I'),
('Computer Science',100,2,'GST 112',2,'C',1,1,30,0,null,'GST 112','Nigerian Peoples and Culture'),
('Computer Science',100,2,'AUE-GST 102',1,'C',2,1,15,0,null,'AUE-GST 102','God in Modern Society'),
('Computer Science',100,2,'AUE-CSC 104',3,'C',3,1,30,45,null,'AUE-CSC 104','Computer Hardware'),
('Computer Science',100,2,'MTH 102',2,'C',4,1,30,0,null,'MTH 102','Elementary Mathematics II'),
('Computer Science',100,2,'PHY 102',2,'C',5,1,30,0,null,'PHY 102','General Physics II'),
('Computer Science',100,2,'PHY 108',1,'C',6,1,0,45,null,'PHY 108','General Practical Physics II'),
('Computer Science',100,2,'COS 102',3,'C',7,1,30,45,null,'COS 102','Problem Solving'),
('Computer Science',100,2,'STA 112',3,'E',8,1,45,0,null,'STA 112','Probability I'),
('Computer Science',200,1,'ENT 211',2,'C',1,2,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Computer Science',200,1,'AUE-GST 201',1,'R',2,2,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Computer Science',200,1,'AUE-GST 221',2,'R',3,2,30,0,null,'AUE-GST 221','Communication in French'),
('Computer Science',200,1,'COS 201',3,'C',4,2,30,45,null,'COS 201','Computer Programming I'),
('Computer Science',200,1,'CSC 203',2,'C',5,2,30,0,null,'COS 203','Discrete Structures'),
('Computer Science',200,1,'IFT 211',2,'C',6,2,15,45,null,'IFT 211','Digital Logic Design'),
('Computer Science',200,1,'SEN 201',2,'C',7,2,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Computer Science',200,1,'CYB 201',2,'C',8,2,30,0,null,'CYB 201','Introduction to Cybersecurity and Strategy'),
('Computer Science',200,1,'STA 121',3,'C',9,2,45,0,null,'STA 121','Statistical Inference I'),
('Computer Science',200,1,'MTH 201',2,'C',10,2,30,0,null,'MTH 201','Mathematical Methods I'),
('Computer Science',200,2,'GST 212',2,'C',1,2,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Computer Science',200,2,'AUE-GST 200',0,'R',2,2,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Computer Science',200,2,'AUE-GST 202',1,'R',3,2,15,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Computer Science',200,2,'MTH 202',2,'C',4,2,30,0,null,'MTH 202','Mathematical Methods II'),
('Computer Science',200,2,'COS 202',3,'C',5,2,30,45,null,'COS 202','Computer Programming II'),
('Computer Science',200,2,'IFT 212',2,'C',6,2,15,45,null,'IFT 212','Computer Architecture and Organization'),
('Computer Science',200,2,'AUE-CSC 202',3,'C',7,2,45,0,null,'AUE-CSC 202','System Analysis and Design'),
('Computer Science',200,2,'AUE-CSC 204',3,'C',8,2,30,45,null,'AUE-CSC 204','Web Technologies'),
('Computer Science',200,2,'CSC 299',3,'C',9,2,0,135,null,'CSC 299','SIWES I'),
('Computer Science',300,1,'CSC 301',3,'C',1,3,30,45,null,'CSC 301','Data Structures'),
('Computer Science',300,1,'CSC 309',2,'C',2,3,15,45,null,'CSC 309','Artificial Intelligence'),
('Computer Science',300,1,'ICT 305',3,'C',3,3,30,45,null,'ICT 305','Data Communication System & Network'),
('Computer Science',300,1,'AUE-CSC 301',3,'C',4,3,30,45,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Computer Science',300,1,'AUE-CSC 303',3,'C',5,3,30,0,null,'AUE-CSC 303','E-Commerce'),
('Computer Science',300,1,'MTH 203',2,'E',6,3,30,0,null,'MTH 203','Sets, Logic and Algebra I'),
('Computer Science',300,1,'CYB 305',2,'E',7,3,null,45,'cs-300-first-select-one','CYB 305','Digital Forensics and Investigation Methods'),
('Computer Science',300,1,'INS 311',2,'E',8,3,15,45,'cs-300-first-select-one','INS 311','Business Process Management'),
('Computer Science',300,2,'GST 312',2,'C',1,3,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Computer Science',300,2,'ENT 312',2,'C',2,3,15,45,null,'ENT 312','Venture Creation'),
('Computer Science',300,2,'CSC 308',3,'C',3,3,30,45,null,'CSC 308','Operating Systems'),
('Computer Science',300,2,'CSC 322',2,'C',4,3,15,45,null,'CSC 322','Computer Science Innovation and New Technologies'),
('Computer Science',300,2,'DTS 304',3,'C',5,3,30,45,null,'DTS 304','Data Management I'),
('Computer Science',300,2,'AUE-CSC 302',3,'C',6,3,30,0,null,'AUE-CSC 302','Information System Concept'),
('Computer Science',300,2,'CSC 399',3,'C',7,3,0,135,null,'CSC 399','SIWES II'),
('Cybersecurity',200,1,'ENT 211',2,'C',1,4,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Cybersecurity',200,1,'AUE-GST 201',1,'R',2,4,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Cybersecurity',200,1,'AUE-GST 221',2,'R',3,4,30,0,null,'AUE-GST 221','Communication in French'),
('Cybersecurity',200,1,'CYB 201',2,'C',4,4,30,0,null,'CYB 201','Introduction to Cybersecurity and Strategy'),
('Cybersecurity',200,1,'CYB 203',2,'C',5,4,30,0,null,'CYB 203','Cybercrime, Law and Countermeasures'),
('Cybersecurity',200,1,'COS 201',3,'C',6,4,30,45,null,'COS 201','Computer Programming I'),
('Cybersecurity',200,1,'SEN 201',2,'C',7,4,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Cybersecurity',200,1,'MTH 201',2,'C',8,4,30,0,null,'MTH 201','Mathematical Methods I'),
('Cybersecurity',200,1,'STA 121',3,'C',9,4,45,0,null,'STA 121','Statistical Inference I'),
('Cybersecurity',200,2,'GST 212',2,'C',1,4,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Cybersecurity',200,2,'AUE-GST 200',0,'R',2,4,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Cybersecurity',200,2,'AUE-GST 202',1,'R',3,4,15,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Cybersecurity',200,2,'AUE-CYB 202',2,'C',4,4,15,45,null,'AUE-CYB 202','System and Network Administration'),
('Cybersecurity',200,2,'COS 202',3,'C',5,4,30,45,null,'COS 202','Computer Programming II'),
('Cybersecurity',200,2,'INS 204',3,'C',6,4,30,45,null,'INS 204','Systems Analysis and Design'),
('Cybersecurity',200,2,'AUE-CSC 204',3,'C',7,4,30,45,null,'AUE-CSC 204','Web Technologies'),
('Cybersecurity',200,2,'CYB 299',3,'C',8,4,0,135,null,'CYB 299','SIWES I'),
('Cybersecurity',300,1,'CYB 301',2,'C',1,5,15,45,null,'CYB 301','Cryptography Techniques, Algorithms and Applications'),
('Cybersecurity',300,1,'CYB 303',2,'C',2,5,30,0,null,'CYB 303','Cybersecurity Risks Analysis, Challenges and Mitigation'),
('Cybersecurity',300,1,'CYB 305',2,'C',3,5,15,45,null,'CYB 305','Digital Forensics and Investigation Methods'),
('Cybersecurity',300,1,'CSC 309',2,'C',4,5,15,45,null,'CSC 309','Artificial Intelligence'),
('Cybersecurity',300,1,'AUE-CSC 301',3,'C',5,5,30,0,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Cybersecurity',300,1,'AUE-CYB 303',3,'C',6,5,30,0,null,'AUE-CYB 303','Linux Fundamentals'),
('Cybersecurity',300,1,'AUE-CYB 307',2,'C',7,5,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Cybersecurity',300,2,'GST 312',2,'C',1,5,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Cybersecurity',300,2,'ENT 312',2,'C',2,5,15,45,null,'ENT 312','Venture Creation'),
('Cybersecurity',300,2,'CYB 302',2,'C',3,5,15,45,null,'CYB 302','Biometrics Security'),
('Cybersecurity',300,2,'CYB 304',2,'C',4,5,15,45,null,'CYB 304','Information and Big Data Security'),
('Cybersecurity',300,2,'CYB 322',2,'C',5,5,15,45,null,'CYB 322','Cybersecurity Innovation and Entrepreneurship'),
('Cybersecurity',300,2,'AUE-CSC 302',3,'C',6,5,30,0,null,'AUE-CSC 302','Information System Concept'),
('Cybersecurity',300,2,'CYB 399',3,'C',7,5,15,45,null,'CYB 399','SIWES II'),
('Software Engineering',200,1,'ENT 211',2,'C',1,6,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Software Engineering',200,1,'AUE-GST 201',1,'R',2,6,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Software Engineering',200,1,'AUE-GST 221',2,'R',3,6,30,0,null,'AUE-GST 221','Communication in French'),
('Software Engineering',200,1,'SEN 201',2,'C',4,6,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Software Engineering',200,1,'COS 201',3,'C',5,6,30,45,null,'COS 201','Computer Programming I'),
('Software Engineering',200,1,'CSC 203',2,'C',6,6,30,0,null,'COS 203','Discrete Structures'),
('Software Engineering',200,1,'MTH 201',2,'C',7,6,30,0,null,'MTH 201','Mathematical Methods I'),
('Software Engineering',200,1,'STA 121',3,'C',8,6,45,0,null,'STA 121','Statistical Inference I'),
('Software Engineering',200,1,'IFT 211',2,'C',9,6,15,45,null,'IFT 211','Digital Logic Design'),
('Software Engineering',200,2,'GST 212',2,'C',1,6,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Software Engineering',200,2,'AUE-GST 200',0,'R',2,6,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Software Engineering',200,2,'AUE-GST 202',1,'R',3,6,30,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Software Engineering',200,2,'COS 202',3,'C',4,6,30,45,null,'COS 202','Computer Programming II'),
('Software Engineering',200,2,'MTH 202',2,'C',5,6,30,0,null,'MTH 202','Mathematical Methods II'),
('Software Engineering',200,2,'INS 204',3,'C',6,6,30,45,null,'INS 204','Systems Analysis and Design'),
('Software Engineering',200,2,'IFT 212',2,'C',7,6,15,45,null,'IFT 212','Computer Architecture and Organisation'),
('Software Engineering',200,2,'AUE-CSC 202',3,'C',8,6,45,0,null,'AUE-CSC 202','System Analysis and Design'),
('Software Engineering',200,2,'AUE-CSC 204',3,'C',9,6,30,45,null,'AUE-CSC 204','Web Technologies'),
('Software Engineering',200,2,'SEN 299',3,'C',10,6,0,135,null,'SEN 299','SIWES I'),
('Software Engineering',300,1,'SEN 301',2,'C',1,7,15,45,null,'SEN 301','Object-Oriented Analysis and Design'),
('Software Engineering',300,1,'CSC 301',3,'C',2,7,15,45,null,'CSC 301','Data Structures'),
('Software Engineering',300,1,'CSC 309',2,'C',3,7,15,45,null,'CSC 309','Artificial Intelligence'),
('Software Engineering',300,1,'AUE-CSC 301',3,'C',4,7,30,45,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Software Engineering',300,1,'AUE-CSC 303',3,'C',5,7,30,0,null,'AUE-CSC 303','E-Commerce'),
('Software Engineering',300,1,'AUE-CYB 305',3,'C',6,7,30,45,null,'AUE-CYB 305','Threat, Exploits and Counter measures'),
('Software Engineering',300,1,'AUE-CYB 307',2,'C',7,7,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Software Engineering',300,2,'GST 312',2,'C',1,7,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Software Engineering',300,2,'ENT 312',2,'C',2,7,15,45,null,'ENT 312','Venture Creation'),
('Software Engineering',300,2,'SEN 304',2,'C',3,7,15,45,null,'SEN 304','Software Testing and Quality Assurance'),
('Software Engineering',300,2,'SEN 306',2,'C',4,7,15,45,null,'SEN 306','Software Construction'),
('Software Engineering',300,2,'SEN 322',2,'C',5,7,15,45,null,'SEN 322','Software Engineering Innovation and New Technology'),
('Software Engineering',300,2,'CSC 308',3,'C',6,7,15,45,null,'CSC 308','Operating Systems'),
('Software Engineering',300,2,'AUE-CSC 302',3,'C',7,7,30,0,null,'AUE-CSC 302','Information System Concept'),
('Software Engineering',300,2,'SEN 399',3,'C',8,7,0,135,null,'SEN 399','SIWES II')) src(programme,level,semester,code,units,status,position,photo,lh,ph,elective_group,source_code,source_title)
  join public.departments d on d.university_id=v_u and d.name=src.programme
  join public.levels l on l.university_id=v_u and l.label=src.level::text||' Level'
  join public.courses c on c.code=src.code
  on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,
    requirement_status=excluded.requirement_status,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,
    elective_group=excluded.elective_group,source_code=excluded.source_code,source_title=excluded.source_title,source_reference=excluded.source_reference;
  insert into public.semesters(university_id,academic_period_id,label,sort_order) values(v_u,v_p,'Second semester',2)
    on conflict(academic_period_id,label) do nothing;
  -- Refresh already configured active sessions as well as the new second semester.
  for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active loop perform private.materialize_curriculum(r.id); end loop;
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
        'lecture_hours',o.lecture_hours,'practical_hours',o.practical_hours,'elective_group',o.elective_group,
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
    'lecture_hours',v_offering.lecture_hours,'practical_hours',v_offering.practical_hours,'elective_group',v_offering.elective_group,
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

  if v_offering.elective_group is not null and exists(
    select 1 from public.enrollments e join public.course_offerings other on other.id=e.offering_id
    where e.user_id=v_uid and e.ended_at is null and other.id<>v_offering.id
      and other.elective_group=v_offering.elective_group and other.semester_id=v_offering.semester_id
      and other.department_id=v_offering.department_id and other.level_id=v_offering.level_id) then
    perform private.raise_error('VALIDATION_FAILED','Choose only one course from this elective group.');
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
