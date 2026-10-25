-- Course form supplied by owner: Engineering 100 Level first semester 2026/2027.
-- Shared courses apply to six Engineering departments. Five departmental codes confirmed.
-- Full titles for CPE/MEE/CEE/CHE not supplied; explicitly marked pending.
-- Agricultural departmental code is unconfirmed: shared courses only.
create temp table requested_engineering(department text,code text,title text,units int,position int) on commit drop;
insert into requested_engineering values
('Electrical and Electronics Engineering','GET 101','Engineer in Society',1,1),
('Electrical and Electronics Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Electrical and Electronics Engineering','PHY 107','General Practical Physics I',1,3),
('Electrical and Electronics Engineering','PHY 101','General Physics I',2,4),
('Electrical and Electronics Engineering','CHM 107','Practical Chemistry I',1,5),
('Electrical and Electronics Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Electrical and Electronics Engineering','MTH 103','Elementary Mathematics III',2,7),
('Electrical and Electronics Engineering','MTH 101','Elementary Mathematics I',2,8),
('Electrical and Electronics Engineering','AUE-GST 101','Use of Library',2,9),
('Electrical and Electronics Engineering','CHM 101','General Chemistry I',2,10),
('Electrical and Electronics Engineering','GST 111','Communication in English',2,11),
('Electrical and Electronics Engineering','AUE-EEE 101','Introduction to Electrical and Electronics Engineering Practical I',1,12),
('Computer Engineering','GET 101','Engineer in Society',1,1),
('Computer Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Computer Engineering','PHY 107','General Practical Physics I',1,3),
('Computer Engineering','PHY 101','General Physics I',2,4),
('Computer Engineering','CHM 107','Practical Chemistry I',1,5),
('Computer Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Computer Engineering','MTH 103','Elementary Mathematics III',2,7),
('Computer Engineering','MTH 101','Elementary Mathematics I',2,8),
('Computer Engineering','AUE-GST 101','Use of Library',2,9),
('Computer Engineering','CHM 101','General Chemistry I',2,10),
('Computer Engineering','GST 111','Communication in English',2,11),
('Computer Engineering','AUE-CPE 101','AUE-CPE 101 — title pending confirmation',1,12),
('Mechanical Engineering','GET 101','Engineer in Society',1,1),
('Mechanical Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Mechanical Engineering','PHY 107','General Practical Physics I',1,3),
('Mechanical Engineering','PHY 101','General Physics I',2,4),
('Mechanical Engineering','CHM 107','Practical Chemistry I',1,5),
('Mechanical Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Mechanical Engineering','MTH 103','Elementary Mathematics III',2,7),
('Mechanical Engineering','MTH 101','Elementary Mathematics I',2,8),
('Mechanical Engineering','AUE-GST 101','Use of Library',2,9),
('Mechanical Engineering','CHM 101','General Chemistry I',2,10),
('Mechanical Engineering','GST 111','Communication in English',2,11),
('Mechanical Engineering','AUE-MEE 101','AUE-MEE 101 — title pending confirmation',1,12),
('Civil Engineering','GET 101','Engineer in Society',1,1),
('Civil Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Civil Engineering','PHY 107','General Practical Physics I',1,3),
('Civil Engineering','PHY 101','General Physics I',2,4),
('Civil Engineering','CHM 107','Practical Chemistry I',1,5),
('Civil Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Civil Engineering','MTH 103','Elementary Mathematics III',2,7),
('Civil Engineering','MTH 101','Elementary Mathematics I',2,8),
('Civil Engineering','AUE-GST 101','Use of Library',2,9),
('Civil Engineering','CHM 101','General Chemistry I',2,10),
('Civil Engineering','GST 111','Communication in English',2,11),
('Civil Engineering','AUE-CEE 101','AUE-CEE 101 — title pending confirmation',1,12),
('Chemical Engineering','GET 101','Engineer in Society',1,1),
('Chemical Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Chemical Engineering','PHY 107','General Practical Physics I',1,3),
('Chemical Engineering','PHY 101','General Physics I',2,4),
('Chemical Engineering','CHM 107','Practical Chemistry I',1,5),
('Chemical Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Chemical Engineering','MTH 103','Elementary Mathematics III',2,7),
('Chemical Engineering','MTH 101','Elementary Mathematics I',2,8),
('Chemical Engineering','AUE-GST 101','Use of Library',2,9),
('Chemical Engineering','CHM 101','General Chemistry I',2,10),
('Chemical Engineering','GST 111','Communication in English',2,11),
('Chemical Engineering','AUE-CHE 101','AUE-CHE 101 — title pending confirmation',1,12),
('Agricultural and Biosystems Engineering','GET 101','Engineer in Society',1,1),
('Agricultural and Biosystems Engineering','AUE-GST 100','Students Life Seminar',0,2),
('Agricultural and Biosystems Engineering','PHY 107','General Practical Physics I',1,3),
('Agricultural and Biosystems Engineering','PHY 101','General Physics I',2,4),
('Agricultural and Biosystems Engineering','CHM 107','Practical Chemistry I',1,5),
('Agricultural and Biosystems Engineering','PHY 103','General Physics III (Behaviour of Matters)',2,6),
('Agricultural and Biosystems Engineering','MTH 103','Elementary Mathematics III',2,7),
('Agricultural and Biosystems Engineering','MTH 101','Elementary Mathematics I',2,8),
('Agricultural and Biosystems Engineering','AUE-GST 101','Use of Library',2,9),
('Agricultural and Biosystems Engineering','CHM 101','General Chemistry I',2,10),
('Agricultural and Biosystems Engineering','GST 111','Communication in English',2,11);
create temp table engineering_scope on commit drop as
select d.id department_id,d.name,d.university_id,l.id level_id,s.id semester_id from public.departments d
join public.universities u on u.id=d.university_id and u.slug='adeleke-university-ede-osun-state'
join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Engineering'
join public.levels l on l.university_id=u.id and l.sort_order=100 and l.active
join public.academic_periods ap on ap.university_id=u.id and ap.label='2026/2027' and ap.active
join public.semesters s on s.academic_period_id=ap.id and s.sort_order=1 and s.active
where d.active and d.name in(select distinct department from requested_engineering);
create temp table preserved_engineering_other on commit drop as select o.* from public.course_offerings o where not exists(select 1 from engineering_scope s where o.department_id=s.department_id and o.level_id=s.level_id and o.semester_id=s.semester_id);
create temp table preserved_engineering_enrollments on commit drop as select user_id,offering_id from public.enrollments;
do $$ begin
 if (select count(*) from engineering_scope)<>6 or (select count(*) from requested_engineering)<>71 then raise exception 'Engineering source/scope mismatch'; end if;
 if exists(select 1 from requested_engineering group by department having sum(units)<>case when department='Agricultural and Biosystems Engineering' then 17 else 18 end) then raise exception 'Engineering units mismatch'; end if;
