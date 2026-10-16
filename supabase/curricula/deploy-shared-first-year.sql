begin;
create temporary table catalogue_preservation_snapshot on commit drop as
select 'courses' as table_name,id::text as row_key,to_jsonb(c) as row_data from public.courses c
union all select 'offerings',id::text,jsonb_build_object('id',id,'course_id',course_id,'status',status) from public.course_offerings
union all select 'enrollments',user_id::text||':'||offering_id::text,to_jsonb(e) from public.enrollments e where ended_at is null
union all select 'progress',user_id::text||':'||lesson_id::text,to_jsonb(lp) from public.lesson_progress lp
union all select 'attempts',id::text,to_jsonb(a) from public.assessment_attempts a;
-- Shared first-year curriculum requested by the user on 2026-10-16.
-- CYB common sciences confirmed; SEN uses the same provisional list, open to later correction.
-- Preserve the source C/R/E statuses and existing identities/enrollments/progress.
do $$ declare u uuid; cs uuid; l uuid; r record; begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict cs from public.departments where university_id=u and name='Computer Science';
select id into strict l from public.levels where university_id=u and label='100 Level';
if (select count(*) from public.curriculum_courses where department_id=cs and level_id=l and active and semester_number in (1,2))<>18 then raise exception 'Expected 18 first-year source requirements'; end if;
if (select count(*) from public.departments where university_id=u and name in ('Cybersecurity','Software Engineering'))<>2 then raise exception 'Missing target departments'; end if;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
select cc.university_id,d.id,cc.level_id,cc.semester_number,cc.course_id,cc.unit_count,cc.requirement_status,cc.position,
'Shared first-year list requested 2026-10-16; '||case when d.name='Cybersecurity' then 'CYB sciences confirmed by user; ' else 'SEN provisional shared list; ' end||cc.source_reference,
cc.lecture_hours,cc.practical_hours,cc.elective_group,cc.source_code,cc.source_title
from public.curriculum_courses cc join public.departments d on d.university_id=u and d.name in ('Cybersecurity','Software Engineering')
where cc.department_id=cs and cc.level_id=l and cc.active and cc.semester_number in (1,2)
on conflict(department_id,level_id,semester_number,course_id) do nothing;
for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id
where s.university_id=u and s.active and ap.active loop perform private.materialize_curriculum(r.id); end loop;
end $$;
do $$ declare u uuid; f uuid; l uuid; p uuid; s uuid; d uuid; student uuid; r record; cat jsonb; n integer; results jsonb:='[]'; begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict f from public.faculties where university_id=u and name='Computing Sciences';
select id into strict l from public.levels where university_id=u and label='100 Level';
select id into strict p from public.academic_periods where university_id=u and label='2026/2027';
for r in select * from (values('Cybersecurity',1,10,8,19),('Cybersecurity',2,8,7,17),('Software Engineering',1,10,8,19),('Software Engineering',2,8,7,17)) x(programme,semester,courses,required,units) loop
begin
select id into strict d from public.departments where university_id=u and name=r.programme;
select id into strict s from public.semesters where academic_period_id=p and sort_order=r.semester;
if exists(select 1 from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=d and cc.level_id=l and c.code in ('MTH 201','MTH 202')) then raise exception 'Upper-year maths assigned at 100 Level'; end if;
if (select count(*) from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=d and cc.level_id=l and cc.semester_number=r.semester and c.code=case when r.semester=1 then 'MTH 101' else 'MTH 102' end)<>1 then raise exception 'Missing first-year maths'; end if;
student:=gen_random_uuid();
insert into auth.users(id,email,raw_user_meta_data) values(student,student::text||'@shared-first-year.invalid','{"display_name":"First-year verification"}');
perform private.apply_academic_profile(student,student,u,f,d,l,p,s,'initial',null,null);
select count(*) into n from public.enrollments where user_id=student and ended_at is null;
if n<>r.required then raise exception 'Assignment mismatch for % semester %: %',r.programme,r.semester,n; end if;
if exists(select 1 from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=student and o.requirement_status='E') then raise exception 'Elective auto-assigned'; end if;
perform private.assign_required_courses(student);
if (select count(*) from public.enrollments where user_id=student and ended_at is null)<>r.required then raise exception 'Assignment replay duplicates'; end if;
perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated')::text,true);
perform set_config('request.jwt.claim.sub',student::text,true);
perform set_config('role','authenticated',true);
cat:=public.get_catalog_v1();
if jsonb_array_length(cat->'offerings')<>r.courses then raise exception 'Catalog mismatch'; end if;
select sum((x->>'unit_count')::integer) into n from jsonb_array_elements(cat->'offerings') x;
if n<>r.units then raise exception 'Units mismatch'; end if;
results:=results||jsonb_build_array(jsonb_build_object('programme',r.programme,'semester',r.semester,'courses',r.courses,'required_assigned',r.required,'passed',true));
raise exception using errcode='ZF001',message='Rollback verification student';
exception when sqlstate 'ZF001' then null; end;
end loop;
if exists(select 1 from auth.users where email like '%@shared-first-year.invalid') then raise exception 'Temporary user leak'; end if;
perform set_config('scholau.shared_first_year',results::text,true);
end $$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261016000300','shared_first_year_computing',array[$migration$-- Shared first-year curriculum requested by the user on 2026-10-16.
-- CYB common sciences confirmed; SEN uses the same provisional list, open to later correction.
-- Preserve the source C/R/E statuses and existing identities/enrollments/progress.
do $$ declare u uuid; cs uuid; l uuid; r record; begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict cs from public.departments where university_id=u and name='Computer Science';
select id into strict l from public.levels where university_id=u and label='100 Level';
if (select count(*) from public.curriculum_courses where department_id=cs and level_id=l and active and semester_number in (1,2))<>18 then raise exception 'Expected 18 first-year source requirements'; end if;
if (select count(*) from public.departments where university_id=u and name in ('Cybersecurity','Software Engineering'))<>2 then raise exception 'Missing target departments'; end if;
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
select cc.university_id,d.id,cc.level_id,cc.semester_number,cc.course_id,cc.unit_count,cc.requirement_status,cc.position,
'Shared first-year list requested 2026-10-16; '||case when d.name='Cybersecurity' then 'CYB sciences confirmed by user; ' else 'SEN provisional shared list; ' end||cc.source_reference,
cc.lecture_hours,cc.practical_hours,cc.elective_group,cc.source_code,cc.source_title
from public.curriculum_courses cc join public.departments d on d.university_id=u and d.name in ('Cybersecurity','Software Engineering')
where cc.department_id=cs and cc.level_id=l and cc.active and cc.semester_number in (1,2)
on conflict(department_id,level_id,semester_number,course_id) do nothing;
for r in select s.id from public.semesters s join public.academic_periods ap on ap.id=s.academic_period_id
where s.university_id=u and s.active and ap.active loop perform private.materialize_curriculum(r.id); end loop;
end $$;
$migration$]);
select current_setting('scholau.shared_first_year')::jsonb as verification;
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
