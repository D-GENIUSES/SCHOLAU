-- Identity: signup trigger, own-row RLS, denied direct mutation, role escalation, academic hierarchy, D09.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', v::text || '@test.local',
          case when p_name is null then '{}'::jsonb else jsonb_build_object('display_name', p_name) end, now(), now());
  return v;
end $$;
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('role', 'authenticated', true);
end $$;

select set_config('t.a', pg_temp.new_user('Alice Test')::text, true) is not null as setup;
select set_config('t.b', pg_temp.new_user(null)::text, true) is not null as setup;
select set_config('t.admin', '90000000-0000-4000-8000-000000000002', true) is not null as setup;
-- Second university to test cross-university combinations.
insert into public.universities (id, name, slug) values ('10000000-0000-4000-8000-0000000000aa', 'Other Fixture Uni', 'other-fixture');
insert into public.levels (id, university_id, label, sort_order) values ('10000000-0000-4000-8000-0000000000ab', '10000000-0000-4000-8000-0000000000aa', '100 Level', 1);

-- Signup trigger
select is((select display_name from public.profiles where id = current_setting('t.a')::uuid), 'Alice Test', 'profile created from raw_user_meta_data.display_name');
select ok((select length(display_name) >= 2 from public.profiles where id = current_setting('t.b')::uuid), 'display name falls back when metadata missing');
select is((select array_agg(role) from public.user_roles where user_id = current_setting('t.a')::uuid), array['student'], 'student role granted on signup');
select is((select total from public.user_points where user_id = current_setting('t.a')::uuid), 10::bigint, 'new account receives welcome XP');

-- Own-row RLS
select pg_temp.login(current_setting('t.a')::uuid);
select is((select count(*)::integer from public.profiles), 1, 'student sees only own profile');
select is((select count(*)::integer from public.user_roles), 1, 'student sees only own roles');
select is((select count(*)::integer from public.profiles where id = current_setting('t.b')::uuid), 0, 'student cannot read another profile');

-- Denied direct mutations / role escalation
select throws_ok($$update public.profiles set display_name = 'Hacker' where id = auth.uid()$$, '42501', null, 'direct profile update denied');
select throws_ok($$insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')$$, '42501', null, 'role escalation via insert denied');
select throws_ok($$insert into public.user_points (user_id, total) values (auth.uid(), 999999)$$, '42501', null, 'direct XP write denied');
select throws_ok($$insert into public.entitlements (user_id, source, source_reference, starts_at) values (auth.uid(), 'paystack', 'x', now())$$,
  '42501', null, 'direct entitlement write denied');
select throws_ok($$select * from private.question_answer_keys$$, '42501', null, 'private schema not accessible');
select throws_ok($$select public.admin_set_role_v1(auth.uid(), 'admin', true, 'pls', gen_random_uuid())$$, 'PT403', 'FORBIDDEN',
  'student cannot grant themselves admin via RPC');

-- Profile RPC
select is((public.update_profile_v1('Alice Renamed')) ->> 'display_name', 'Alice Renamed', 'update_profile_v1 updates display name');
select throws_ok($$select public.update_profile_v1('A')$$, 'PT422', 'VALIDATION_FAILED', 'display name length validated');
select is((public.get_my_profile_v1()) ->> 'needs_onboarding', 'true', 'new student needs onboarding');

-- Academic hierarchy validation
select throws_ok($$select public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-0000000000ab', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006', gen_random_uuid())$$, 'PT422', 'INVALID_PROFILE', 'level from another university rejected');
select throws_ok($$select public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000003', gen_random_uuid())$$, 'PT422', 'INVALID_PROFILE', 'semester id must belong to period');

select is((public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-00000000a001')) -> 'academic' -> 'department' ->> 'name',
  'Cybersecurity (fixture)', 'initial academic profile set');
select is((select kind from public.academic_profile_changes order by created_at limit 1), 'initial', 'initial change recorded');
select is((public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-00000000a001')) -> 'academic' -> 'department' ->> 'name',
  'Cybersecurity (fixture)', 'retry with same request key is idempotent');

-- Enrollment scope
select is((public.enroll_course_v1('20000000-0000-4000-8000-000000000002', gen_random_uuid())) ->> 'active', 'true', 'enroll in matching offering');
select throws_ok($$select public.enroll_course_v1('20000000-0000-4000-8000-000000000003', gen_random_uuid())$$, 'PT403', 'FORBIDDEN',
  'cannot enroll in offering for another department');

-- D09: one self change per academic period
select is((public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006', gen_random_uuid())) -> 'academic' -> 'department' ->> 'name',
  'Computer Science (fixture)', 'first self change in period allowed');
select is((select count(*)::integer from public.enrollments where ended_at is null and offering_id='20000000-0000-4000-8000-000000000002'), 0, 'profile change ends out-of-scope enrollment');
select throws_ok($$select public.set_academic_profile_v1('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006', gen_random_uuid())$$, 'PT403', 'FORBIDDEN', 'second self change in same period denied');
select throws_ok($$select public.admin_correct_academic_profile_v1(auth.uid(), '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', 'x', gen_random_uuid())$$,
  'PT403', 'FORBIDDEN', 'student cannot use admin correction');

-- Admin correction with reason
reset role;
select pg_temp.login(current_setting('t.admin')::uuid);
select throws_ok(format($$select public.admin_correct_academic_profile_v1(%L, '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', '', gen_random_uuid())$$, current_setting('t.a')),
  'PT422', 'VALIDATION_FAILED', 'admin correction requires a reason');
select is((public.admin_correct_academic_profile_v1(current_setting('t.a')::uuid, '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', 'Student picked wrong department',
  gen_random_uuid())) -> 'academic' -> 'department' ->> 'name', 'Cybersecurity (fixture)', 'admin correction applied');
reset role;
select is((select count(*)::integer from public.academic_profile_changes
           where user_id = current_setting('t.a')::uuid and kind = 'admin_correction' and reason is not null), 1,
  'admin correction recorded with reason');
select is((select count(*)::integer from private.audit_log where action = 'correct_academic_profile'
           and entity_id = current_setting('t.a')::uuid), 1, 'admin correction audited');

-- Unauthenticated access
select set_config('request.jwt.claims', '', true) is not null as setup;
select set_config('request.jwt.claim.sub', '', true) is not null as setup;
set local role anon;
select throws_ok($$select public.get_my_profile_v1()$$, '42501', null, 'anon cannot execute RPCs');
select is((select count(*)::integer from public.universities where slug = 'fixture-university'), 1, 'anon can read onboarding hierarchy');
reset role;
set local role authenticated;
select throws_ok($$select public.get_my_profile_v1()$$, 'PT401', 'UNAUTHENTICATED', 'authenticated role without sub is UNAUTHENTICATED');
reset role;

select * from finish();
rollback;
