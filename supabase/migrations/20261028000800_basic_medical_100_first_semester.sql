-- Owner-supplied common Basic Medical Sciences curriculum, screenshot 25 October 2026.
-- 100 Level, first semester. Applied to the current active 2026/2027 session.
-- Printed titles are offering-specific; canonical shared course identities are preserved.
-- Existing additional courses, including the MLS elective, are retained.
create temp table requested_medical_100(code text,title text,units int,status text,lh int,ph int,position int) on commit drop;
insert into requested_medical_100 values
('GST 111','Communication in English',2,'C',15,45,1),
('AUE-GST 100','Students Life Seminar',0,'R',15,null,2),
('AUE-GST 101','Use of Library',2,'C',30,null,3),
('BIO 101','General Biology I',2,'C',30,null,4),
('BIO 107','General Biology Practical I',1,'C',null,45,5),
('CHM 101','General Chemistry I',2,'C',30,null,6),
('CHM 107','General Chemistry Practical I',1,'C',null,45,7),
('PHY 101','General Physics I (Mechanics)',2,'C',30,null,8),
('PHY 107','General Physics Practical I',1,'C',null,45,9),
('MTH 101','Elementary Mathematics I',2,'C',30,null,10),
('COS 101','Introduction to Computing Sciences',3,'C',30,45,11);
create temp table medical_departments on commit drop as
select d.id,d.university_id,l.id level_id,s.id semester_id from public.departments d
join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Basic Medical Sciences'
join public.universities u on u.id=d.university_id and u.slug='adeleke-university-ede-osun-state'
join public.levels l on l.university_id=u.id and l.sort_order=100 and l.active
join public.academic_periods ap on ap.university_id=u.id and ap.label='2026/2027' and ap.active
join public.semesters s on s.academic_period_id=ap.id and s.sort_order=1 and s.active
where d.active and d.name in ('Anatomy','Medical Laboratory Science','Physiology','Public Health','Nursing Sciences','Health Information Management');
create temp table preserved_other_offerings on commit drop as
select o.* from public.course_offerings o where not exists(select 1 from medical_departments d join requested_medical_100 r on true join public.courses c on c.code=r.code where o.department_id=d.id and o.level_id=d.level_id and o.semester_id=d.semester_id and o.course_id=c.id);
create temp table preserved_existing_enrollments on commit drop as select user_id,offering_id from public.enrollments;
do $$ begin
 if (select count(*) from medical_departments)<>6 then raise exception 'Expected six matching medical departments'; end if;
 if (select count(*) from requested_medical_100)<>11 or (select sum(units) from requested_medical_100)<>18 then raise exception 'Source row or unit mismatch'; end if;
end $$;
insert into public.courses(code,title) select code,title from requested_medical_100 on conflict(code) do nothing;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,source_code,source_title)
select d.university_id,d.id,d.level_id,1,c.id,r.units,r.status,r.position,'Owner-supplied Basic Medical Sciences 100 Level first-semester table, 25 October 2026; 11 courses, 18 units; applies to Anatomy, MLS, Physiology, Public Health, Nursing and HIM.',r.lh,r.ph,r.code,r.title
from medical_departments d cross join requested_medical_100 r join public.courses c on c.code=r.code
on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,lecture_hours,practical_hours,source_code,source_title)
select c.id,d.university_id,d.id,d.level_id,d.semester_id,'published',r.units,r.status,r.lh,r.ph,r.code,r.title from medical_departments d cross join requested_medical_100 r join public.courses c on c.code=r.code
on conflict(course_id,department_id,level_id,semester_id) do update set status='published',unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title;
do $$ declare student record; begin
 for student in select p.id from public.profiles p join medical_departments d on d.id=p.department_id and d.level_id=p.level_id and d.semester_id=p.semester_id where p.deactivated_at is null
 loop perform private.assign_required_courses(student.id); end loop;
 if (select count(*) from medical_departments d cross join requested_medical_100 r join public.courses c on c.code=r.code join public.course_offerings o on o.department_id=d.id and o.level_id=d.level_id and o.semester_id=d.semester_id and o.course_id=c.id where o.status='published' and o.unit_count=r.units and o.requirement_status=r.status and o.source_title=r.title and o.lecture_hours is not distinct from r.lh and o.practical_hours is not distinct from r.ph)<>66 then raise exception 'Expected all 66 requested department/course offerings'; end if;
 if exists(select * from preserved_other_offerings except select * from public.course_offerings) then raise exception 'An unrelated offering changed'; end if;
 if exists(select user_id,offering_id from preserved_existing_enrollments except select user_id,offering_id from public.enrollments) then raise exception 'An existing enrollment was removed'; end if;
end $$;
