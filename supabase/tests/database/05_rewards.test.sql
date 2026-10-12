-- Rewards: logical uniqueness, idempotent retries, learning-only daily cap, uncapped battle XP,
-- append-only ledger, transactional totals, compensating corrections.
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
  insert into public.enrollments (user_id, offering_id) values (v, '20000000-0000-4000-8000-000000000002');
  return v;
end $$;

select set_config('t.u', pg_temp.enrolled_student('Reward Student')::text, true) is not null as setup;
select set_config('t.v', pg_temp.enrolled_student('Cap Student')::text, true) is not null as setup;

-- ---------------------------------------------------------------- lesson completion via RPC
select pg_temp.login(current_setting('t.u')::uuid);
select is(((public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())) ->> 'xp_awarded')::integer, 5,
  'first lesson completion awards +5');
select is((public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())) ->> 'already_completed', 'true',
  'repeat completion is acknowledged');
select is(((public.complete_lesson_v1('23000000-0000-4000-8000-000000000001', gen_random_uuid())) ->> 'xp_awarded')::integer, 0,
  'repeat completion awards nothing');
select is((select count(*)::integer from public.points_ledger where source_type = 'lesson'), 1, 'one ledger row per logical lesson');
select is((select total from public.user_points), 5::bigint, 'total maintained transactionally');
select is((select count(*)::integer from public.activity_events where kind = 'lesson_completed'), 1, 'lesson activity recorded once');
select is(((public.get_home_summary_v1()) -> 'streak' ->> 'current')::integer, 1, 'streak counts today''s activity');
select is((public.get_home_summary_v1()) -> 'continue_learning' ->> 'lesson_id', '22000000-0000-4000-8000-000000000002',
  'continue learning points to the next uncompleted lesson');
select throws_ok($$select private.award_points(auth.uid(), 'lesson_complete', 'lesson', gen_random_uuid(), 'x')$$, '42501', null,
  'students cannot call award_points');
select throws_ok($$insert into public.points_ledger (user_id, source_type, source_id, event_key, requested_amount, amount, local_date)
  values (auth.uid(), 'correction', gen_random_uuid(), 'hack', 0, 1000, current_date)$$, '42501', null, 'students cannot write the ledger');
reset role;

-- ---------------------------------------------------------------- learning daily cap (100) and uncapped battles
select is((select sum(private.award_points(current_setting('t.v')::uuid, 'lesson_complete', 'lesson', gen_random_uuid(),
                                           'cap-test:' || g::text))::integer from generate_series(1, 25) g),
  100, 'learning rewards stop at the 100 XP daily cap (25 x 5 requested)');
select is((select learning_xp_awarded from private.daily_counters where user_id = current_setting('t.v')::uuid
           and local_date = private.lagos_date()), 100, 'daily counter at cap');
select is((select count(*)::integer from public.points_ledger where user_id = current_setting('t.v')::uuid and cap_applied), 5,
  'capped events retained with cap outcome');
select is(private.award_points(current_setting('t.v')::uuid, 'mock_first', 'mock', gen_random_uuid(), 'cap-test:mock'), 0,
  'other learning rules share the same cap');
select is(private.award_points(current_setting('t.v')::uuid, 'lesson_complete', 'lesson', gen_random_uuid(), 'cap-test:1'), 0,
  'duplicate event key is ignored');
select is((select count(*)::integer from public.points_ledger where user_id = current_setting('t.v')::uuid and event_key = 'cap-test:1'), 1,
  'duplicate did not add a ledger row');
select is((select sum(private.award_points(current_setting('t.v')::uuid, 'battle_win', 'battle', gen_random_uuid(),
                                           'battle-cap-test:' || g::text, 25))::integer from generate_series(1, 10) g),
  250, 'battle rewards are not limited by the learning cap');
select is((select learning_xp_awarded from private.daily_counters where user_id = current_setting('t.v')::uuid
           and local_date = private.lagos_date()), 100, 'battle rewards do not consume the learning counter');
