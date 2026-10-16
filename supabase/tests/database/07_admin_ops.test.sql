-- Admin workflows (imports, publish/version, premium, triage), reports/notifications, leaderboard.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.new_user(p_name text) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', v::text || '@test.local',
          jsonb_build_object('display_name', p_name), now(), now());
  return v;
end $$;
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.enrolled_student(p_name text) returns uuid language plpgsql as $$
declare v uuid := pg_temp.new_user(p_name);
begin
  perform private.apply_academic_profile(v, v, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006', 'initial', null, null);
  insert into public.enrollments (user_id, offering_id) values (v, '20000000-0000-4000-8000-000000000002') on conflict (user_id,offering_id) do nothing;
  return v;
end $$;

select set_config('t.admin', '90000000-0000-4000-8000-000000000002', true) is not null as setup;
select set_config('t.s', pg_temp.enrolled_student('Ops Student')::text, true) is not null as setup;
select set_config('t.s2', pg_temp.enrolled_student('Ops Student Two')::text, true) is not null as setup;
select set_config('t.s3', pg_temp.enrolled_student('Ops Student Three')::text, true) is not null as setup;

-- ---------------------------------------------------------------- question import
select set_config('t.rows', $json$[
  {"course_code":"CYB101-FIXTURE","logical_question_key":"IMP-1","pool":"learning","usage":"practice|mock","difficulty":"beginner",
   "prompt":"Imported question one?","option_a":"Yes","option_b":"No","option_c":"Maybe","correct_option":"A",
   "explanation":"Because.","source_reference":"Fixture import"},
  {"course_code":"CYB101-FIXTURE","logical_question_key":"IMP-2","pool":"battle","usage":["battle"],"difficulty":"advanced",
   "prompt":"Imported battle question?","options":[{"body":"One"},{"body":"Two"},{"body":"Three"}],"correct_option":"C",
   "explanation":"Three it is.","source_reference":"Fixture import"}
]$json$, true) is not null as setup;
select set_config('t.badrows', $json$[
  {"course_code":"NOPE","logical_question_key":"","pool":"learning","usage":"battle","difficulty":"easy",
   "prompt":"","option_a":"Only one","correct_option":"Z","explanation":"","source_reference":""},
  {"course_code":"CYB101-FIXTURE","logical_question_key":"IMP-3","pool":"learning","usage":"review","difficulty":"beginner",
   "prompt":"Fine row","option_a":"A","option_b":"B","correct_option":"B","explanation":"ok","source_reference":"src"}
]$json$, true) is not null as setup;

select pg_temp.login(current_setting('t.s')::uuid);
select throws_ok($$select public.admin_import_questions_v1(current_setting('t.rows')::jsonb, true, null)$$, 'PT403', 'FORBIDDEN',
  'students cannot import');
reset role;
select pg_temp.login(current_setting('t.admin')::uuid);
select set_config('t.bad', (public.admin_import_questions_v1(current_setting('t.badrows')::jsonb, false, gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.bad')::jsonb ->> 'valid', 'false', 'invalid import reported');
select ok((current_setting('t.bad')::jsonb ->> 'error_count')::integer >= 7, 'row-level errors listed for each bad field');
select ok(not jsonb_path_exists(current_setting('t.bad')::jsonb, '$.errors[*] ? (@.row == 2)'), 'valid row has no errors');
select is(current_setting('t.bad')::jsonb ->> 'imported', 'false', 'nothing imported when any row is invalid');
select is((select count(*)::integer from public.questions where logical_key = 'IMP-3'), 0, 'transactional: valid rows not partially imported');

select is((public.admin_import_questions_v1(current_setting('t.rows')::jsonb, true, null)) ->> 'imported', 'false', 'dry run validates only');
select set_config('t.imp', (public.admin_import_questions_v1(current_setting('t.rows')::jsonb, false, '00000000-0000-4000-8000-00000000e001'))::text, true)
  is not null as setup;
select is((current_setting('t.imp')::jsonb ->> 'imported'), 'true', 'valid rows imported as drafts');
select is((public.admin_import_questions_v1(current_setting('t.rows')::jsonb, false, '00000000-0000-4000-8000-00000000e001')) -> 'created',
  current_setting('t.imp')::jsonb -> 'created', 'import retry with same request key is idempotent');
select set_config('t.iv1', current_setting('t.imp')::jsonb -> 'created' -> 0 ->> 'question_version_id', true) is not null as setup;
select set_config('t.iv2', current_setting('t.imp')::jsonb -> 'created' -> 1 ->> 'question_version_id', true) is not null as setup;
select is((select status from public.question_versions where id = current_setting('t.iv1')::uuid), 'draft', 'imported versions are drafts');
select is((public.admin_get_question_v1(current_setting('t.iv2')::uuid)) ->> 'correct_option_id',
          (select id::text from public.question_options where question_version_id = current_setting('t.iv2')::uuid and label = 'C'),
  'JSON variable options mapped to the right key');
select is((public.admin_publish_v1('question_version', current_setting('t.iv1')::uuid, gen_random_uuid())) ->> 'status', 'published', 'draft published');
select is((public.admin_publish_v1('question_version', current_setting('t.iv1')::uuid, gen_random_uuid())) ->> 'already_published', 'true',
  'publish is idempotent');
-- Re-import the same key creates version 2 as a new draft (published v1 untouched)
select set_config('t.imp2', (public.admin_import_questions_v1(jsonb_build_array(current_setting('t.rows')::jsonb -> 0 || '{"prompt":"Imported question one, revised?"}'),
  false, gen_random_uuid()))::text, true) is not null as setup;
select is((current_setting('t.imp2')::jsonb -> 'created' -> 0 ->> 'version')::integer, 2, 're-import creates a new draft version');
select is((public.admin_publish_v1('question_version', (current_setting('t.imp2')::jsonb -> 'created' -> 0 ->> 'question_version_id')::uuid,
  gen_random_uuid())) ->> 'status', 'published', 'v2 published');
reset role;
select is((select status from public.question_versions where id = current_setting('t.iv1')::uuid), 'retired', 'previous version retired on publish');
select is((select prompt from public.question_versions where id = current_setting('t.iv1')::uuid), 'Imported question one?', 'history preserved');
select is((select count(*)::integer from private.audit_log where action = 'publish' and entity_type = 'question_version'), 3, 'publishes audited');

-- ---------------------------------------------------------------- lesson import + publish
select pg_temp.login(current_setting('t.admin')::uuid);
select is((public.admin_import_lessons_v1('[{"course_code":"CYB101-FIXTURE","module_position":2,"module_title":"Bad","lesson_position":1,
  "title":"T","objective":"O","estimated_minutes":5,"blocks":[{"type":"video","src":"x"}],"source_reference":"s"}]'::jsonb, true, null)) ->> 'valid',
  'false', 'unsupported block types rejected');
select set_config('t.limp', (public.admin_import_lessons_v1('[{"course_code":"CYB101-FIXTURE","module_position":2,"module_title":"Network Basics (fixture)",
  "lesson_position":1,"title":"Ports and Protocols","objective":"Name common ports.","estimated_minutes":6,
  "blocks":[{"type":"heading","level":2,"text":"Ports"},{"type":"paragraph","text":"Port 443 carries HTTPS."}],
  "source_reference":"Fixture import"}]'::jsonb, false, gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.limp')::jsonb ->> 'imported', 'true', 'lesson imported');
select is((public.admin_publish_v1('lesson_version', (current_setting('t.limp')::jsonb -> 'created' -> 0 ->> 'lesson_version_id')::uuid,
  gen_random_uuid())) ->> 'status', 'published', 'imported lesson published');
reset role;

-- ---------------------------------------------------------------- premium entitlements
select pg_temp.login(current_setting('t.admin')::uuid);
select throws_ok(format($$select public.admin_grant_premium_v1(%L, now() + interval '30 days', '', gen_random_uuid())$$, current_setting('t.s')),
  'PT422', 'VALIDATION_FAILED', 'premium grant requires a reason');
select set_config('t.ent', (public.admin_grant_premium_v1(current_setting('t.s')::uuid, now() + interval '30 days', 'Pilot tester',
  gen_random_uuid())) ->> 'entitlement_id', true) is not null as setup;
reset role;
select pg_temp.login(current_setting('t.s')::uuid);
select is((public.get_my_profile_v1()) ->> 'premium', 'true', 'student sees premium status');
select is((select count(*)::integer from public.entitlements), 1, 'student reads own entitlement');
reset role;
select pg_temp.login(current_setting('t.admin')::uuid);
select is((public.admin_revoke_premium_v1(current_setting('t.ent')::uuid, 'Pilot ended', gen_random_uuid())) ->> 'premium', 'false', 'premium revoked');
reset role;
select is((select count(*)::integer from private.audit_log where action in ('grant_premium', 'revoke_premium')), 2, 'premium changes audited');
select ok(private.verified_entitlement_upsert('paystack', 'evt_1', 'hash', current_setting('t.s')::uuid, 'sub_1', now(), now() + interval '30 days')
  ->> 'duplicate' = 'false', 'verified webhook creates entitlement');
select ok(private.verified_entitlement_upsert('paystack', 'evt_1', 'hash', current_setting('t.s')::uuid, 'sub_1', now(), now() + interval '30 days')
  ->> 'duplicate' = 'true', 'duplicate provider event ignored');

-- ---------------------------------------------------------------- reports + triage + rate limit
select pg_temp.login(current_setting('t.s')::uuid);
select set_config('t.rep', (public.report_content_v1('lesson', '22000000-0000-4000-8000-000000000001', 'typo', 'Small typo in paragraph 2',
  '00000000-0000-4000-8000-00000000e101')) ->> 'report_id', true) is not null as setup;
select is((public.report_content_v1('lesson', '22000000-0000-4000-8000-000000000001', 'typo', 'Small typo in paragraph 2',
  '00000000-0000-4000-8000-00000000e101')) ->> 'report_id', current_setting('t.rep'), 'report retry is idempotent');
select throws_ok($$select public.report_content_v1('lesson', gen_random_uuid(), 'typo', 'x', gen_random_uuid())$$, 'PT422', 'VALIDATION_FAILED',
  'report target must exist');
select throws_ok($$select public.report_content_v1('technical', null, 'broken', '', gen_random_uuid())$$, 'PT422', 'VALIDATION_FAILED',
  'report note required');
select is((select count(*)::integer from generate_series(1, 9) g
           cross join lateral (select public.report_content_v1('technical', null, 'broken', 'Spinner ' || g, gen_random_uuid())) r), 9,
  'nine more reports accepted');
select throws_ok($$select public.report_content_v1('technical', null, 'broken', 'one too many', gen_random_uuid())$$, 'PT429', 'RATE_LIMITED',
  'report rate limit enforced');
select is((select count(*)::integer from public.content_reports), 10, 'student reads own reports');
reset role;
select pg_temp.login(current_setting('t.s2')::uuid);
select is((select count(*)::integer from public.content_reports), 0, 'other students cannot read my reports');
reset role;
select pg_temp.login(current_setting('t.admin')::uuid);
select is((public.admin_triage_report_v1(current_setting('t.rep')::uuid, 'resolved', 'Fixed in v2', gen_random_uuid())) ->> 'state', 'resolved',
  'admin resolves report');
reset role;

-- ---------------------------------------------------------------- notifications ownership
insert into public.notifications (id, user_id, kind, body) values
  ('60000000-0000-4000-8000-000000000001', current_setting('t.s')::uuid, 'info', 'Hello'),
  ('60000000-0000-4000-8000-000000000002', current_setting('t.s2')::uuid, 'info', 'Hi');
select pg_temp.login(current_setting('t.s')::uuid);
select is((select count(*)::integer from public.notifications), 1, 'student reads only own notifications');
select throws_ok($$select public.mark_notification_read_v1('60000000-0000-4000-8000-000000000002')$$, 'PT403', 'FORBIDDEN',
  'cannot mark another user''s notification');
select is((public.mark_notification_read_v1('60000000-0000-4000-8000-000000000001')) ->> 'unread', '0', 'own notification marked read');
select throws_ok($$update public.notifications set read_at = now()$$, '42501', null, 'notifications not directly writable');
reset role;

-- ---------------------------------------------------------------- XP rankings restored
select pg_temp.login(current_setting('t.s')::uuid);
select is(public.get_leaderboard_v1('global',null,null,2)->>'scope','global','signed-in students can see XP rankings');
reset role;

-- ---------------------------------------------------------------- client version gate
update public.app_config set minimum_build = 50 where platform = 'ios';
select pg_temp.login(current_setting('t.s')::uuid);
select set_config('request.headers', '{"x-client-platform":"ios","x-client-build":"10"}', true) is not null as setup;
select throws_ok($$select public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'PT426', 'VERSION_UNSUPPORTED',
  'stale native build cannot mutate');
select set_config('request.headers', '{"x-client-platform":"ios","x-client-build":"50"}', true) is not null as setup;
select is(((public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())) ->> 'xp_awarded')::integer, 0,
  'supported build records reading completion without XP');
reset role;
update public.app_config set maintenance = true, message = 'Upgrading' where platform = 'web';
select set_config('request.headers', '{}', true) is not null as setup;
select pg_temp.login(current_setting('t.s2')::uuid);
select throws_ok($$select public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())$$, 'PT503', 'MAINTENANCE',
  'maintenance blocks mutations');
reset role;

select * from finish();
rollback;
