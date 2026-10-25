-- Owner-provided PharmD outline for 100 Level, first semester, 2026/2027.
-- Medicine uses the same courses except COS 101 (printed AUE-COS 101).
-- Printed GES/COS aliases are preserved without duplicating shared courses.
create temp table requested_pharmacy_100(code text,printed_code text,title text,units int,status text,lh int,ph int,position int) on commit drop;
insert into requested_pharmacy_100 values
('GST 111','GST 111','Communication in English',2,'C',15,45,1),
('BIO 101','BIO 101','General Biology I',2,'C',30,null,2),
('BIO 107','BIO 107','General Biology Practical I',1,'C',null,45,3),
('CHM 101','CHM 101','General Chemistry I',2,'C',30,null,4),
('CHM 107','CHM 107','General Chemistry Practical I',1,'C',null,45,5),
('MTH 101','MTH 101','Elementary Mathematics I',2,'C',30,null,6),
('PHY 101','PHY 101','General Physics I',2,'C',30,null,7),
('PHY 107','PHY 107','General Physics Practical I',1,'C',null,45,8),
('AUE-GST 100','AUE-GES 100','Students Life Seminar',0,'R',15,null,9),
('AUE-GST 101','AUE-GES 101','Use of Library',2,'C',30,null,10),
('COS 101','AUE-COS 101','Introduction to Computer Sciences',3,'C',30,45,11);
create temp table pharmacy_medicine_departments on commit drop as
select d.id,d.university_id,l.id level_id,s.id semester_id,(d.name='Pharmacy (PharmD)') include_computing from public.departments d
join public.faculties f on f.id=d.faculty_id
join public.universities u on u.id=d.university_id and u.slug='adeleke-university-ede-osun-state'
join public.levels l on l.university_id=u.id and l.sort_order=100 and l.active
join public.academic_periods ap on ap.university_id=u.id and ap.label='2026/2027' and ap.active
join public.semesters s on s.academic_period_id=ap.id and s.sort_order=1 and s.active
where d.active and d.name in ('Pharmacy (PharmD)','Medicine and Surgery (MBBS)');
create temp table preserved_other_offerings on commit drop as
select o.* from public.course_offerings o where not exists(select 1 from pharmacy_medicine_departments d join requested_pharmacy_100 r on true join public.courses c on c.code=r.code where o.department_id=d.id and o.level_id=d.level_id and o.semester_id=d.semester_id and o.course_id=c.id);
create temp table preserved_existing_enrollments on commit drop as select user_id,offering_id from public.enrollments;
do $$ begin
 if (select count(*) from pharmacy_medicine_departments)<>2 then raise exception 'Expected Pharmacy and Medicine departments'; end if;
 if (select count(*) from requested_pharmacy_100)<>11 or (select sum(units) from requested_pharmacy_100)<>18 then raise exception 'Source row or unit mismatch'; end if;
end $$;
insert into public.courses(code,title) select code,title from requested_pharmacy_100 on conflict(code) do nothing;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,source_code,source_title)
select d.university_id,d.id,d.level_id,1,c.id,r.units,r.status,r.position,'Owner-supplied PharmD 100 Level first-semester 2026/2027 DOCX, 25 October 2026; Medicine follows the same outline except computing. Printed AUE-GES 100/101 and AUE-COS 101 reuse shared canonical course identities.',r.lh,r.ph,r.printed_code,r.title
from pharmacy_medicine_departments d cross join requested_pharmacy_100 r join public.courses c on c.code=r.code
where d.include_computing or r.code<>'COS 101'
on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,lecture_hours,practical_hours,source_code,source_title)
select c.id,d.university_id,d.id,d.level_id,d.semester_id,'published',r.units,r.status,r.lh,r.ph,r.printed_code,r.title from pharmacy_medicine_departments d cross join requested_pharmacy_100 r join public.courses c on c.code=r.code
where d.include_computing or r.code<>'COS 101'
on conflict(course_id,department_id,level_id,semester_id) do update set status='published',unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title;
do $$ declare student record; begin
 for student in select p.id from public.profiles p join pharmacy_medicine_departments d on d.id=p.department_id and d.level_id=p.level_id and d.semester_id=p.semester_id where p.deactivated_at is null
 loop perform private.assign_required_courses(student.id); end loop;
 if (select count(*) from pharmacy_medicine_departments d cross join requested_pharmacy_100 r join public.courses c on c.code=r.code join public.course_offerings o on o.department_id=d.id and o.level_id=d.level_id and o.semester_id=d.semester_id and o.course_id=c.id where o.status='published' and o.unit_count=r.units and o.requirement_status=r.status and o.source_title=r.title and o.lecture_hours is not distinct from r.lh and o.practical_hours is not distinct from r.ph)<>21 then raise exception 'Expected 11 Pharmacy and 10 Medicine offerings'; end if;
 if exists(select 1 from public.course_offerings o join pharmacy_medicine_departments d on d.id=o.department_id and d.level_id=o.level_id and d.semester_id=o.semester_id join public.courses c on c.id=o.course_id where not d.include_computing and c.code='COS 101') then raise exception 'Medicine must not include COS 101'; end if;
 if exists(select * from preserved_other_offerings except select * from public.course_offerings) then raise exception 'An unrelated offering changed'; end if;
 if exists(select user_id,offering_id from preserved_existing_enrollments except select user_id,offering_id from public.enrollments) then raise exception 'An existing enrollment was removed'; end if;
end $$;
