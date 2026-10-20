-- Assessments: snapshot, hidden keys until feedback point, revisions, finalization, idempotent retries,
-- first-completion rewards, deadline enforcement, ownership.
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
create function pg_temp.enrolled_student(p_name text) returns uuid language plpgsql as $$
declare v uuid := pg_temp.new_user(p_name);
begin
  perform private.apply_academic_profile(v, v, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006', 'initial', null, null);
  insert into public.enrollments (user_id, offering_id) values (v, '20000000-0000-4000-8000-000000000002') on conflict (user_id,offering_id) do nothing;
  return v;
end $$;
-- Correct option for a question version (test oracle; runs as postgres before role switch).
create function pg_temp.key_of(p_qv uuid) returns uuid language sql security definer as $$
  select correct_option_id from private.question_answer_keys where question_version_id = p_qv
$$;
create function pg_temp.wrong_of(p_qv uuid) returns uuid language sql security definer as $$
  select o.id from public.question_options o join private.question_answer_keys k on k.question_version_id = o.question_version_id
  where o.question_version_id = p_qv and o.id <> k.correct_option_id order by o.position limit 1
$$;

select set_config('t.s', pg_temp.enrolled_student('Exam Student')::text, true) is not null as setup;
select set_config('t.o', pg_temp.enrolled_student('Other Student')::text, true) is not null as setup;
-- practice / mock / review fixture versions
select set_config('t.review', '31000000-0000-4000-8000-000000000001', true) is not null as setup;
select set_config('t.practice', '31000000-0000-4000-8000-000000000004', true) is not null as setup;
select set_config('t.mock', '31000000-0000-4000-8000-000000000005', true) is not null as setup;

-- ---------------------------------------------------------------- review (immediate feedback)
select pg_temp.login(current_setting('t.s')::uuid);
select set_config('t.r', (public.start_attempt_v1(current_setting('t.review')::uuid, '00000000-0000-4000-8000-00000000b001')) ->> 'attempt_id', true)
  is not null as setup;
select is(jsonb_array_length((public.get_attempt_result_v1(current_setting('t.r')::uuid)) -> 'questions'), 3, 'review attempt snapshots 3 questions');
select ok(not jsonb_path_exists(public.get_attempt_result_v1(current_setting('t.r')::uuid), '$.questions[*].feedback.correct_option_id'),
  'no answer key in an unanswered attempt payload');
select is((public.start_attempt_v1(current_setting('t.review')::uuid, '00000000-0000-4000-8000-00000000b001')) ->> 'attempt_id',
  current_setting('t.r'), 'start retry with same request key returns same attempt');
select is((public.start_attempt_v1(current_setting('t.review')::uuid, gen_random_uuid())) ->> 'attempt_id',
  current_setting('t.r'), 'starting again resumes the active attempt');
select throws_ok($$select public.start_attempt_v1(current_setting('t.review')::uuid, gen_random_uuid(), false)$$,
  'PT409', 'ATTEMPT_ACTIVE', 'ATTEMPT_ACTIVE when resume is not requested');

reset role;
select set_config('t.rq1', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.r')::uuid and position = 1), true) is not null as setup;
select set_config('t.rq2', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.r')::uuid and position = 2), true) is not null as setup;
select set_config('t.rq3', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.r')::uuid and position = 3), true) is not null as setup;
select set_config('t.rq1_ok', pg_temp.key_of(current_setting('t.rq1')::uuid)::text, true) is not null as setup;
select set_config('t.rq2_ok', pg_temp.key_of(current_setting('t.rq2')::uuid)::text, true) is not null as setup;
select set_config('t.rq3_bad', pg_temp.wrong_of(current_setting('t.rq3')::uuid)::text, true) is not null as setup;
select set_config('t.other_opt', (select id::text from public.question_options where question_version_id <> current_setting('t.rq1')::uuid
  and question_version_id <> current_setting('t.rq2')::uuid and question_version_id <> current_setting('t.rq3')::uuid limit 1), true) is not null as setup;
select pg_temp.login(current_setting('t.s')::uuid);

select is((public.check_review_answer_v1(current_setting('t.r')::uuid, current_setting('t.rq1')::uuid,
  current_setting('t.rq1_ok')::uuid, gen_random_uuid())) ->> 'is_correct', 'true', 'review check returns correctness after locking');
select ok((public.check_review_answer_v1(current_setting('t.r')::uuid, current_setting('t.rq1')::uuid,
  current_setting('t.rq1_ok')::uuid, gen_random_uuid())) ->> 'explanation' is not null, 'explanation available once locked');
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 5)), gen_random_uuid())$$, current_setting('t.r'), current_setting('t.rq1'), current_setting('t.rq3_bad')),
  'PT422', 'VALIDATION_FAILED', 'option from a different question is rejected');
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 5)), gen_random_uuid())$$, current_setting('t.r'), current_setting('t.rq1'), current_setting('t.other_opt')),
  'PT422', 'VALIDATION_FAILED', 'option outside the attempt is rejected');
