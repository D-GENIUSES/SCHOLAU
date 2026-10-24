-- Medical Laboratory Science 100 Level first semester from the course checklist.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@mls-curriculum.test',jsonb_build_object('display_name',p_name)); return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('role','authenticated',true);
end $$;
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select f.id::text from public.faculties f where f.university_id=current_setting('t.uni')::uuid and f.name='Faculty of Basic Medical Sciences'),true) is not null as setup;
select set_config('t.mls',(select d.id::text from public.departments d where d.faculty_id=current_setting('t.faculty')::uuid and d.name='Medical Laboratory Science'),true) is not null as setup;
select set_config('t.period',(select id::text from public.academic_periods where university_id=current_setting('t.uni')::uuid and label='2026/2027'),true) is not null as setup;
select set_config('t.first',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=1),true) is not null as setup;
select set_config('t.l100',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='100 Level'),true) is not null as setup;
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.mls')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),9,'Medical Laboratory Science 100 first semester has 9 courses');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.mls')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),15,'Medical Laboratory Science 100 first semester totals 15 units');
select is((select cc.requirement_status from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mls')::uuid and c.code='AUE-GST 131'),'E','Environment and Sustainable Development stays elective');
select is((select cc.unit_count from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mls')::uuid and c.code='AUE-GST 100'),0,'Students Life Seminar stays zero units');
select ok((select bool_and(cc.lecture_hours is null and cc.practical_hours is null and cc.elective_group is null) from public.curriculum_courses cc where cc.department_id=current_setting('t.mls')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1),'hours and elective groups were not invented');
select is((select status from public.course_offerings where department_id=current_setting('t.mls')::uuid and level_id=current_setting('t.l100')::uuid and semester_id=current_setting('t.first')::uuid and course_id=(select id from public.courses where code='GST 111')),'published','checklist courses are published');
select set_config('t.student',pg_temp.new_user('MLS first year')::text,true) is not null as setup;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.mls')::uuid,current_setting('t.l100')::uuid,current_setting('t.period')::uuid,current_setting('t.first')::uuid,'initial',null,null);
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null and o.requirement_status='E'),0,'elective is not auto-assigned');
select pg_temp.login(current_setting('t.student')::uuid);
select is(jsonb_array_length(public.get_catalog_v1()->'offerings'),9,'Medical Laboratory Science student sees the nine first-semester courses');
reset role;
select * from finish();
rollback;