end $$;
insert into public.courses(code,title) select distinct code,title from requested_engineering on conflict(code) do nothing;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,source_code,source_title)
select s.university_id,s.department_id,s.level_id,1,c.id,r.units,'R',r.position,'Owner-supplied Engineering 100 Level first-semester registration form, 2026/2027; department substitutions confirmed 25 October 2026. Agricultural departmental course and four replacement titles pending confirmation.',r.code,r.title from requested_engineering r join engineering_scope s on s.name=r.department join public.courses c on c.code=r.code
on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,source_code,source_title)
select c.id,s.university_id,s.department_id,s.level_id,s.semester_id,'published',r.units,'R',r.code,r.title from requested_engineering r join engineering_scope s on s.name=r.department join public.courses c on c.code=r.code
on conflict(course_id,department_id,level_id,semester_id) do update set status='published',unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,source_code=excluded.source_code,source_title=excluded.source_title;
do $$ begin
 if (select count(*) from requested_engineering r join engineering_scope s on s.name=r.department join public.courses c on c.code=r.code join public.course_offerings o on o.department_id=s.department_id and o.level_id=s.level_id and o.semester_id=s.semester_id and o.course_id=c.id where o.status='published' and o.unit_count=r.units)<>71 then raise exception 'Expected all 71 Engineering course offerings'; end if;
 if exists(select * from preserved_engineering_other except select * from public.course_offerings) then raise exception 'Unrelated offerings changed'; end if;
 if exists(select * from preserved_engineering_enrollments except select user_id,offering_id from public.enrollments) then raise exception 'Existing enrollment removed'; end if;
end $$;