select ok(jsonb_path_exists(public.get_attempt_result_v1(current_setting('t.r')::uuid), '$.questions[*].feedback.correct_option_id'),
  'locked review answer reveals feedback');
select is((select count(*)::integer from jsonb_array_elements((public.get_attempt_result_v1(current_setting('t.r')::uuid)) -> 'questions') q
           where q -> 'feedback' is not null and q -> 'feedback' <> 'null'::jsonb), 1, 'only the locked question reveals feedback');
select is((public.check_review_answer_v1(current_setting('t.r')::uuid, current_setting('t.rq2')::uuid,
  current_setting('t.rq2_ok')::uuid, gen_random_uuid())) ->> 'is_correct', 'true', 'second review answer correct');
select is((public.check_review_answer_v1(current_setting('t.r')::uuid, current_setting('t.rq3')::uuid,
  current_setting('t.rq3_bad')::uuid, gen_random_uuid())) ->> 'is_correct', 'false', 'third review answer wrong');
select is(((public.submit_attempt_v1(current_setting('t.r')::uuid, null, gen_random_uuid())) -> 'result' ->> 'xp_awarded')::integer, 13,
  'topic check awards floor(20 times 2/3)');

-- second review attempt: same questions correct again earn nothing
select set_config('t.r2', (public.start_attempt_v1(current_setting('t.review')::uuid, gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
reset role;
select set_config('t.r2_answers', (select jsonb_agg(jsonb_build_object('question_version_id', aq.question_version_id,
  'option_id', pg_temp.key_of(aq.question_version_id), 'answer_revision', 1))::text
  from public.attempt_questions aq where aq.attempt_id = current_setting('t.r2')::uuid), true) is not null as setup;
select set_config('t.r2_expected', '7', true) is not null as setup;
select pg_temp.login(current_setting('t.s')::uuid);
select is((public.save_attempt_answers_v1(current_setting('t.r2')::uuid, current_setting('t.r2_answers')::jsonb, gen_random_uuid())) -> 'saved' ->> 0 is not null,
  true, 'answers saved on second review attempt');
select is(((public.submit_attempt_v1(current_setting('t.r2')::uuid, null, gen_random_uuid())) -> 'result' ->> 'xp_awarded')::integer,
  current_setting('t.r2_expected')::integer, 'improving to perfect earns only the remaining topic XP');

-- ---------------------------------------------------------------- practice (after_submit feedback)
select set_config('t.p', (public.start_attempt_v1(current_setting('t.practice')::uuid, gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
reset role;
select set_config('t.pq1', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.p')::uuid and position = 1), true) is not null as setup;
select set_config('t.pq1_ok', pg_temp.key_of(current_setting('t.pq1')::uuid)::text, true) is not null as setup;
select set_config('t.pq1_bad', pg_temp.wrong_of(current_setting('t.pq1')::uuid)::text, true) is not null as setup;
select pg_temp.login(current_setting('t.s')::uuid);

select throws_ok($$select public.check_review_answer_v1(current_setting('t.p')::uuid, current_setting('t.pq1')::uuid,
  current_setting('t.pq1_ok')::uuid, gen_random_uuid())$$, 'PT403', 'FORBIDDEN', 'practice does not give immediate feedback');
select is((public.save_attempt_answers_v1(current_setting('t.p')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.pq1'), 'option_id', current_setting('t.pq1_bad'), 'answer_revision', 1)), gen_random_uuid())) ->> 'revision', '1',
  'save answer revision 1');
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 1)), gen_random_uuid())$$, current_setting('t.p'), current_setting('t.pq1'), current_setting('t.pq1_ok')),
  'PT409', 'STALE_REVISION', 'same revision with a different option is stale');
select is((public.save_attempt_answers_v1(current_setting('t.p')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.pq1'), 'option_id', current_setting('t.pq1_bad'), 'answer_revision', 1)), gen_random_uuid())) ->> 'revision', '2',
  'replaying an identical save is accepted');
select is((public.save_attempt_answers_v1(current_setting('t.p')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.pq1'), 'option_id', current_setting('t.pq1_ok'), 'answer_revision', 2)), gen_random_uuid())) -> 'saved' -> 0 ->> 'answer_revision', '2',
  'newer revision overwrites');
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 1)), gen_random_uuid())$$, current_setting('t.p'), current_setting('t.pq1'), current_setting('t.pq1_bad')),
  'PT409', 'STALE_REVISION', 'older revision cannot overwrite');
select ok(not jsonb_path_exists(public.get_attempt_result_v1(current_setting('t.p')::uuid), '$.questions[*].feedback.correct_option_id'),
  'practice keys hidden before submission');

-- ownership
reset role;
select pg_temp.login(current_setting('t.o')::uuid);
select throws_ok($$select public.get_attempt_result_v1(current_setting('t.p')::uuid)$$, 'PT403', 'FORBIDDEN', 'other student cannot read my attempt');
select throws_ok($$select public.submit_attempt_v1(current_setting('t.p')::uuid, null, gen_random_uuid())$$, 'PT403', 'FORBIDDEN', 'other student cannot submit my attempt');
reset role;
select pg_temp.login(current_setting('t.s')::uuid);

select set_config('t.psubmit', (public.submit_attempt_v1(current_setting('t.p')::uuid, null, '00000000-0000-4000-8000-00000000b002'))::text, true) is not null as setup;
select is(current_setting('t.psubmit')::jsonb ->> 'status', 'submitted', 'practice submitted');
select is((current_setting('t.psubmit')::jsonb -> 'result' ->> 'xp_awarded')::integer, 8, 'practice earns floor(50 times 1/6)');
select is((current_setting('t.psubmit')::jsonb -> 'result' ->> 'correct_count')::integer, 1, 'graded against private key');
select ok(jsonb_path_exists(current_setting('t.psubmit')::jsonb, '$.questions[*].feedback.explanation'), 'explanations shown after submission');
select is((public.submit_attempt_v1(current_setting('t.p')::uuid, null, gen_random_uuid())) -> 'result', current_setting('t.psubmit')::jsonb -> 'result',
  'submit retry returns the same committed result');
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 9)), gen_random_uuid())$$, current_setting('t.p'), current_setting('t.pq1'), current_setting('t.pq1_bad')),
  'PT409', 'DEADLINE_PASSED', 'finalized attempt answers cannot change');

