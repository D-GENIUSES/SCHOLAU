-- Content: enrollment-gated reads, hidden answer keys/question bank, immutable published versions,
-- publish validation, option ownership.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

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
create function pg_temp.onboard(p_uid uuid) returns void language plpgsql as $$
begin
  perform private.apply_academic_profile(p_uid, p_uid, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006', 'initial', null, null);
end $$;

select set_config('t.s', pg_temp.new_user('Content Student')::text, true) is not null as setup;
select pg_temp.onboard(current_setting('t.s')::uuid);
select set_config('t.admin', '90000000-0000-4000-8000-000000000002', true) is not null as setup;
select set_config('t.qv', (select qv.id::text from public.question_versions qv join public.questions q on q.id = qv.question_id
                           where q.logical_key = 'L1-Q1' and qv.status = 'published'), true) is not null as setup;
select set_config('t.qv2', (select qv.id::text from public.question_versions qv join public.questions q on q.id = qv.question_id
                            where q.logical_key = 'L1-Q2' and qv.status = 'published'), true) is not null as setup;

-- Simulate an ended enrollment to retain the access-denial security checks.
update public.enrollments set ended_at=now() where user_id=current_setting('t.s')::uuid;
-- Before enrollment
select pg_temp.login(current_setting('t.s')::uuid);
select is((select count(*)::integer from public.course_offerings where university_id='10000000-0000-4000-8000-000000000001'), 2, 'published fixture offerings remain visible');
select is(jsonb_array_length((public.get_catalog_v1()) -> 'offerings'), 1, 'catalog lists offerings for my academic profile only');
select is((select count(*)::integer from public.lesson_versions), 0, 'lesson content hidden before enrollment');
select throws_ok($$select public.get_lesson_v1('22000000-0000-4000-8000-000000000001')$$, 'PT403', 'NOT_ENROLLED', 'lesson RPC requires enrollment');

-- After enrollment
select is((public.enroll_course_v1('20000000-0000-4000-8000-000000000002', gen_random_uuid())) ->> 'active', 'true', 'enrolled');
select is((select count(*)::integer from public.lesson_versions), 3, 'enrolled student reads published lesson versions');
select is((select count(*)::integer from public.lessons), 3, 'enrolled student reads lesson structure');
select is((public.get_lesson_v1('22000000-0000-4000-8000-000000000001')) ->> 'title', 'The CIA Triad', 'get_lesson_v1 returns current version');
select is((public.get_lesson_v1('22000000-0000-4000-8000-000000000001')) ->> 'next_lesson_id', '22000000-0000-4000-8000-000000000002', 'lesson navigation');
select is(jsonb_array_length((public.get_course_overview_v1('20000000-0000-4000-8000-000000000002')) -> 'assessments'), 5, 'overview lists assessments');
select is((public.get_course_overview_v1('20000000-0000-4000-8000-000000000002')) ->> 'battle_ready', 'true', 'battle pool is sufficient');

-- Question bank and keys are never directly readable by students
select is((select count(*)::integer from public.questions), 0, 'questions hidden from students');
select is((select count(*)::integer from public.question_versions), 0, 'question versions hidden from students');
select is((select count(*)::integer from public.question_options), 0, 'question options hidden from students');
select is((select count(*)::integer from public.assessment_questions), 0, 'assessment composition hidden from students');
select throws_ok($$select * from private.question_answer_keys$$, '42501', null, 'answer keys not readable');
select throws_ok($$select public.admin_get_question_v1(current_setting('t.qv')::uuid)$$, 'PT403', 'FORBIDDEN', 'privileged question read denied to students');
select throws_ok($$insert into public.lesson_progress (user_id, lesson_id, last_version_id, state) values
  (auth.uid(), '22000000-0000-4000-8000-000000000001', '23000000-0000-4000-8000-000000000001', 'completed')$$, '42501', null,
  'direct progress write denied');

-- Admin reads
reset role;
select pg_temp.login(current_setting('t.admin')::uuid);
select ok((select count(*) from public.questions) >= 24, 'admin reads question bank');
select is((public.admin_get_question_v1(current_setting('t.qv')::uuid)) ->> 'explanation',
  'Integrity is about preventing or detecting unauthorised modification.', 'admin reads answer key explanation');
reset role;

-- Immutability of published versions (even for privileged writers outside the publishing workflow)
select throws_ok(format($$update public.question_versions set prompt = 'changed' where id = %L$$, current_setting('t.qv')),
  '23514', null, 'published question version is immutable');
select throws_ok(format($$delete from public.question_options where question_version_id = %L$$, current_setting('t.qv')),
  '23514', null, 'options of published version cannot be deleted');
select throws_ok(format($$update public.question_options set body = 'x' where question_version_id = %L$$, current_setting('t.qv')),
  '23514', null, 'options of published version cannot be edited');
select throws_ok(format($$update private.question_answer_keys set explanation = 'x' where question_version_id = %L$$, current_setting('t.qv')),
  '23514', null, 'answer key of published version is immutable');
select throws_ok($$update public.lesson_versions set blocks = '[]' where id = '23000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'published lesson version is immutable');
select throws_ok($$delete from public.lesson_versions where id = '23000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'published lesson version cannot be deleted');
select throws_ok($$insert into public.lesson_versions (lesson_id, version, title, objective, blocks, estimated_minutes, status,
  source_reference, reviewed_by, published_at) values ('22000000-0000-4000-8000-000000000001', 99, 't', 'o',
  '[{"type":"paragraph","text":"x"}]', 1, 'published', 's', '90000000-0000-4000-8000-000000000002', now())$$,
  '23514', null, 'cannot insert an already-published version directly');
select lives_ok(format($$update public.question_versions set status = 'retired', retired_at = now(), retired_reason = 'test'
  where id = %L$$, current_setting('t.qv2')), 'retirement metadata change is allowed');
select throws_ok(format($$update public.question_versions set status = 'published' where id = %L$$, current_setting('t.qv2')),
  '23514', null, 'retired version cannot be republished directly');

-- Option ownership (composite FK)
select fk_ok('public', 'attempt_answers', array['option_id', 'question_version_id'],
             'public', 'question_options', array['id', 'question_version_id'], 'attempt answer option must belong to its question version');
select fk_ok('public', 'battle_answers', array['option_id', 'question_version_id'],
             'public', 'question_options', array['id', 'question_version_id'], 'battle answer option must belong to its question version');
select fk_ok('private', 'question_answer_keys', array['correct_option_id', 'question_version_id'],
             'public', 'question_options', array['id', 'question_version_id'], 'answer key option must belong to its question version');

-- Publish validation through admin RPC
insert into public.questions (id, course_id, pool, logical_key) values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'learning', 'T-ONE-OPTION'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'battle', 'T-BAD-USAGE');
insert into public.question_versions (id, question_id, version, prompt, difficulty, usage, source_reference) values
  ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'Only one option?', 'beginner', array['practice'], 'src'),
  ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 1, 'Battle in review?', 'beginner', array['review'], 'src');
insert into public.question_options (id, question_version_id, label, body, position) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'A', 'Lonely', 1),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'A', 'One', 1),
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000002', 'B', 'Two', 2);
insert into private.question_answer_keys (question_version_id, correct_option_id, explanation) values
  ('51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'e'),
  ('51000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 'e');

select pg_temp.login(current_setting('t.admin')::uuid);
select throws_ok($$select public.admin_publish_v1('question_version', '51000000-0000-4000-8000-000000000001', gen_random_uuid())$$,
  'PT422', 'VALIDATION_FAILED', 'publishing requires at least two options');
select throws_ok($$select public.admin_publish_v1('question_version', '51000000-0000-4000-8000-000000000002', gen_random_uuid())$$,
  'PT422', 'VALIDATION_FAILED', 'battle-pool question must have battle usage only');
reset role;
select pg_temp.login(current_setting('t.s')::uuid);
select throws_ok($$select public.admin_publish_v1('question_version', '51000000-0000-4000-8000-000000000002', gen_random_uuid())$$,
  'PT403', 'FORBIDDEN', 'students cannot publish');
reset role;

select * from finish();
rollback;
