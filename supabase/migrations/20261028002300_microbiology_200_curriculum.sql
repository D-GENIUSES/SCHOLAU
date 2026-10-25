-- Owner-provided Microbiology 200-level course table, page 17, 25 October 2026.
-- Printed elective rows are retained without inventing an elective selection quota.
create temp table requested_mcb(semester int,code text,title text,units int,status text,lh int,ph int,position int) on commit drop;
insert into requested_mcb values
(1,'ENT 211','Entrepreneurship and Innovation',2,'C',30,null,1),
(1,'AUE-GST 221','Communication in French',2,'R',30,null,2),
(1,'AUE-GST 201','Philosophy of Education',1,'C',15,null,3),
(1,'MCB 221','General Microbiology',2,'C',30,null,4),
(1,'MCB 231','Basic Techniques in Microbiology',2,'C',null,90,5),
(1,'BCH 201','General Biochemistry I',2,'C',30,null,6),
(1,'AUE-MCB 215','Soil Microbiology',2,'C',30,null,7),
(1,'AUE-MCB 233','Neglected Tropical Diseases',2,'C',30,null,8),
(1,'AUE-BIO 211','Introduction to Invertebrates Animals',2,'E',45,45,9),
(1,'AUE-BIO 231','Introduction to Seedless Plant',2,'E',30,45,10),
(2,'GST 212','Philosophy, Logic and Human Existence',2,'C',30,null,1),
(2,'AUE-GST 200','Student Life Seminar',0,'C',15,null,2),
(2,'AUE-GST 202','Life and Teachings of Christ',1,'C',15,null,3),
(2,'BIO 208','Biostatistics',2,'C',30,45,4),
(2,'AUE-MCB 214','Communication Skills in Microbiology',2,'C',30,null,5),
(2,'AUE-MCB 216','Plant Microbiology',2,'E',15,45,6),
(2,'AUE-MCB 218','Aquatic Microbiology',2,'C',15,45,7),
(2,'AUE-MCB 232','Bioinformatics in Microbiology',2,'C',15,45,8),
(2,'AUE-MCB 234','Phycology',3,'E',30,45,9),
(2,'AUE-BIO 232','Introduction to Seed Plants',2,'E',30,45,10),
(2,'MCB 299','Industrial Attachment II',3,'C',null,135,11);
create temp table mcb_scope on commit drop as
select d.id department_id,d.university_id,l.id level_id,s.id semester_id,s.sort_order semester
from public.departments d join public.universities u on u.id=d.university_id and u.slug='adeleke-university-ede-osun-state'
join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Science'
join public.levels l on l.university_id=u.id and l.sort_order=200 and l.active
join public.academic_periods ap on ap.university_id=u.id and ap.label='2026/2027' and ap.active
join public.semesters s on s.academic_period_id=ap.id and s.sort_order in(1,2) and s.active
where d.name='Microbiology' and d.active;
do $$ begin if (select count(*) from mcb_scope)<>2 then raise exception 'Expected both active Microbiology semesters'; end if; end $$;
insert into public.courses(code,title) select code,title from requested_mcb on conflict(code) do nothing;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,source_code,source_title)
select s.university_id,s.department_id,s.level_id,r.semester,c.id,r.units,r.status,r.position,
'Owner-provided Microbiology 200-level course table p17, 2026-10-25; 2026/2027. Semester totals 19 and 21; AUE-GST 200 is S/U (zero numerical credits); elective quota not specified.',r.lh,r.ph,r.code,r.title
from requested_mcb r join mcb_scope s on s.semester=r.semester join public.courses c on c.code=r.code
on conflict(department_id,level_id,semester_number,course_id) do update set unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,lecture_hours,practical_hours,source_code,source_title)
select c.id,s.university_id,s.department_id,s.level_id,s.semester_id,'published',r.units,r.status,r.lh,r.ph,r.code,r.title
from requested_mcb r join mcb_scope s on s.semester=r.semester join public.courses c on c.code=r.code
on conflict(course_id,department_id,level_id,semester_id) do update set status='published',unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,source_code=excluded.source_code,source_title=excluded.source_title;
do $$ declare p record; begin
 for p in select id from public.profiles where department_id in(select department_id from mcb_scope) and level_id in(select level_id from mcb_scope) and deactivated_at is null
 loop perform private.assign_required_courses(p.id); end loop;
 if (select count(*) from requested_mcb r join mcb_scope s on s.semester=r.semester join public.courses c on c.code=r.code join public.course_offerings o on o.course_id=c.id and o.department_id=s.department_id and o.level_id=s.level_id and o.semester_id=s.semester_id where o.status='published' and o.unit_count=r.units and o.requirement_status=r.status and o.source_title=r.title and o.lecture_hours is not distinct from r.lh and o.practical_hours is not distinct from r.ph)<>21 then raise exception 'Microbiology source validation failed'; end if;
end $$;
