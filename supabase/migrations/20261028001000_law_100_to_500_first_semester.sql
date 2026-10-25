-- Owner-provided Law 100-500 Level first-semester lists, 25 October 2026.
-- Units and contact hours were not supplied: preserve known credits; leave new ones null.
-- Explicit electives are E; remaining listed courses are required (R).
-- Unknown credits must not be represented as zero.
alter table public.curriculum_courses alter column unit_count drop not null;
create temp table requested_law(level_number int,code text,title text,status text,position int) on commit drop;
insert into requested_law values
(100,'PUL 101','Legal Methods I','R',1),
(100,'LAW 101','English for Legal Writing','R',2),
(100,'AUE-GST 100','Student''s Life Seminar','R',3),
(100,'GST 111','Communication in English I','R',4),
(100,'AUE-GST 101','Use of Library','R',5),
(100,'PHL 105','Introduction to Social and Political Philosophy','R',6),
(100,'PSY 101','Introduction to Psychology','R',7),
(100,'LIT 105','Introduction to Prose','R',8),
(100,'POL 101','Introduction to Political Science','R',9),
(200,'PUL 201','Constitutional Law I','R',1),
(200,'CIL 201','Law of Contract I','R',2),
(200,'PUL 203','Nigerian Legal System I','R',3),
(200,'PUL 231','Administrative Law I','E',4),
(200,'AUE-LAW 201','Gender and the Law I','E',5),
(200,'AUE-GST 201','Philosophy of Education','R',6),
(200,'AUE-GST 221','Communication in French','R',7),
(200,'ENT 211','Entrepreneurship and Innovation','R',8),
(300,'AUE-LAW 301','Application of ICT to Legal Studies','R',1),
(300,'PUL 301','Criminal Law I','R',2),
(300,'PPL 301','Law of Torts I','R',3),
(300,'CIL 301','Commercial Law I','R',4),
(300,'PUL 321','Law and Medicine I','E',5),
(300,'PPL 321','Family Law I','E',6),
(400,'PPL 405','Property Law I','R',1),
(400,'CLE 401','Clinical and Moot Court Practice I','R',2),
(400,'PUL 401','Law of Evidence I','R',3),
(400,'PPL 403','Equity and Trust I','R',4),
(400,'AUE-LAW 403','Legal Research Methodology I','R',5),
(400,'PUL 421','Environmental Law I','E',6),
(400,'PPL 441','Taxation Law I','E',7),
(500,'PUL 501','Jurisprudence and Legal Theory I','R',1),
(500,'PPL 501','Company Law I','R',2),
(500,'PUL 521','Law of ADR I','E',3),
(500,'PPL 521','Industrial Law I','E',4),
(500,'PUL 541','Human Rights and Civil Liberties Law I','E',5);
create temp table law_scope on commit drop as select d.id department_id,d.university_id,s.id semester_id from public.departments d join public.universities u on u.id=d.university_id and u.slug='adeleke-university-ede-osun-state' join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Law' join public.academic_periods ap on ap.university_id=u.id and ap.label='2026/2027' and ap.active join public.semesters s on s.academic_period_id=ap.id and s.sort_order=1 and s.active where d.name='Law' and d.active;
create temp table preserved_law_enrollments on commit drop as select user_id,offering_id from public.enrollments;
create temp table preserved_outside_law on commit drop as select o.* from public.course_offerings o where not exists(select 1 from law_scope s where o.department_id=s.department_id and o.semester_id=s.semester_id);
do $$ begin if (select count(*) from law_scope)<>1 or (select count(*) from requested_law)<>35 then raise exception 'Law source/scope mismatch'; end if; end $$;
insert into public.levels(university_id,label,sort_order,active) select university_id,'500 Level',500,true from law_scope on conflict(university_id,label) do update set active=true;
insert into public.courses(code,title) select code,title from requested_law on conflict(code) do nothing;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,source_code,source_title)
select s.university_id,s.department_id,l.id,1,c.id,null,r.status,r.position,'Owner-provided Law 100-500 Level first-semester list, 25 October 2026. Units not supplied; known units retained. Explicit electives marked E.',r.code,r.title from requested_law r cross join law_scope s join public.levels l on l.university_id=s.university_id and l.sort_order=r.level_number join public.courses c on c.code=r.code
on conflict(department_id,level_id,semester_number,course_id) do update set requirement_status=excluded.requirement_status,position=excluded.position,source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,source_code,source_title)
select c.id,s.university_id,s.department_id,l.id,s.semester_id,'published',cc.unit_count,r.status,r.code,r.title from requested_law r cross join law_scope s join public.levels l on l.university_id=s.university_id and l.sort_order=r.level_number join public.courses c on c.code=r.code join public.curriculum_courses cc on cc.department_id=s.department_id and cc.level_id=l.id and cc.semester_number=1 and cc.course_id=c.id
on conflict(course_id,department_id,level_id,semester_id) do update set status='published',requirement_status=excluded.requirement_status,source_code=excluded.source_code,source_title=excluded.source_title;
-- French is listed at 200 Level in the corrected source; retire the previous 300 Level listing.
update public.curriculum_courses cc set active=false from law_scope s,public.levels l,public.courses c where cc.department_id=s.department_id and cc.level_id=l.id and l.sort_order=300 and cc.semester_number=1 and cc.course_id=c.id and c.code='AUE-GST 221';
update public.course_offerings o set status='retired' from law_scope s,public.levels l,public.courses c where o.department_id=s.department_id and o.level_id=l.id and l.sort_order=300 and o.semester_id=s.semester_id and o.course_id=c.id and c.code='AUE-GST 221';
do $$ begin
 if (select count(*) from requested_law r cross join law_scope s join public.levels l on l.university_id=s.university_id and l.sort_order=r.level_number join public.courses c on c.code=r.code join public.course_offerings o on o.department_id=s.department_id and o.level_id=l.id and o.semester_id=s.semester_id and o.course_id=c.id where o.status='published' and o.requirement_status=r.status and o.source_title=r.title)<>35 then raise exception 'Expected all 35 Law courses'; end if;
 if exists(select * from preserved_outside_law except select * from public.course_offerings) then raise exception 'Unrelated offering changed'; end if;
 if exists(select * from preserved_law_enrollments except select user_id,offering_id from public.enrollments) then raise exception 'Existing enrollment removed'; end if;
end $$;
