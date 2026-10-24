-- Computer Information System handbook curriculum (100–400 Level), Faculty of Science.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@cis-curriculum.test',jsonb_build_object('display_name',p_name)); return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('role','authenticated',true);
end $$;
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select f.id::text from public.faculties f where f.university_id=current_setting('t.uni')::uuid and f.name='Faculty of Science'),true) is not null as setup;
select set_config('t.cis',(select d.id::text from public.departments d where d.faculty_id=current_setting('t.faculty')::uuid and d.name='Computer Information System'),true) is not null as setup;
select set_config('t.period',(select id::text from public.academic_periods where university_id=current_setting('t.uni')::uuid and label='2026/2027'),true) is not null as setup;
select set_config('t.first',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=1),true) is not null as setup;
select set_config('t.l100',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='100 Level'),true) is not null as setup;
select set_config('t.l200',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='200 Level'),true) is not null as setup;
select set_config('t.l400',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='400 Level'),true) is not null as setup;
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.cis')::uuid and active),71,'Computer Information System has 71 handbook rows');
select is((select count(*)::integer from public.curriculum_courses where department_id=current_setting('t.cis')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),10,'100 Level first semester has 10 courses');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.cis')::uuid and level_id=current_setting('t.l100')::uuid and semester_number=1 and active),19,'100 Level first semester totals 19 units');
select is((select sum(unit_count)::integer from public.curriculum_courses where department_id=current_setting('t.cis')::uuid and level_id=current_setting('t.l200')::uuid and semester_number=1 and active),19,'200 Level first semester totals 19 units');
select is((select cc.source_code from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.cis')::uuid and cc.level_id=current_setting('t.l200')::uuid and cc.semester_number=1 and c.code='INS 207'),'INS 207','INS 207 keeps printed code in source_code');
select is((select cc.source_code from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=current_setting('t.cis')::uuid and cc.level_id=current_setting('t.l400')::uuid and cc.semester_number=2 and c.code='CYB 404'),'CBY 404','CYB 404 keeps handbook code in source_code');
select ok(
  exists(
    select 1 from jsonb_array_elements(public.get_registration_options_v1('adeleke-university-ede-osun-state')->'departments') elem
    where elem->>'name'='Computer Information System'
  ),
  'Computer Information System appears in registration options'
);
select set_config('t.student',pg_temp.new_user('CIS first year')::text,true) is not null as setup;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.cis')::uuid,current_setting('t.l100')::uuid,current_setting('t.period')::uuid,current_setting('t.first')::uuid,'initial',null,null);
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null and o.requirement_status='E'),0,'100 Level first semester electives are not auto-assigned');
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null),8,'100 Level first semester core/required courses are auto-assigned');
select pg_temp.login(current_setting('t.student')::uuid);
select is(jsonb_array_length(public.get_catalog_v1()->'offerings'),8,'Computer Information System 100 student sees eight first-semester assigned courses');
reset role;
select * from finish();
rollback;
