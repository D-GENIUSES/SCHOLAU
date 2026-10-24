-- Economics 100 Level first semester from the 2026/2027 selected course list.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@economics-curriculum.test',jsonb_build_object('display_name',p_name)); return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('role','authenticated',true);
end $$;
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select f.id::text from public.faculties f where f.university_id=current_setting('t.uni')::uuid and f.name='Faculty of Business and Social Sciences'),true) is not null as setup;
select set_config('t.econ',(select d.id::text from public.departments d where d.faculty_id=current_setting('t.faculty')::uuid and d.name='Economics'),true) is not null as setup;
select set_config('t.period',(select id::text from public.academic_periods where university_id=current_setting('t.uni')::uuid and label='2026/2027'),true) is not null as setup;
select set_config('t.first',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=1),true) is not null as setup;
select set_config('t.l100',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='100 Level'),true) is not null as setup;
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.econ')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),8,'Economics 100 first semester has 8 courses');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.econ')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),21,'Economics 100 first semester totals 21 units');
select is((select cc.unit_count from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.econ')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1 and c.code='AUE-GST 201'),1,'Philosophy of Education keeps 1 unit');
select is((select cc.requirement_status from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.econ')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1 and c.code='AUE-GST 201'),'R','Philosophy of Education keeps required status');
select is((select cc.unit_count from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.econ')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1 and c.code='GET 203'),3,'Engineering Graphics is 3 units');
select ok((select bool_and(cc.lecture_hours is null and cc.practical_hours is null) from public.curriculum_courses cc where cc.department_id=current_setting('t.econ')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1),'contact hours were not invented');
select set_config('t.student',pg_temp.new_user('Economics first year')::text,true) is not null as setup;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.econ')::uuid,current_setting('t.l100')::uuid,current_setting('t.period')::uuid,current_setting('t.first')::uuid,'initial',null,null);
select pg_temp.login(current_setting('t.student')::uuid);
select is(jsonb_array_length(public.get_catalog_v1()->'offerings'),8,'Economics student sees the eight first-semester courses');
select is((select sum((x->>'unit_count')::integer) from jsonb_array_elements(public.get_catalog_v1()->'offerings') x),21,'catalog units match the selected course list');
reset role;
select * from finish();
rollback;
