-- Mass Communication handbook curriculum (100–400 Level).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@mcm-curriculum.test',jsonb_build_object('display_name',p_name)); return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('role','authenticated',true);
end $$;
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select f.id::text from public.faculties f where f.university_id=current_setting('t.uni')::uuid and f.name='Faculty of Business and Social Sciences'),true) is not null as setup;
select set_config('t.mcm',(select d.id::text from public.departments d where d.faculty_id=current_setting('t.faculty')::uuid and d.name='Mass Communication'),true) is not null as setup;
select set_config('t.period',(select id::text from public.academic_periods where university_id=current_setting('t.uni')::uuid and label='2026/2027'),true) is not null as setup;
select set_config('t.first',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=1),true) is not null as setup;
select set_config('t.second',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=2),true) is not null as setup;
select set_config('t.l100',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='100 Level'),true) is not null as setup;
select set_config('t.l200',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='200 Level'),true) is not null as setup;
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.mcm')::uuid and active),85,'Mass Communication has 85 handbook rows');
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.mcm')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),9,'100 Level first semester has 9 courses');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.mcm')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),18,'100 Level first semester totals 18 units');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.mcm')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=2 and active),18,'100 Level second semester totals 18 units');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.mcm')::uuid and level_id=current_setting('t.l200')::uuid and semester_number=1 and active and requirement_status in ('C','R')),13,'200 Level first semester core totals 13 units');
select is((select cc.unit_count from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mcm')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1 and c.code='MCM 101'),3,'Foundations of Broadcasting keeps 3 units');
select is((select cc.practical_hours from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mcm')::uuid and cc.level_id=current_setting('t.l100')::uuid and cc.semester_number=1 and c.code='MCM 101'),15,'Foundations of Broadcasting keeps 15 practical hours');
select is((select cc.requirement_status from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mcm')::uuid and cc.level_id=current_setting('t.l200')::uuid and cc.semester_number=1 and c.code='MCM 203'),'E','Feature Writing stays elective');
select is((select count(*)::integer from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.mcm')::uuid and cc.level_id=current_setting('t.l200')::uuid and cc.semester_number=1 and c.code='MCM 207'),1,'MCM 207 is stored once despite appearing in two specialization lists');
select ok(
  exists(
    select 1 from jsonb_array_elements(public.get_registration_options_v1('adeleke-university-ede-osun-state')->'departments') elem
    where elem->>'name'='Mass Communication'
  ),
  'Mass Communication appears in registration options'
);
select set_config('t.student',pg_temp.new_user('MCM first year')::text,true) is not null as setup;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.mcm')::uuid,current_setting('t.l100')::uuid,current_setting('t.period')::uuid,current_setting('t.first')::uuid,'initial',null,null);
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null and o.requirement_status='E'),0,'100 Level first semester electives are not auto-assigned');
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null),9,'100 Level first semester required/core courses are auto-assigned');
select pg_temp.login(current_setting('t.student')::uuid);
select is(jsonb_array_length(public.get_catalog_v1()->'offerings'),9,'Mass Communication 100 student sees nine first-semester courses');
reset role;
select * from finish();
rollback;