-- second practice attempt: no second first-completion reward
select set_config('t.p2', (public.start_attempt_v1(current_setting('t.practice')::uuid, gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
reset role;
select set_config('t.p2q1', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.p2')::uuid and position = 1), true) is not null as setup;
select set_config('t.p2q1_ok', pg_temp.key_of(current_setting('t.p2q1')::uuid)::text, true) is not null as setup;
select pg_temp.login(current_setting('t.s')::uuid);
select is(((public.submit_attempt_v1(current_setting('t.p2')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.p2q1'), 'option_id', current_setting('t.p2q1_ok'), 'answer_revision', 1)), gen_random_uuid())) -> 'result' ->> 'xp_awarded')::integer, 0,
  'repeat practice earns no second first-completion XP');
select is((select count(*)::integer from public.points_ledger where source_type='practice'), 2, 'each attempt has one idempotent ledger entry including zero awards');

-- ---------------------------------------------------------------- mock: deadline enforcement
select set_config('t.m', (public.start_attempt_v1(current_setting('t.mock')::uuid, gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
select ok((public.get_attempt_result_v1(current_setting('t.m')::uuid)) ->> 'expires_at' is not null, 'mock attempt has a server deadline');
reset role;
select set_config('t.mq1', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.m')::uuid and position = 1), true) is not null as setup;
select set_config('t.mq2', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.m')::uuid and position = 2), true) is not null as setup;
select set_config('t.mq1_ok', pg_temp.key_of(current_setting('t.mq1')::uuid)::text, true) is not null as setup;
select set_config('t.mq2_ok', pg_temp.key_of(current_setting('t.mq2')::uuid)::text, true) is not null as setup;
select pg_temp.login(current_setting('t.s')::uuid);
select is((public.save_attempt_answers_v1(current_setting('t.m')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.mq1'), 'option_id', current_setting('t.mq1_ok'), 'answer_revision', 1)), gen_random_uuid())) ->> 'revision', '1',
  'answer saved before deadline');
reset role;
update public.assessment_attempts set started_at = now() - interval '2 hours', expires_at = now() - interval '1 second'
 where id = current_setting('t.m')::uuid;
update public.attempt_answers set received_at = now() - interval '1 hour' where attempt_id = current_setting('t.m')::uuid;
select pg_temp.login(current_setting('t.s')::uuid);
select throws_ok(format($$select public.save_attempt_answers_v1(%L, jsonb_build_array(jsonb_build_object('question_version_id', %L,
  'option_id', %L, 'answer_revision', 1)), gen_random_uuid())$$, current_setting('t.m'), current_setting('t.mq2'), current_setting('t.mq2_ok')),
  'PT409', 'DEADLINE_PASSED', 'save after deadline rejected');
select set_config('t.msubmit', (public.submit_attempt_v1(current_setting('t.m')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.mq2'), 'option_id', current_setting('t.mq2_ok'), 'answer_revision', 1)), gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.msubmit')::jsonb ->> 'status', 'expired', 'late submit finalizes as expired');
select is((current_setting('t.msubmit')::jsonb -> 'result' ->> 'answered_count')::integer, 1, 'late submit cannot add answers');
select is((current_setting('t.msubmit')::jsonb -> 'result' ->> 'correct_count')::integer, 1, 'expired attempt grades saved answers');
select is((current_setting('t.msubmit')::jsonb -> 'result' ->> 'xp_awarded')::integer, 0, 'expired mock grades saved answers without awarding XP');

-- worker path: overdue attempt finalized by the sweep without the client
select set_config('t.r3', (public.start_attempt_v1('31000000-0000-4000-8000-000000000002', gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
reset role;
update public.assessment_attempts set started_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
 where id = current_setting('t.r3')::uuid;
select ok((private.run_sweep() ->> 'attempts_finalized')::integer >= 1, 'sweep finalizes overdue attempts');
select is((select status from public.assessment_attempts where id = current_setting('t.r3')::uuid), 'expired', 'overdue attempt expired by worker');

-- Direct table access stays denied
select pg_temp.login(current_setting('t.s')::uuid);
select is((select count(*)::integer from public.assessment_attempts), 0, 'attempt rows are RPC-only for students');
select throws_ok($$select * from public.attempt_answers$$, '42501', null, 'attempt_answers not selectable');
select throws_ok($$update public.assessment_attempts set correct_count = 99$$, '42501', null, 'client cannot write scores');
select ok(((public.get_my_profile_v1()) -> 'streak' ->> 'current')::integer >= 1, 'assessment completion counts toward streak');
reset role;

select * from finish();
rollback;
