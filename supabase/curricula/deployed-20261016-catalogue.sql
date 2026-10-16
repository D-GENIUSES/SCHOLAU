begin;
create temporary table catalogue_preservation_snapshot on commit drop as
select 'courses' as table_name,id::text as row_key,to_jsonb(c) as row_data from public.courses c
union all select 'offerings',id::text,jsonb_build_object('id',id,'course_id',course_id,'status',status) from public.course_offerings
union all select 'enrollments',user_id::text||':'||offering_id::text,to_jsonb(e) from public.enrollments e where ended_at is null
union all select 'progress',user_id::text||':'||lesson_id::text,to_jsonb(lp) from public.lesson_progress lp
union all select 'attempts',id::text,to_jsonb(a) from public.assessment_attempts a;
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

insert into supabase_migrations.schema_migrations(version,name,statements) values('20261015000400','automatic_course_assignment',array[$assignment$-- Assign required courses from the validated academic profile; electives remain explicit choices.
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
$assignment$]);
-- Reconcile all 20 semester lists from courses .pdf, SHA256: e67b4be126c0839be5a601ac01330de695df60a17de392801d6c3746156211b3.
-- Additive and replay-safe. Preserve IDs, enrollment/progress, existing course titles and retired offerings.
-- Printed totals and unresolved source variants are preserved in adeleke-pdf-2026-2027.json.
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
('IFT 212','Computer Architecture and Organisation'),
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
('CSC 401','Algorithms and Complexity Analysis'),
('COS 409','Research Methodology and Technical Report Writing'),
('INS 401','Project Management'),
('CSC 497','Final Year Project I'),
('AUE-CSC 401','Compiler Construction'),
('AUE-CSC 403','Modelling and Simulation'),
('SEN 401','Software Configuration Management and Maintenance'),
('IFT 403','Mobile and Pervasive Computing'),
('CSC 402','Ethics and Legal Issues in Computer Science'),
('CSC 498','Final Year Project II'),
('AUE-CSC 402','Collaborative Computing'),
('AUE-CSC 404','Information Theory System'),
('AUE-CSC 406','Analogue Computing'),
('AUE-CSC 408','Assembly Language'),
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
('CYB 401','Systems Vulnerability Assessment and Testing'),
('CYB 403','Cyber Threat Intelligence and Cyber Conflict'),
('CYB 405','Ethical Hacking and Reverse Engineering'),
('CYB 497','Final Year Project I'),
('CYB 402','Steganography: Access Methods and Data Hiding'),
('CYB 404','Cloud Computing Security'),
('CYB 406','Deep and Dark Web Security'),
('CYB 498','Final Year Project II'),
('SEN 299','SIWES I'),
('SEN 301','Object-Oriented Analysis and Design'),
('AUE-CYB 305','Threat, Exploits and Counter measures'),
('SEN 304','Software Testing and Quality Assurance'),
('SEN 306','Software Construction'),
('SEN 322','Software Engineering Innovation and New Technology'),
('SEN 399','SIWES II'),
('SEN 497','Final Year Project I'),
('SEN 410','Software Architecture and Design'),
('SEN 498','Final Year Project II')
on conflict(code) do nothing;
do $$ declare v_u uuid; r record; begin
select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
insert into public.levels(university_id,label,sort_order) values(v_u,'400 Level',400) on conflict(university_id,label) do nothing;
-- Fail instead of silently dropping rows through a missing department join.
if (select count(*) from public.departments where university_id=v_u and name in ('Computer Science','Cybersecurity','Software Engineering'))<>3 then
raise exception 'Expected all three Computing Sciences departments'; end if;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
select v_u,d.id,l.id,src.semester,c.id,src.units,src.status,src.position,
'courses .pdf page '||src.page::text||' (handbook page '||(18+src.page)::text||')',src.lh,src.ph,src.elective_group,src.source_code,src.title
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
('Computer Science',400,1,'CSC 401',2,'C',1,4,30,0,null,'CSC 401','Algorithms and Complexity Analysis'),
('Computer Science',400,1,'COS 409',3,'C',2,4,45,0,null,'COS 409','Research Methodology and Technical Report Writing'),
('Computer Science',400,1,'INS 401',2,'C',3,4,30,0,null,'INS 401','Project Management'),
('Computer Science',400,1,'CSC 497',3,'C',4,4,0,135,null,'CSC 497','Final Year Project I'),
('Computer Science',400,1,'AUE-CSC 401',3,'C',5,4,30,45,null,'AUE-CSC 401','Compiler Construction'),
('Computer Science',400,1,'AUE-CSC 403',3,'C',6,4,30,45,null,'AUE-CSC 403','Modelling and Simulation'),
('Computer Science',400,1,'SEN 401',2,'C',7,4,15,45,'cs-400-first-select-one','SEN 401','Software Configuration Management and Maintenance'),
('Computer Science',400,1,'IFT 403',2,'E',8,4,30,0,'cs-400-first-select-one','IFT 403','Mobile and Pervasive Computing'),
('Computer Science',400,2,'CSC 402',2,'C',1,4,30,0,null,'CSC 402','Ethics and Legal Issues in Computer Science'),
('Computer Science',400,2,'CSC 498',3,'C',2,4,0,135,null,'CSC 498','Final Year Project II'),
('Computer Science',400,2,'AUE-CSC 402',3,'C',3,4,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Computer Science',400,2,'AUE-CSC 404',3,'C',4,4,30,45,null,'AUE-CSC 404','Information Theory System'),
('Computer Science',400,2,'AUE-CSC 406',3,'C',5,4,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Computer Science',400,2,'AUE-CSC 408',3,'C',6,4,30,45,null,'AUE-CSC 408','Assembly Language'),
('Cybersecurity',200,1,'ENT 211',2,'C',1,5,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Cybersecurity',200,1,'AUE-GST 201',1,'R',2,5,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Cybersecurity',200,1,'AUE-GST 221',2,'R',3,5,30,0,null,'AUE-GST 221','Communication in French'),
('Cybersecurity',200,1,'CYB 201',2,'C',4,5,30,0,null,'CYB 201','Introduction to Cybersecurity and Strategy'),
('Cybersecurity',200,1,'CYB 203',2,'C',5,5,30,0,null,'CYB 203','Cybercrime, Law and Countermeasures'),
('Cybersecurity',200,1,'COS 201',3,'C',6,5,30,45,null,'COS 201','Computer Programming I'),
('Cybersecurity',200,1,'SEN 201',2,'C',7,5,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Cybersecurity',200,1,'MTH 201',2,'C',8,5,30,0,null,'MTH 201','Mathematical Methods I'),
('Cybersecurity',200,1,'STA 121',3,'C',9,5,45,0,null,'STA 121','Statistical Inference I'),
('Cybersecurity',200,2,'GST 212',2,'C',1,5,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Cybersecurity',200,2,'AUE-GST 200',0,'R',2,5,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Cybersecurity',200,2,'AUE-GST 202',1,'R',3,5,15,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Cybersecurity',200,2,'AUE-CYB 202',2,'C',4,5,15,45,null,'AUE-CYB 202','System and Network Administration'),
('Cybersecurity',200,2,'COS 202',3,'C',5,5,30,45,null,'COS 202','Computer Programming II'),
('Cybersecurity',200,2,'INS 204',3,'C',6,5,30,45,null,'INS 204','Systems Analysis and Design'),
('Cybersecurity',200,2,'AUE-CSC 204',3,'C',7,5,30,45,null,'AUE-CSC 204','Web Technologies'),
('Cybersecurity',200,2,'CYB 299',3,'C',8,5,0,135,null,'CYB 299','SIWES I'),
('Cybersecurity',300,1,'CYB 301',2,'C',1,6,15,45,null,'CYB 301','Cryptography Techniques, Algorithms and Applications'),
('Cybersecurity',300,1,'CYB 303',2,'C',2,6,30,0,null,'CYB 303','Cybersecurity Risks Analysis, Challenges and Mitigation'),
('Cybersecurity',300,1,'CYB 305',2,'C',3,6,15,45,null,'CYB 305','Digital Forensics and Investigation Methods'),
('Cybersecurity',300,1,'CSC 309',2,'C',4,6,15,45,null,'CSC 309','Artificial Intelligence'),
('Cybersecurity',300,1,'AUE-CSC 301',3,'C',5,6,30,0,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Cybersecurity',300,1,'AUE-CYB 303',3,'C',6,6,30,0,null,'AUE-CYB 303','Linux Fundamentals'),
('Cybersecurity',300,1,'AUE-CYB 307',2,'C',7,6,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Cybersecurity',300,2,'GST 312',2,'C',1,6,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Cybersecurity',300,2,'ENT 312',2,'C',2,6,15,45,null,'ENT 312','Venture Creation'),
('Cybersecurity',300,2,'CYB 302',2,'C',3,6,15,45,null,'CYB 302','Biometrics Security'),
('Cybersecurity',300,2,'CYB 304',2,'C',4,6,15,45,null,'CYB 304','Information and Big Data Security'),
('Cybersecurity',300,2,'CYB 322',2,'C',5,6,15,45,null,'CYB 322','Cybersecurity Innovation and Entrepreneurship'),
('Cybersecurity',300,2,'AUE-CSC 302',3,'C',6,6,30,0,null,'AUE-CSC 302','Information System Concept'),
('Cybersecurity',300,2,'CYB 399',3,'C',7,6,15,45,null,'CYB 399','SIWES II'),
('Cybersecurity',400,1,'CYB 401',2,'C',1,7,15,45,null,'CYB 401','Systems Vulnerability Assessment and Testing'),
('Cybersecurity',400,1,'CYB 403',2,'C',2,7,30,0,null,'CYB 403','Cyber Threat Intelligence and Cyber Conflict'),
('Cybersecurity',400,1,'CYB 405',2,'C',3,7,15,45,null,'CYB 405','Ethical Hacking and Reverse Engineering'),
('Cybersecurity',400,1,'COS 409',3,'C',4,7,45,0,null,'COS 409','Research Methodology and Technical Report Writing'),
('Cybersecurity',400,1,'AUE-CSC 401',3,'C',5,7,30,0,null,'AUE-CSC 401','Compiler Construction'),
('Cybersecurity',400,1,'AUE-CSC 403',3,'C',6,7,30,0,null,'AUE-CSC 403','Modelling and Simulation'),
('Cybersecurity',400,1,'CYB 497',3,'C',7,7,0,135,null,'CYB 497','Final Year Project I'),
('Cybersecurity',400,2,'CYB 402',2,'C',1,7,15,45,null,'CYB 402','Steganography: Access Methods and Data Hiding'),
('Cybersecurity',400,2,'CYB 404',2,'C',2,7,30,0,null,'CYB 404','Cloud Computing Security'),
('Cybersecurity',400,2,'CYB 406',2,'C',3,7,15,45,null,'CYB 406','Deep and Dark Web Security'),
('Cybersecurity',400,2,'AUE-CSC 402',3,'C',4,7,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Cybersecurity',400,2,'AUE-CSC 404',3,'C',5,7,30,45,null,'AUE-CSC 404','Information Theory System'),
('Cybersecurity',400,2,'AUE-CSC 406',3,'C',6,7,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Cybersecurity',400,2,'AUE-CSC 408',3,'C',7,7,30,45,null,'AUE-CSC 408','Assembly Language'),
('Cybersecurity',400,2,'CYB 498',3,'C',8,7,0,135,null,'CYB 498','Final Year Project II'),
('Software Engineering',200,1,'ENT 211',2,'C',1,8,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Software Engineering',200,1,'AUE-GST 201',1,'R',2,8,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Software Engineering',200,1,'AUE-GST 221',2,'R',3,8,30,0,null,'AUE-GST 221','Communication in French'),
('Software Engineering',200,1,'SEN 201',2,'C',4,8,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Software Engineering',200,1,'COS 201',3,'C',5,8,30,45,null,'COS 201','Computer Programming I'),
('Software Engineering',200,1,'CSC 203',2,'C',6,8,30,0,null,'COS 203','Discrete Structures'),
('Software Engineering',200,1,'MTH 201',2,'C',7,8,30,0,null,'MTH 201','Mathematical Methods I'),
('Software Engineering',200,1,'STA 121',3,'C',8,8,45,0,null,'STA 121','Statistical Inference I'),
('Software Engineering',200,1,'IFT 211',2,'C',9,8,15,45,null,'IFT 211','Digital Logic Design'),
('Software Engineering',200,2,'GST 212',2,'C',1,8,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Software Engineering',200,2,'AUE-GST 200',0,'R',2,8,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Software Engineering',200,2,'AUE-GST 202',1,'R',3,8,30,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Software Engineering',200,2,'COS 202',3,'C',4,8,30,45,null,'COS 202','Computer Programming II'),
('Software Engineering',200,2,'MTH 202',2,'C',5,8,30,0,null,'MTH 202','Mathematical Methods II'),
('Software Engineering',200,2,'INS 204',3,'C',6,8,30,45,null,'INS 204','Systems Analysis and Design'),
('Software Engineering',200,2,'IFT 212',2,'C',7,8,15,45,null,'IFT 212','Computer Architecture and Organisation'),
('Software Engineering',200,2,'AUE-CSC 202',3,'C',8,8,45,0,null,'AUE-CSC 202','System Analysis and Design'),
('Software Engineering',200,2,'AUE-CSC 204',3,'C',9,8,30,45,null,'AUE-CSC 204','Web Technologies'),
('Software Engineering',200,2,'SEN 299',3,'C',10,8,0,135,null,'SEN 299','SIWES I'),
('Software Engineering',300,1,'SEN 301',2,'C',1,9,15,45,null,'SEN 301','Object-Oriented Analysis and Design'),
('Software Engineering',300,1,'CSC 301',3,'C',2,9,15,45,null,'CSC 301','Data Structures'),
('Software Engineering',300,1,'CSC 309',2,'C',3,9,15,45,null,'CSC 309','Artificial Intelligence'),
('Software Engineering',300,1,'AUE-CSC 301',3,'C',4,9,30,45,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Software Engineering',300,1,'AUE-CSC 303',3,'C',5,9,30,0,null,'AUE-CSC 303','E-Commerce'),
('Software Engineering',300,1,'AUE-CYB 305',3,'C',6,9,30,45,null,'AUE-CYB 305','Threat, Exploits and Counter measures'),
('Software Engineering',300,1,'AUE-CYB 307',2,'C',7,9,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Software Engineering',300,2,'GST 312',2,'C',1,9,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Software Engineering',300,2,'ENT 312',2,'C',2,9,15,45,null,'ENT 312','Venture Creation'),
('Software Engineering',300,2,'SEN 304',2,'C',3,9,15,45,null,'SEN 304','Software Testing and Quality Assurance'),
('Software Engineering',300,2,'SEN 306',2,'C',4,9,15,45,null,'SEN 306','Software Construction'),
('Software Engineering',300,2,'SEN 322',2,'C',5,9,15,45,null,'SEN 322','Software Engineering Innovation and New Technology'),
('Software Engineering',300,2,'CSC 308',3,'C',6,9,15,45,null,'CSC 308','Operating Systems'),
('Software Engineering',300,2,'AUE-CSC 302',3,'C',7,9,30,0,null,'AUE-CSC 302','Information System Concept'),
('Software Engineering',300,2,'SEN 399',3,'C',8,9,0,135,null,'SEN 399','SIWES II'),
('Software Engineering',400,1,'SEN 401',2,'C',1,10,15,45,null,'SEN 401','Software Configuration Management and Maintenance'),
('Software Engineering',400,1,'COS 409',3,'C',2,10,45,null,null,'COS 409','Research Methodology and Technical Report Writing'),
('Software Engineering',400,1,'INS 401',2,'C',3,10,30,0,null,'INS 401','Project Management'),
('Software Engineering',400,1,'AUE-CSC 401',3,'C',4,10,30,45,null,'AUE-CSC 401','Compiler Construction'),
('Software Engineering',400,1,'AUE-CSC 403',3,'C',5,10,30,45,null,'AUE-CSC 403','Modelling and Simulation'),
('Software Engineering',400,1,'SEN 497',3,'C',6,10,0,135,null,'SEN 497','Final Year Project I'),
('Software Engineering',400,2,'SEN 410',2,'C',1,10,15,45,null,'SEN 410','Software Architecture and Design'),
('Software Engineering',400,2,'CYB 404',2,'C',2,10,30,0,null,'CYB 404','Cloud Computing Security'),
('Software Engineering',400,2,'CYB 406',2,'C',3,10,15,45,null,'CYB 406','Deep and Dark Web Security'),
('Software Engineering',400,2,'AUE-CSC 402',3,'C',4,10,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Software Engineering',400,2,'AUE-CSC 404',3,'C',5,10,30,45,null,'AUE-CSC 404','Information Theory System'),
('Software Engineering',400,2,'AUE-CSC 406',3,'C',6,10,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Software Engineering',400,2,'AUE-CSC 408',3,'C',7,10,30,45,null,'AUE-CSC 408','Assembly Language'),
('Software Engineering',400,2,'SEN 498',3,'C',8,10,0,135,null,'SEN 498','Final Year Project II')) src(programme,level,semester,code,units,status,position,page,lh,ph,elective_group,source_code,title)
join public.departments d on d.university_id=v_u and d.name=src.programme
join public.levels l on l.university_id=v_u and l.label=src.level::text||' Level'
join public.courses c on c.code=src.code
on conflict(department_id,level_id,semester_number,course_id) do update set
unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,
lecture_hours=coalesce(excluded.lecture_hours,public.curriculum_courses.lecture_hours),
practical_hours=coalesce(excluded.practical_hours,public.curriculum_courses.practical_hours),elective_group=excluded.elective_group;
for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id
where s.university_id=v_u and s.active and ap.active loop perform private.materialize_curriculum(r.id); end loop;
end $$;

insert into supabase_migrations.schema_migrations(version,name,statements) values('20261016000100','complete_computing_catalogue',array[$migration$-- Reconcile all 20 semester lists from courses .pdf, SHA256: e67b4be126c0839be5a601ac01330de695df60a17de392801d6c3746156211b3.
-- Additive and replay-safe. Preserve IDs, enrollment/progress, existing course titles and retired offerings.
-- Printed totals and unresolved source variants are preserved in adeleke-pdf-2026-2027.json.
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
('IFT 212','Computer Architecture and Organisation'),
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
('CSC 401','Algorithms and Complexity Analysis'),
('COS 409','Research Methodology and Technical Report Writing'),
('INS 401','Project Management'),
('CSC 497','Final Year Project I'),
('AUE-CSC 401','Compiler Construction'),
('AUE-CSC 403','Modelling and Simulation'),
('SEN 401','Software Configuration Management and Maintenance'),
('IFT 403','Mobile and Pervasive Computing'),
('CSC 402','Ethics and Legal Issues in Computer Science'),
('CSC 498','Final Year Project II'),
('AUE-CSC 402','Collaborative Computing'),
('AUE-CSC 404','Information Theory System'),
('AUE-CSC 406','Analogue Computing'),
('AUE-CSC 408','Assembly Language'),
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
('CYB 401','Systems Vulnerability Assessment and Testing'),
('CYB 403','Cyber Threat Intelligence and Cyber Conflict'),
('CYB 405','Ethical Hacking and Reverse Engineering'),
('CYB 497','Final Year Project I'),
('CYB 402','Steganography: Access Methods and Data Hiding'),
('CYB 404','Cloud Computing Security'),
('CYB 406','Deep and Dark Web Security'),
('CYB 498','Final Year Project II'),
('SEN 299','SIWES I'),
('SEN 301','Object-Oriented Analysis and Design'),
('AUE-CYB 305','Threat, Exploits and Counter measures'),
('SEN 304','Software Testing and Quality Assurance'),
('SEN 306','Software Construction'),
('SEN 322','Software Engineering Innovation and New Technology'),
('SEN 399','SIWES II'),
('SEN 497','Final Year Project I'),
('SEN 410','Software Architecture and Design'),
('SEN 498','Final Year Project II')
on conflict(code) do nothing;
do $$ declare v_u uuid; r record; begin
select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
insert into public.levels(university_id,label,sort_order) values(v_u,'400 Level',400) on conflict(university_id,label) do nothing;
-- Fail instead of silently dropping rows through a missing department join.
if (select count(*) from public.departments where university_id=v_u and name in ('Computer Science','Cybersecurity','Software Engineering'))<>3 then
raise exception 'Expected all three Computing Sciences departments'; end if;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
select v_u,d.id,l.id,src.semester,c.id,src.units,src.status,src.position,
'courses .pdf page '||src.page::text||' (handbook page '||(18+src.page)::text||')',src.lh,src.ph,src.elective_group,src.source_code,src.title
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
('Computer Science',400,1,'CSC 401',2,'C',1,4,30,0,null,'CSC 401','Algorithms and Complexity Analysis'),
('Computer Science',400,1,'COS 409',3,'C',2,4,45,0,null,'COS 409','Research Methodology and Technical Report Writing'),
('Computer Science',400,1,'INS 401',2,'C',3,4,30,0,null,'INS 401','Project Management'),
('Computer Science',400,1,'CSC 497',3,'C',4,4,0,135,null,'CSC 497','Final Year Project I'),
('Computer Science',400,1,'AUE-CSC 401',3,'C',5,4,30,45,null,'AUE-CSC 401','Compiler Construction'),
('Computer Science',400,1,'AUE-CSC 403',3,'C',6,4,30,45,null,'AUE-CSC 403','Modelling and Simulation'),
('Computer Science',400,1,'SEN 401',2,'C',7,4,15,45,'cs-400-first-select-one','SEN 401','Software Configuration Management and Maintenance'),
('Computer Science',400,1,'IFT 403',2,'E',8,4,30,0,'cs-400-first-select-one','IFT 403','Mobile and Pervasive Computing'),
('Computer Science',400,2,'CSC 402',2,'C',1,4,30,0,null,'CSC 402','Ethics and Legal Issues in Computer Science'),
('Computer Science',400,2,'CSC 498',3,'C',2,4,0,135,null,'CSC 498','Final Year Project II'),
('Computer Science',400,2,'AUE-CSC 402',3,'C',3,4,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Computer Science',400,2,'AUE-CSC 404',3,'C',4,4,30,45,null,'AUE-CSC 404','Information Theory System'),
('Computer Science',400,2,'AUE-CSC 406',3,'C',5,4,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Computer Science',400,2,'AUE-CSC 408',3,'C',6,4,30,45,null,'AUE-CSC 408','Assembly Language'),
('Cybersecurity',200,1,'ENT 211',2,'C',1,5,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Cybersecurity',200,1,'AUE-GST 201',1,'R',2,5,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Cybersecurity',200,1,'AUE-GST 221',2,'R',3,5,30,0,null,'AUE-GST 221','Communication in French'),
('Cybersecurity',200,1,'CYB 201',2,'C',4,5,30,0,null,'CYB 201','Introduction to Cybersecurity and Strategy'),
('Cybersecurity',200,1,'CYB 203',2,'C',5,5,30,0,null,'CYB 203','Cybercrime, Law and Countermeasures'),
('Cybersecurity',200,1,'COS 201',3,'C',6,5,30,45,null,'COS 201','Computer Programming I'),
('Cybersecurity',200,1,'SEN 201',2,'C',7,5,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Cybersecurity',200,1,'MTH 201',2,'C',8,5,30,0,null,'MTH 201','Mathematical Methods I'),
('Cybersecurity',200,1,'STA 121',3,'C',9,5,45,0,null,'STA 121','Statistical Inference I'),
('Cybersecurity',200,2,'GST 212',2,'C',1,5,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Cybersecurity',200,2,'AUE-GST 200',0,'R',2,5,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Cybersecurity',200,2,'AUE-GST 202',1,'R',3,5,15,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Cybersecurity',200,2,'AUE-CYB 202',2,'C',4,5,15,45,null,'AUE-CYB 202','System and Network Administration'),
('Cybersecurity',200,2,'COS 202',3,'C',5,5,30,45,null,'COS 202','Computer Programming II'),
('Cybersecurity',200,2,'INS 204',3,'C',6,5,30,45,null,'INS 204','Systems Analysis and Design'),
('Cybersecurity',200,2,'AUE-CSC 204',3,'C',7,5,30,45,null,'AUE-CSC 204','Web Technologies'),
('Cybersecurity',200,2,'CYB 299',3,'C',8,5,0,135,null,'CYB 299','SIWES I'),
('Cybersecurity',300,1,'CYB 301',2,'C',1,6,15,45,null,'CYB 301','Cryptography Techniques, Algorithms and Applications'),
('Cybersecurity',300,1,'CYB 303',2,'C',2,6,30,0,null,'CYB 303','Cybersecurity Risks Analysis, Challenges and Mitigation'),
('Cybersecurity',300,1,'CYB 305',2,'C',3,6,15,45,null,'CYB 305','Digital Forensics and Investigation Methods'),
('Cybersecurity',300,1,'CSC 309',2,'C',4,6,15,45,null,'CSC 309','Artificial Intelligence'),
('Cybersecurity',300,1,'AUE-CSC 301',3,'C',5,6,30,0,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Cybersecurity',300,1,'AUE-CYB 303',3,'C',6,6,30,0,null,'AUE-CYB 303','Linux Fundamentals'),
('Cybersecurity',300,1,'AUE-CYB 307',2,'C',7,6,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Cybersecurity',300,2,'GST 312',2,'C',1,6,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Cybersecurity',300,2,'ENT 312',2,'C',2,6,15,45,null,'ENT 312','Venture Creation'),
('Cybersecurity',300,2,'CYB 302',2,'C',3,6,15,45,null,'CYB 302','Biometrics Security'),
('Cybersecurity',300,2,'CYB 304',2,'C',4,6,15,45,null,'CYB 304','Information and Big Data Security'),
('Cybersecurity',300,2,'CYB 322',2,'C',5,6,15,45,null,'CYB 322','Cybersecurity Innovation and Entrepreneurship'),
('Cybersecurity',300,2,'AUE-CSC 302',3,'C',6,6,30,0,null,'AUE-CSC 302','Information System Concept'),
('Cybersecurity',300,2,'CYB 399',3,'C',7,6,15,45,null,'CYB 399','SIWES II'),
('Cybersecurity',400,1,'CYB 401',2,'C',1,7,15,45,null,'CYB 401','Systems Vulnerability Assessment and Testing'),
('Cybersecurity',400,1,'CYB 403',2,'C',2,7,30,0,null,'CYB 403','Cyber Threat Intelligence and Cyber Conflict'),
('Cybersecurity',400,1,'CYB 405',2,'C',3,7,15,45,null,'CYB 405','Ethical Hacking and Reverse Engineering'),
('Cybersecurity',400,1,'COS 409',3,'C',4,7,45,0,null,'COS 409','Research Methodology and Technical Report Writing'),
('Cybersecurity',400,1,'AUE-CSC 401',3,'C',5,7,30,0,null,'AUE-CSC 401','Compiler Construction'),
('Cybersecurity',400,1,'AUE-CSC 403',3,'C',6,7,30,0,null,'AUE-CSC 403','Modelling and Simulation'),
('Cybersecurity',400,1,'CYB 497',3,'C',7,7,0,135,null,'CYB 497','Final Year Project I'),
('Cybersecurity',400,2,'CYB 402',2,'C',1,7,15,45,null,'CYB 402','Steganography: Access Methods and Data Hiding'),
('Cybersecurity',400,2,'CYB 404',2,'C',2,7,30,0,null,'CYB 404','Cloud Computing Security'),
('Cybersecurity',400,2,'CYB 406',2,'C',3,7,15,45,null,'CYB 406','Deep and Dark Web Security'),
('Cybersecurity',400,2,'AUE-CSC 402',3,'C',4,7,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Cybersecurity',400,2,'AUE-CSC 404',3,'C',5,7,30,45,null,'AUE-CSC 404','Information Theory System'),
('Cybersecurity',400,2,'AUE-CSC 406',3,'C',6,7,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Cybersecurity',400,2,'AUE-CSC 408',3,'C',7,7,30,45,null,'AUE-CSC 408','Assembly Language'),
('Cybersecurity',400,2,'CYB 498',3,'C',8,7,0,135,null,'CYB 498','Final Year Project II'),
('Software Engineering',200,1,'ENT 211',2,'C',1,8,30,0,null,'ENT 211','Entrepreneurship and Innovation'),
('Software Engineering',200,1,'AUE-GST 201',1,'R',2,8,30,0,null,'AUE-GST 201','Philosophy of Education'),
('Software Engineering',200,1,'AUE-GST 221',2,'R',3,8,30,0,null,'AUE-GST 221','Communication in French'),
('Software Engineering',200,1,'SEN 201',2,'C',4,8,30,0,null,'SEN 201','Introduction to Software Engineering'),
('Software Engineering',200,1,'COS 201',3,'C',5,8,30,45,null,'COS 201','Computer Programming I'),
('Software Engineering',200,1,'CSC 203',2,'C',6,8,30,0,null,'COS 203','Discrete Structures'),
('Software Engineering',200,1,'MTH 201',2,'C',7,8,30,0,null,'MTH 201','Mathematical Methods I'),
('Software Engineering',200,1,'STA 121',3,'C',8,8,45,0,null,'STA 121','Statistical Inference I'),
('Software Engineering',200,1,'IFT 211',2,'C',9,8,15,45,null,'IFT 211','Digital Logic Design'),
('Software Engineering',200,2,'GST 212',2,'C',1,8,30,0,null,'GST 212','Philosophy, Logic and Human Existence'),
('Software Engineering',200,2,'AUE-GST 200',0,'R',2,8,15,0,null,'AUE-GST 200','Student Life Seminar'),
('Software Engineering',200,2,'AUE-GST 202',1,'R',3,8,30,0,null,'AUE-GST 202','Life and Teachings of Christ'),
('Software Engineering',200,2,'COS 202',3,'C',4,8,30,45,null,'COS 202','Computer Programming II'),
('Software Engineering',200,2,'MTH 202',2,'C',5,8,30,0,null,'MTH 202','Mathematical Methods II'),
('Software Engineering',200,2,'INS 204',3,'C',6,8,30,45,null,'INS 204','Systems Analysis and Design'),
('Software Engineering',200,2,'IFT 212',2,'C',7,8,15,45,null,'IFT 212','Computer Architecture and Organisation'),
('Software Engineering',200,2,'AUE-CSC 202',3,'C',8,8,45,0,null,'AUE-CSC 202','System Analysis and Design'),
('Software Engineering',200,2,'AUE-CSC 204',3,'C',9,8,30,45,null,'AUE-CSC 204','Web Technologies'),
('Software Engineering',200,2,'SEN 299',3,'C',10,8,0,135,null,'SEN 299','SIWES I'),
('Software Engineering',300,1,'SEN 301',2,'C',1,9,15,45,null,'SEN 301','Object-Oriented Analysis and Design'),
('Software Engineering',300,1,'CSC 301',3,'C',2,9,15,45,null,'CSC 301','Data Structures'),
('Software Engineering',300,1,'CSC 309',2,'C',3,9,15,45,null,'CSC 309','Artificial Intelligence'),
('Software Engineering',300,1,'AUE-CSC 301',3,'C',4,9,30,45,null,'AUE-CSC 301','Formal Theory of Computation and Automata'),
('Software Engineering',300,1,'AUE-CSC 303',3,'C',5,9,30,0,null,'AUE-CSC 303','E-Commerce'),
('Software Engineering',300,1,'AUE-CYB 305',3,'C',6,9,30,45,null,'AUE-CYB 305','Threat, Exploits and Counter measures'),
('Software Engineering',300,1,'AUE-CYB 307',2,'C',7,9,15,0,null,'AUE-CYB 307','Software Defined Networks'),
('Software Engineering',300,2,'GST 312',2,'C',1,9,30,0,null,'GST 312','Peace and Conflict Resolution'),
('Software Engineering',300,2,'ENT 312',2,'C',2,9,15,45,null,'ENT 312','Venture Creation'),
('Software Engineering',300,2,'SEN 304',2,'C',3,9,15,45,null,'SEN 304','Software Testing and Quality Assurance'),
('Software Engineering',300,2,'SEN 306',2,'C',4,9,15,45,null,'SEN 306','Software Construction'),
('Software Engineering',300,2,'SEN 322',2,'C',5,9,15,45,null,'SEN 322','Software Engineering Innovation and New Technology'),
('Software Engineering',300,2,'CSC 308',3,'C',6,9,15,45,null,'CSC 308','Operating Systems'),
('Software Engineering',300,2,'AUE-CSC 302',3,'C',7,9,30,0,null,'AUE-CSC 302','Information System Concept'),
('Software Engineering',300,2,'SEN 399',3,'C',8,9,0,135,null,'SEN 399','SIWES II'),
('Software Engineering',400,1,'SEN 401',2,'C',1,10,15,45,null,'SEN 401','Software Configuration Management and Maintenance'),
('Software Engineering',400,1,'COS 409',3,'C',2,10,45,null,null,'COS 409','Research Methodology and Technical Report Writing'),
('Software Engineering',400,1,'INS 401',2,'C',3,10,30,0,null,'INS 401','Project Management'),
('Software Engineering',400,1,'AUE-CSC 401',3,'C',4,10,30,45,null,'AUE-CSC 401','Compiler Construction'),
('Software Engineering',400,1,'AUE-CSC 403',3,'C',5,10,30,45,null,'AUE-CSC 403','Modelling and Simulation'),
('Software Engineering',400,1,'SEN 497',3,'C',6,10,0,135,null,'SEN 497','Final Year Project I'),
('Software Engineering',400,2,'SEN 410',2,'C',1,10,15,45,null,'SEN 410','Software Architecture and Design'),
('Software Engineering',400,2,'CYB 404',2,'C',2,10,30,0,null,'CYB 404','Cloud Computing Security'),
('Software Engineering',400,2,'CYB 406',2,'C',3,10,15,45,null,'CYB 406','Deep and Dark Web Security'),
('Software Engineering',400,2,'AUE-CSC 402',3,'C',4,10,30,45,null,'AUE-CSC 402','Collaborative Computing'),
('Software Engineering',400,2,'AUE-CSC 404',3,'C',5,10,30,45,null,'AUE-CSC 404','Information Theory System'),
('Software Engineering',400,2,'AUE-CSC 406',3,'C',6,10,30,45,null,'AUE-CSC 406','Analogue Computing'),
('Software Engineering',400,2,'AUE-CSC 408',3,'C',7,10,30,45,null,'AUE-CSC 408','Assembly Language'),
('Software Engineering',400,2,'SEN 498',3,'C',8,10,0,135,null,'SEN 498','Final Year Project II')) src(programme,level,semester,code,units,status,position,page,lh,ph,elective_group,source_code,title)
join public.departments d on d.university_id=v_u and d.name=src.programme
join public.levels l on l.university_id=v_u and l.label=src.level::text||' Level'
join public.courses c on c.code=src.code
on conflict(department_id,level_id,semester_number,course_id) do update set
unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,
lecture_hours=coalesce(excluded.lecture_hours,public.curriculum_courses.lecture_hours),
practical_hours=coalesce(excluded.practical_hours,public.curriculum_courses.practical_hours),elective_group=excluded.elective_group;
for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id
where s.university_id=v_u and s.active and ap.active loop perform private.materialize_curriculum(r.id); end loop;
end $$;
$migration$]) on conflict(version) do nothing;
-- All temporary identities and enrollments are rolled back, including on success.
do $$
declare r record; u uuid; f uuid; d uuid; l uuid; p uuid; s uuid; student uuid;
catalog jsonb; overview jsonb; actual integer; option1 uuid; option2 uuid;
results jsonb := '[]'::jsonb;
begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict f from public.faculties where university_id=u and name='Computing Sciences';
select id into strict p from public.academic_periods where university_id=u and label='2026/2027';

if exists(
select 1 from jsonb_array_elements('[{"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "GST 111", "code": "GST 111", "title": "Communication in English", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "AUE-GST 100", "code": "AUE-GST 100", "title": "Students Life Seminar", "units": 0, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "AUE-GST 101", "code": "AUE-GST 101", "title": "Use of Library", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "MTH 101", "code": "MTH 101", "title": "Elementary Mathematics I", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "PHY 101", "code": "PHY 101", "title": "General Physics I", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "PHY 107", "code": "PHY 107", "title": "General Practical Physics I", "units": 1, "status": "C", "lecture_hours": 0, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "STA 111", "code": "STA 111", "title": "Descriptive Statistics", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "COS 101", "code": "COS 101", "title": "Introduction to Computing Sciences", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "CHM 101", "code": "CHM 101", "title": "General Chemistry I", "units": 2, "status": "E", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 1, "source_code": "BIO 101", "code": "BIO 101", "title": "General Biology I", "units": 2, "status": "E", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "GST 112", "code": "GST 112", "title": "Nigerian Peoples and Culture", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "AUE-GST 102", "code": "AUE-GST 102", "title": "God in Modern Society", "units": 1, "status": "C", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "AUE-CSC 104", "code": "AUE-CSC 104", "title": "Computer Hardware", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "MTH 102", "code": "MTH 102", "title": "Elementary Mathematics II", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "PHY 102", "code": "PHY 102", "title": "General Physics II", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "PHY 108", "code": "PHY 108", "title": "General Practical Physics II", "units": 1, "status": "C", "lecture_hours": 0, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "COS 102", "code": "COS 102", "title": "Problem Solving", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 100, "semester": 2, "source_code": "STA 112", "code": "STA 112", "title": "Probability I", "units": 3, "status": "E", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "ENT 211", "code": "ENT 211", "title": "Entrepreneurship and Innovation", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "AUE-GST 201", "code": "AUE-GST 201", "title": "Philosophy of Education", "units": 1, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "AUE-GST 221", "code": "AUE-GST 221", "title": "Communication in French", "units": 2, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "COS 201", "code": "COS 201", "title": "Computer Programming I", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "COS 203", "code": "CSC 203", "title": "Discrete Structures", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "IFT 211", "code": "IFT 211", "title": "Digital Logic Design", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "SEN 201", "code": "SEN 201", "title": "Introduction to Software Engineering", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "CYB 201", "code": "CYB 201", "title": "Introduction to Cybersecurity and Strategy", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "STA 121", "code": "STA 121", "title": "Statistical Inference I", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 1, "source_code": "MTH 201", "code": "MTH 201", "title": "Mathematical Methods I", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "GST 212", "code": "GST 212", "title": "Philosophy, Logic and Human Existence", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "AUE-GST 200", "code": "AUE-GST 200", "title": "Student Life Seminar", "units": 0, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "AUE-GST 202", "code": "AUE-GST 202", "title": "Life and Teachings of Christ", "units": 1, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "MTH 202", "code": "MTH 202", "title": "Mathematical Methods II", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "COS 202", "code": "COS 202", "title": "Computer Programming II", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "IFT 212", "code": "IFT 212", "title": "Computer Architecture and Organization", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "AUE-CSC 202", "code": "AUE-CSC 202", "title": "System Analysis and Design", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "AUE-CSC 204", "code": "AUE-CSC 204", "title": "Web Technologies", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 200, "semester": 2, "source_code": "CSC 299", "code": "CSC 299", "title": "SIWES I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "CSC 301", "code": "CSC 301", "title": "Data Structures", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "CSC 309", "code": "CSC 309", "title": "Artificial Intelligence", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "ICT 305", "code": "ICT 305", "title": "Data Communication System & Network", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "AUE-CSC 301", "code": "AUE-CSC 301", "title": "Formal Theory of Computation and Automata", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "AUE-CSC 303", "code": "AUE-CSC 303", "title": "E-Commerce", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "MTH 203", "code": "MTH 203", "title": "Sets, Logic and Algebra I", "units": 2, "status": "E", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "CYB 305", "code": "CYB 305", "title": "Digital Forensics and Investigation Methods", "units": 2, "status": "E", "lecture_hours": null, "practical_hours": 45, "elective_group": "cs-300-first-select-one"}, {"programme": "Computer Science", "level": 300, "semester": 1, "source_code": "INS 311", "code": "INS 311", "title": "Business Process Management", "units": 2, "status": "E", "lecture_hours": 15, "practical_hours": 45, "elective_group": "cs-300-first-select-one"}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "GST 312", "code": "GST 312", "title": "Peace and Conflict Resolution", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "ENT 312", "code": "ENT 312", "title": "Venture Creation", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "CSC 308", "code": "CSC 308", "title": "Operating Systems", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "CSC 322", "code": "CSC 322", "title": "Computer Science Innovation and New Technologies", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "DTS 304", "code": "DTS 304", "title": "Data Management I", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "AUE-CSC 302", "code": "AUE-CSC 302", "title": "Information System Concept", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 300, "semester": 2, "source_code": "CSC 399", "code": "CSC 399", "title": "SIWES II", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "CSC 401", "code": "CSC 401", "title": "Algorithms and Complexity Analysis", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "COS 409", "code": "COS 409", "title": "Research Methodology and Technical Report Writing", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "INS 401", "code": "INS 401", "title": "Project Management", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "CSC 497", "code": "CSC 497", "title": "Final Year Project I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "AUE-CSC 401", "code": "AUE-CSC 401", "title": "Compiler Construction", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "AUE-CSC 403", "code": "AUE-CSC 403", "title": "Modelling and Simulation", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "SEN 401", "code": "SEN 401", "title": "Software Configuration Management and Maintenance", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45, "elective_group": "cs-400-first-select-one"}, {"programme": "Computer Science", "level": 400, "semester": 1, "source_code": "IFT 403", "code": "IFT 403", "title": "Mobile and Pervasive Computing", "units": 2, "status": "E", "lecture_hours": 30, "practical_hours": 0, "elective_group": "cs-400-first-select-one"}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "CSC 402", "code": "CSC 402", "title": "Ethics and Legal Issues in Computer Science", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "CSC 498", "code": "CSC 498", "title": "Final Year Project II", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "AUE-CSC 402", "code": "AUE-CSC 402", "title": "Collaborative Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "AUE-CSC 404", "code": "AUE-CSC 404", "title": "Information Theory System", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "AUE-CSC 406", "code": "AUE-CSC 406", "title": "Analogue Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Computer Science", "level": 400, "semester": 2, "source_code": "AUE-CSC 408", "code": "AUE-CSC 408", "title": "Assembly Language", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "ENT 211", "code": "ENT 211", "title": "Entrepreneurship and Innovation", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "AUE-GST 201", "code": "AUE-GST 201", "title": "Philosophy of Education", "units": 1, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "AUE-GST 221", "code": "AUE-GST 221", "title": "Communication in French", "units": 2, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "CYB 201", "code": "CYB 201", "title": "Introduction to Cybersecurity and Strategy", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "CYB 203", "code": "CYB 203", "title": "Cybercrime, Law and Countermeasures", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "COS 201", "code": "COS 201", "title": "Computer Programming I", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "SEN 201", "code": "SEN 201", "title": "Introduction to Software Engineering", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "MTH 201", "code": "MTH 201", "title": "Mathematical Methods I", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 1, "source_code": "STA 121", "code": "STA 121", "title": "Statistical Inference I", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "GST 212", "code": "GST 212", "title": "Philosophy, Logic and Human Existence", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "AUE-GST 200", "code": "AUE-GST 200", "title": "Student Life Seminar", "units": 0, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "AUE-GST 202", "code": "AUE-GST 202", "title": "Life and Teachings of Christ", "units": 1, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "AUE-CYB 202", "code": "AUE-CYB 202", "title": "System and Network Administration", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "COS 202", "code": "COS 202", "title": "Computer Programming II", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "INS 204", "code": "INS 204", "title": "Systems Analysis and Design", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "AUE-CSC 204", "code": "AUE-CSC 204", "title": "Web Technologies", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 200, "semester": 2, "source_code": "CYB 299", "code": "CYB 299", "title": "SIWES I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "CYB 301", "code": "CYB 301", "title": "Cryptography Techniques, Algorithms and Applications", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "CYB 303", "code": "CYB 303", "title": "Cybersecurity Risks Analysis, Challenges and Mitigation", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "CYB 305", "code": "CYB 305", "title": "Digital Forensics and Investigation Methods", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "CSC 309", "code": "CSC 309", "title": "Artificial Intelligence", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "AUE-CSC 301", "code": "AUE-CSC 301", "title": "Formal Theory of Computation and Automata", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "AUE-CYB 303", "code": "AUE-CYB 303", "title": "Linux Fundamentals", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 1, "source_code": "AUE-CYB 307", "code": "AUE-CYB 307", "title": "Software Defined Networks", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "GST 312", "code": "GST 312", "title": "Peace and Conflict Resolution", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "ENT 312", "code": "ENT 312", "title": "Venture Creation", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "CYB 302", "code": "CYB 302", "title": "Biometrics Security", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "CYB 304", "code": "CYB 304", "title": "Information and Big Data Security", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "CYB 322", "code": "CYB 322", "title": "Cybersecurity Innovation and Entrepreneurship", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "AUE-CSC 302", "code": "AUE-CSC 302", "title": "Information System Concept", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 300, "semester": 2, "source_code": "CYB 399", "code": "CYB 399", "title": "SIWES II", "units": 3, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "CYB 401", "code": "CYB 401", "title": "Systems Vulnerability Assessment and Testing", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "CYB 403", "code": "CYB 403", "title": "Cyber Threat Intelligence and Cyber Conflict", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "CYB 405", "code": "CYB 405", "title": "Ethical Hacking and Reverse Engineering", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "COS 409", "code": "COS 409", "title": "Research Methodology and Technical Report Writing", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "AUE-CSC 401", "code": "AUE-CSC 401", "title": "Compiler Construction", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "AUE-CSC 403", "code": "AUE-CSC 403", "title": "Modelling and Simulation", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 400, "semester": 1, "source_code": "CYB 497", "code": "CYB 497", "title": "Final Year Project I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "CYB 402", "code": "CYB 402", "title": "Steganography: Access Methods and Data Hiding", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "CYB 404", "code": "CYB 404", "title": "Cloud Computing Security", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "CYB 406", "code": "CYB 406", "title": "Deep and Dark Web Security", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "AUE-CSC 402", "code": "AUE-CSC 402", "title": "Collaborative Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "AUE-CSC 404", "code": "AUE-CSC 404", "title": "Information Theory System", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "AUE-CSC 406", "code": "AUE-CSC 406", "title": "Analogue Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "AUE-CSC 408", "code": "AUE-CSC 408", "title": "Assembly Language", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Cybersecurity", "level": 400, "semester": 2, "source_code": "CYB 498", "code": "CYB 498", "title": "Final Year Project II", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "ENT 211", "code": "ENT 211", "title": "Entrepreneurship and Innovation", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "AUE-GST 201", "code": "AUE-GST 201", "title": "Philosophy of Education", "units": 1, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "AUE-GST 221", "code": "AUE-GST 221", "title": "Communication in French", "units": 2, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "SEN 201", "code": "SEN 201", "title": "Introduction to Software Engineering", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "COS 201", "code": "COS 201", "title": "Computer Programming I", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "COS 203", "code": "CSC 203", "title": "Discrete Structures", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "MTH 201", "code": "MTH 201", "title": "Mathematical Methods I", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "STA 121", "code": "STA 121", "title": "Statistical Inference I", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 1, "source_code": "IFT 211", "code": "IFT 211", "title": "Digital Logic Design", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "GST 212", "code": "GST 212", "title": "Philosophy, Logic and Human Existence", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "AUE-GST 200", "code": "AUE-GST 200", "title": "Student Life Seminar", "units": 0, "status": "R", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "AUE-GST 202", "code": "AUE-GST 202", "title": "Life and Teachings of Christ", "units": 1, "status": "R", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "COS 202", "code": "COS 202", "title": "Computer Programming II", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "MTH 202", "code": "MTH 202", "title": "Mathematical Methods II", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "INS 204", "code": "INS 204", "title": "Systems Analysis and Design", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "IFT 212", "code": "IFT 212", "title": "Computer Architecture and Organisation", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "AUE-CSC 202", "code": "AUE-CSC 202", "title": "System Analysis and Design", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": 0}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "AUE-CSC 204", "code": "AUE-CSC 204", "title": "Web Technologies", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 200, "semester": 2, "source_code": "SEN 299", "code": "SEN 299", "title": "SIWES I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "SEN 301", "code": "SEN 301", "title": "Object-Oriented Analysis and Design", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "CSC 301", "code": "CSC 301", "title": "Data Structures", "units": 3, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "CSC 309", "code": "CSC 309", "title": "Artificial Intelligence", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "AUE-CSC 301", "code": "AUE-CSC 301", "title": "Formal Theory of Computation and Automata", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "AUE-CSC 303", "code": "AUE-CSC 303", "title": "E-Commerce", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "AUE-CYB 305", "code": "AUE-CYB 305", "title": "Threat, Exploits and Counter measures", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 1, "source_code": "AUE-CYB 307", "code": "AUE-CYB 307", "title": "Software Defined Networks", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 0}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "GST 312", "code": "GST 312", "title": "Peace and Conflict Resolution", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "ENT 312", "code": "ENT 312", "title": "Venture Creation", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "SEN 304", "code": "SEN 304", "title": "Software Testing and Quality Assurance", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "SEN 306", "code": "SEN 306", "title": "Software Construction", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "SEN 322", "code": "SEN 322", "title": "Software Engineering Innovation and New Technology", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "CSC 308", "code": "CSC 308", "title": "Operating Systems", "units": 3, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "AUE-CSC 302", "code": "AUE-CSC 302", "title": "Information System Concept", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 300, "semester": 2, "source_code": "SEN 399", "code": "SEN 399", "title": "SIWES II", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "SEN 401", "code": "SEN 401", "title": "Software Configuration Management and Maintenance", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "COS 409", "code": "COS 409", "title": "Research Methodology and Technical Report Writing", "units": 3, "status": "C", "lecture_hours": 45, "practical_hours": null, "source_variants": [{"source_row": 2, "practical_hours": 0}, {"source_row": 4, "practical_hours": 45}], "notes": ["Duplicate printed row consolidated; conflicting practical hours remain unknown."]}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "INS 401", "code": "INS 401", "title": "Project Management", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "AUE-CSC 401", "code": "AUE-CSC 401", "title": "Compiler Construction", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "AUE-CSC 403", "code": "AUE-CSC 403", "title": "Modelling and Simulation", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 1, "source_code": "SEN 497", "code": "SEN 497", "title": "Final Year Project I", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "SEN 410", "code": "SEN 410", "title": "Software Architecture and Design", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "CYB 404", "code": "CYB 404", "title": "Cloud Computing Security", "units": 2, "status": "C", "lecture_hours": 30, "practical_hours": 0}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "CYB 406", "code": "CYB 406", "title": "Deep and Dark Web Security", "units": 2, "status": "C", "lecture_hours": 15, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "AUE-CSC 402", "code": "AUE-CSC 402", "title": "Collaborative Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "AUE-CSC 404", "code": "AUE-CSC 404", "title": "Information Theory System", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "AUE-CSC 406", "code": "AUE-CSC 406", "title": "Analogue Computing", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "AUE-CSC 408", "code": "AUE-CSC 408", "title": "Assembly Language", "units": 3, "status": "C", "lecture_hours": 30, "practical_hours": 45}, {"programme": "Software Engineering", "level": 400, "semester": 2, "source_code": "SEN 498", "code": "SEN 498", "title": "Final Year Project II", "units": 3, "status": "C", "lecture_hours": 0, "practical_hours": 135}]'::jsonb) x
left join public.departments d on d.university_id=u and d.name=x->>'programme'
left join public.levels l on l.university_id=u and l.label=(x->>'level')||' Level'
left join public.courses c on c.code=x->>'code'
left join public.curriculum_courses cc on cc.department_id=d.id and cc.level_id=l.id and cc.semester_number=(x->>'semester')::integer and cc.course_id=c.id
where cc.id is null or not cc.active or cc.unit_count is distinct from (x->>'units')::integer
or cc.requirement_status is distinct from x->>'status'
or cc.elective_group is distinct from x->>'elective_group'
or cc.source_code is distinct from x->>'source_code' or cc.source_title is distinct from x->>'title'
or (x->>'lecture_hours' is not null and cc.lecture_hours is distinct from (x->>'lecture_hours')::integer)
or (x->>'practical_hours' is not null and cc.practical_hours is distinct from (x->>'practical_hours')::integer)
) then raise exception 'Source-row metadata mismatch'; end if;

for r in select * from (values ('Computer Science',100,1,10,19,8),('Computer Science',100,2,8,17,7),('Computer Science',200,1,10,21,10),('Computer Science',200,2,9,19,9),('Computer Science',300,1,8,20,5),('Computer Science',300,2,7,18,7),('Computer Science',400,1,8,20,6),('Computer Science',400,2,6,17,6),('Cybersecurity',200,1,9,19,9),('Cybersecurity',200,2,8,17,8),('Cybersecurity',300,1,7,16,7),('Cybersecurity',300,2,7,16,7),('Cybersecurity',400,1,7,18,7),('Cybersecurity',400,2,8,21,8),('Software Engineering',200,1,9,19,9),('Software Engineering',200,2,10,22,10),('Software Engineering',300,1,7,18,7),('Software Engineering',300,2,8,19,8),('Software Engineering',400,1,6,16,6),('Software Engineering',400,2,8,21,8)) v(programme,level,semester,courses,units,required) loop
  begin
    select id into strict d from public.departments where university_id=u and name=r.programme;
    select id into strict l from public.levels where university_id=u and label=r.level::text||' Level';
    select id into strict s from public.semesters where academic_period_id=p and sort_order=r.semester;
    student:=gen_random_uuid();
    insert into auth.users(id,email,raw_user_meta_data) values(student,student::text||'@pdf-catalogue-verification.invalid','{"display_name":"Catalogue verification"}');
    perform private.apply_academic_profile(student,student,u,f,d,l,p,s,'initial',null,null);
    select count(*) into actual from public.enrollments where user_id=student and ended_at is null;
    if actual<>r.required then raise exception 'Auto-assignment mismatch: % % % got % expected %',r.programme,r.level,r.semester,actual,r.required; end if;
    if exists(select 1 from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=student and (o.elective_group is not null or o.requirement_status='E')) then raise exception 'Elective auto-assigned'; end if;
    perform private.assign_required_courses(student);
    select count(*) into actual from public.enrollments where user_id=student and ended_at is null;
    if actual<>r.required then raise exception 'Assignment replay mismatch'; end if;
    perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated')::text,true);
    perform set_config('request.jwt.claim.sub',student::text,true);
    perform set_config('role','authenticated',true);
    catalog:=public.get_catalog_v1();
    if jsonb_array_length(catalog->'offerings')<>r.courses then raise exception 'Catalog mismatch: % % %',r.programme,r.level,r.semester; end if;
    select sum((x->>'unit_count')::integer) into actual from jsonb_array_elements(catalog->'offerings') x;
    if actual<>r.units then raise exception 'Catalog units mismatch'; end if;
    select count(*) into actual from jsonb_array_elements(catalog->'offerings') x where (x->>'enrolled')::boolean;
    if actual<>r.required then raise exception 'Catalog enrollment mismatch'; end if;
    overview:=public.get_course_overview_v1((catalog->'offerings'->0->>'offering_id')::uuid);
    if (overview->'progress'->>'lessons_total')::integer<>0 or (overview->>'battle_ready')::boolean is distinct from false then raise exception 'Unexpected readiness'; end if;
    if r.programme='Computer Science' and r.level in (300,400) and r.semester=1 then
      select (x->>'offering_id')::uuid into option1 from jsonb_array_elements(catalog->'offerings') x where x->>'elective_group' is not null limit 1;
      select (x->>'offering_id')::uuid into option2 from jsonb_array_elements(catalog->'offerings') x where x->>'elective_group' is not null and (x->>'offering_id')::uuid<>option1 limit 1;
      if option1 is null or option2 is null then raise exception 'Missing elective alternatives'; end if;
      perform public.enroll_course_v1(option1,gen_random_uuid());
      begin
        perform public.enroll_course_v1(option2,gen_random_uuid());
        raise exception 'Second elective was accepted';
      exception when sqlstate 'PT422' then null; end;
    end if;
    results:=results||jsonb_build_array(jsonb_build_object('programme',r.programme,'level',r.level,'semester',r.semester,'catalog_courses',r.courses,'required_assigned',r.required,'listed_units',r.units,'passed',true));
    raise exception using errcode='ZC001',message='Rollback test student';
  exception when sqlstate 'ZC001' then null; end;
end loop;
-- First-year curriculum is explicitly absent for the other two programmes.
if exists(select 1 from public.curriculum_courses cc join public.departments d on d.id=cc.department_id join public.levels l on l.id=cc.level_id where cc.university_id=u and l.label='100 Level' and d.name in ('Cybersecurity','Software Engineering')) then raise exception 'Unsupported first-year curriculum'; end if;
if exists(select 1 from auth.users where email like '%@pdf-catalogue-verification.invalid') then raise exception 'Verification data leaked'; end if;
perform set_config('scholau.pdf_catalogue_verification',results::text,true);
end $$;
select current_setting('scholau.pdf_catalogue_verification')::jsonb as verification;


do $$ begin
if exists(select 1 from catalogue_preservation_snapshot b left join (
select 'courses' as table_name,id::text as row_key,to_jsonb(c) as row_data from public.courses c
union all select 'offerings',id::text,jsonb_build_object('id',id,'course_id',course_id,'status',status) from public.course_offerings
union all select 'enrollments',user_id::text||':'||offering_id::text,to_jsonb(e) from public.enrollments e
union all select 'progress',user_id::text||':'||lesson_id::text,to_jsonb(lp) from public.lesson_progress lp
union all select 'attempts',id::text,to_jsonb(a) from public.assessment_attempts a
) a using(table_name,row_key) where a.row_data is distinct from b.row_data) then
raise exception 'Existing courses, offering statuses, active enrollments, progress or attempts changed'; end if;
end $$;
commit;
select jsonb_build_object(
'migration_recorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261016000100'),
'automatic_assignment_recorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261015000400'),
'requirements',(select count(*) from public.curriculum_courses cc join public.universities u on u.id=cc.university_id where u.slug='adeleke-university-ede-osun-state'),
'temporary_users_remaining',(select count(*) from auth.users where email like '%@pdf-catalogue-verification.invalid'),
'coverage',(select jsonb_agg(x) from (select d.name,l.label,cc.semester_number,count(*) as courses,sum(cc.unit_count) as listed_units
from public.curriculum_courses cc join public.departments d on d.id=cc.department_id join public.levels l on l.id=cc.level_id
join public.universities u on u.id=cc.university_id where u.slug='adeleke-university-ede-osun-state'
group by d.name,l.label,cc.semester_number order by d.name,l.label,cc.semester_number) x)) as deployment;