select is((select total from public.user_points where user_id = current_setting('t.v')::uuid), 350::bigint, 'total = 100 learning + 250 battle');
select is((select total from public.user_points where user_id = current_setting('t.v')::uuid),
          (select sum(amount) from public.points_ledger where user_id = current_setting('t.v')::uuid)::bigint,
  'cached total equals ledger sum');
select is(private.reconcile_user_points(current_setting('t.v')::uuid), 350::bigint, 'rebuilding totals from the ledger cannot invent points');

-- ---------------------------------------------------------------- ledger is append-only; rules constraints
select throws_ok($$update public.points_ledger set amount = 999$$, '23514', null, 'ledger rows cannot be updated');
select throws_ok($$delete from public.points_ledger$$, '23514', null, 'ledger rows cannot be deleted');
select throws_ok($$insert into private.point_rules (code, version, amount, daily_cap, effective_from) values ('battle_win', 99, 25, 100, now())$$,
  '23514', null, 'battle rules cannot carry a daily cap');
select throws_ok($$insert into private.point_rules (code, version, amount, effective_from) values ('battle_loss', 99, 0, now())$$,
  '23514', null, 'battle rules cannot award zero');
select throws_ok($$insert into public.battle_rules (version, round_count, seconds_per_round, ready_seconds, countdown_seconds, queue_seconds,
  win_xp, draw_xp, loss_xp, tie_policy) values (99, 5, 20, 10, 5, 60, 25, 10, 5, 'speed')$$, '23514', null, 'only the draw tie policy is allowed (D05)');

-- ---------------------------------------------------------------- compensating correction
select pg_temp.login(current_setting('t.u')::uuid);
select set_config('t.p', (public.start_attempt_v1('31000000-0000-4000-8000-000000000004', gen_random_uuid())) ->> 'attempt_id', true) is not null as setup;
reset role;
select set_config('t.pq', (select question_version_id::text from public.attempt_questions where attempt_id = current_setting('t.p')::uuid
  order by position limit 1), true) is not null as setup;
select set_config('t.popt', (select correct_option_id::text from private.question_answer_keys where question_version_id = current_setting('t.pq')::uuid), true)
  is not null as setup;
select pg_temp.login(current_setting('t.u')::uuid);
select is(((public.submit_attempt_v1(current_setting('t.p')::uuid, jsonb_build_array(jsonb_build_object('question_version_id',
  current_setting('t.pq'), 'option_id', current_setting('t.popt'), 'answer_revision', 1)), gen_random_uuid())) -> 'result' ->> 'xp_awarded')::integer,
  10, 'practice reward granted');
select is((select total from public.user_points), 15::bigint, 'total includes practice reward');
reset role;
select pg_temp.login('90000000-0000-4000-8000-000000000002');
select is(jsonb_array_length((public.admin_correct_result_v1('attempt', current_setting('t.p')::uuid, 'Faulty question set',
  '00000000-0000-4000-8000-00000000c001')) -> 'compensations'), 1, 'admin void creates a compensating entry');
select is(jsonb_array_length((public.admin_correct_result_v1('attempt', current_setting('t.p')::uuid, 'Faulty question set',
  gen_random_uuid())) -> 'compensations'), 0, 'repeat correction does not compensate twice');
reset role;
select is((select total from public.user_points where user_id = current_setting('t.u')::uuid), 5::bigint, 'total reduced by compensation');
select is((select count(*)::integer from public.points_ledger where user_id = current_setting('t.u')::uuid), 3,
  'original reward kept; correction appended');
select is((select amount from public.points_ledger where user_id = current_setting('t.u')::uuid and source_type = 'correction'), -10,
  'correction is negative and references the original');
select is((select status from public.assessment_attempts where id = current_setting('t.p')::uuid), 'voided', 'attempt voided');
select is((select count(*)::integer from private.audit_log where action = 'correct_result' and entity_id = current_setting('t.p')::uuid), 2,
  'corrections audited');
select is((select count(*)::integer from public.notifications where user_id = current_setting('t.u')::uuid and kind = 'result_corrected'), 1,
  'affected student notified');

select * from finish();
rollback;
