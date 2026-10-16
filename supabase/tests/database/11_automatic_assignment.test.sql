-- Handbook metadata, zero-unit seminars, elective routing and canonical course identities.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data) values(v,v::text||'@expanded-curriculum.test',jsonb_build_object('display_name',p_name)); return v;
end $$;
create function pg_temp.login(p_user uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('role','authenticated',true);
end $$;
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select id::text from public.faculties where university_id=current_setting('t.uni')::uuid and name='Computing Sciences'),true) is not null as setup;
select set_config('t.cs',(select id::text from public.departments where faculty_id=current_setting('t.faculty')::uuid and name='Computer Science'),true) is not null as setup;
select set_config('t.period',(select id::text from public.academic_periods where university_id=current_setting('t.uni')::uuid and label='2026/2027'),true) is not null as setup;
select set_config('t.first',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=1),true) is not null as setup;
select set_config('t.second',(select id::text from public.semesters where academic_period_id=current_setting('t.period')::uuid and sort_order=2),true) is not null as setup;
select set_config('t.l100',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='100 Level'),true) is not null as setup;
select set_config('t.l300',(select id::text from public.levels where university_id=current_setting('t.uni')::uuid and label='300 Level'),true) is not null as setup;

select set_config('t.student',pg_temp.new_user('Automatic learner')::text,true) is not null as setup;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.cs')::uuid,current_setting('t.l300')::uuid,current_setting('t.period')::uuid,current_setting('t.first')::uuid,'initial',null,null);
select is((select count(*)::integer from public.enrollments where user_id=current_setting('t.student')::uuid and ended_at is null),5,'five required 300-level courses assigned automatically');
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and o.requirement_status='E'),0,'electives are never guessed');
select private.assign_required_courses(current_setting('t.student')::uuid);
select is((select count(*)::integer from public.enrollments where user_id=current_setting('t.student')::uuid),5,'assignment replay creates no duplicates');
select pg_temp.login(current_setting('t.student')::uuid);
select is((select count(*)::integer from jsonb_array_elements(public.get_catalog_v1()->'offerings') x where (x->>'enrolled')::boolean),5,'catalog immediately exposes assigned courses');
reset role;
select private.apply_academic_profile(current_setting('t.student')::uuid,current_setting('t.student')::uuid,current_setting('t.uni')::uuid,current_setting('t.faculty')::uuid,current_setting('t.cs')::uuid,current_setting('t.l100')::uuid,current_setting('t.period')::uuid,current_setting('t.second')::uuid,'admin_correction','test move',null);
select is((select count(*)::integer from public.enrollments where user_id=current_setting('t.student')::uuid and ended_at is null),7,'profile change assigns new required courses');
select is((select count(*)::integer from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=current_setting('t.student')::uuid and e.ended_at is null and o.semester_id<>current_setting('t.second')::uuid),0,'old semester access ends');
insert into public.courses(code,title) values('AUTO TEST','Automatic publication test');
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status)
select id,current_setting('t.uni')::uuid,current_setting('t.cs')::uuid,current_setting('t.l100')::uuid,current_setting('t.second')::uuid,'draft' from public.courses where code='AUTO TEST';
select is((select count(*)::integer from public.enrollments where user_id=current_setting('t.student')::uuid and ended_at is null),7,'draft offerings do not assign');
update public.course_offerings set status='published' where course_id=(select id from public.courses where code='AUTO TEST');
select is((select count(*)::integer from public.enrollments where user_id=current_setting('t.student')::uuid and ended_at is null),8,'newly published course reaches existing student');
select ok(not has_function_privilege('authenticated','private.assign_required_courses(uuid)','execute'),'students cannot invoke assignment helper');
select ok(not has_function_privilege('anon','private.assign_required_courses(uuid)','execute'),'guests cannot invoke assignment helper');
select * from finish();
rollback;
