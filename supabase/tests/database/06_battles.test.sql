-- Battles: one live slot, invite/queue lifecycle, authoritative schedule & deadlines, first-answer-wins,
-- redaction (no keys), finalization + uncapped rewards for both, D13 cancel/forfeit = no XP,
-- disconnect != forfeit, worker finalization, Realtime topic authorization.
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
-- Moves a battle's whole schedule into the past by p_by (simulates elapsed time; run as postgres).
create function pg_temp.shift_battle(p_battle uuid, p_by interval) returns void language sql as $$
  update public.battles set starts_at = starts_at - p_by, ends_at = ends_at - p_by, ready_deadline = ready_deadline - p_by,
         invitation_expires_at = invitation_expires_at - p_by, created_at = created_at - p_by
   where id = p_battle;
  update public.battle_questions set opened_at = opened_at - p_by, deadline = deadline - p_by where battle_id = p_battle;
  update public.battle_answers set received_at=received_at-p_by where battle_id=p_battle;
$$;

select set_config('t.a', pg_temp.enrolled_student('Battler A')::text, true) is not null as setup;
select set_config('t.b', pg_temp.enrolled_student('Battler B')::text, true) is not null as setup;
select set_config('t.c', pg_temp.enrolled_student('Battler C')::text, true) is not null as setup;
select set_config('t.off', '20000000-0000-4000-8000-000000000002', true) is not null as setup;

-- ---------------------------------------------------------------- direct invite + single live slot
select pg_temp.login(current_setting('t.a')::uuid);
select set_config('t.b1json', (public.create_direct_battle_v1(current_setting('t.off')::uuid, '00000000-0000-4000-8000-00000000d001'))::text, true)
  is not null as setup;
select set_config('t.b1', current_setting('t.b1json')::jsonb ->> 'battle_id', true) is not null as setup;
select set_config('t.token', current_setting('t.b1json')::jsonb ->> 'invite_token', true) is not null as setup;
select is(current_setting('t.b1json')::jsonb ->> 'state', 'waiting', 'direct battle waits for the invitee');
select ok(length(current_setting('t.token')) >= 32, 'creator receives a private invite token');
select ok((current_setting('t.b1json')::jsonb ->> 'invitation_expires_at')::timestamptz <= now() + interval '5 minutes',
  'invitation expires after five minutes');
select is((public.create_direct_battle_v1(current_setting('t.off')::uuid, '00000000-0000-4000-8000-00000000d001')) ->> 'battle_id',
  current_setting('t.b1'), 'create retry with same request key is idempotent');
select throws_ok($$select public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())$$, 'PT409', 'SLOT_BUSY',
  'cannot queue while holding a live battle slot');
select throws_ok($$select public.create_direct_battle_v1(current_setting('t.off')::uuid, gen_random_uuid())$$, 'PT409', 'SLOT_BUSY',
  'cannot create a second concurrent battle');
select throws_ok($$select public.accept_battle_v1(current_setting('t.token'), gen_random_uuid())$$, 'PT403', 'FORBIDDEN',
  'creator cannot accept own invitation');

reset role;
select pg_temp.login(current_setting('t.b')::uuid);
select throws_ok($$select public.accept_battle_v1('not-a-real-token-not-a-real-token-xx', gen_random_uuid())$$, 'PT410', 'QUEUE_EXPIRED',
  'unknown invite token rejected');
select is((public.accept_battle_v1(current_setting('t.token'), gen_random_uuid())) ->> 'state', 'ready', 'invitee accepts; battle is ready');
select is((public.accept_battle_v1(current_setting('t.token'), gen_random_uuid())) ->> 'state', 'ready', 'accept retry is idempotent');
reset role;
select pg_temp.login(current_setting('t.c')::uuid);
select throws_ok($$select public.accept_battle_v1(current_setting('t.token'), gen_random_uuid())$$, 'PT409', 'BATTLE_FULL',
  'third user cannot join a full battle');
select throws_ok($$select public.get_battle_state_v1(current_setting('t.b1')::uuid)$$, 'PT403', 'FORBIDDEN', 'non-participant cannot read battle');
select ok(not authz.can_access_topic('battle:' || current_setting('t.b1')), 'non-participant cannot join battle Realtime topic');
select ok(not authz.can_access_topic('user:' || current_setting('t.a')), 'cannot join another user''s topic');
reset role;

-- ---------------------------------------------------------------- ready -> countdown with full schedule
select pg_temp.login(current_setting('t.a')::uuid);
select ok(authz.can_access_topic('battle:' || current_setting('t.b1')), 'participant can join battle Realtime topic');
select ok(authz.can_access_topic('user:' || current_setting('t.a')), 'user can join own topic');
select ok((public.get_battle_state_v1(current_setting('t.b1')::uuid)) ->> 'invite_token' is null, 'invite token hidden after acceptance');
select is((public.ready_battle_v1(current_setting('t.b1')::uuid, gen_random_uuid())) ->> 'state', 'ready', 'one ready player keeps state ready');
reset role;
select pg_temp.login(current_setting('t.b')::uuid);
select set_config('t.cd', (public.ready_battle_v1(current_setting('t.b1')::uuid, gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.cd')::jsonb ->> 'state', 'countdown', 'both ready -> countdown');
select ok(current_setting('t.cd')::jsonb -> 'current_question' = 'null'::jsonb or current_setting('t.cd')::jsonb -> 'current_question' is null,
  'no prompt is revealed during countdown');
select is(((current_setting('t.cd')::jsonb ->> 'ends_at')::timestamptz - (current_setting('t.cd')::jsonb ->> 'starts_at')::timestamptz),
  interval '100 seconds', 'schedule = 5 rounds x 20 seconds');
reset role;
select is((select count(*)::integer from public.battle_questions where battle_id = current_setting('t.b1')::uuid), 5, 'five questions scheduled up front');
select is((select count(*)::integer from public.battle_questions bq join public.question_versions qv on qv.id = bq.question_version_id
           join public.questions q on q.id = qv.question_id where bq.battle_id = current_setting('t.b1')::uuid and q.pool = 'battle'), 5,
  'battle questions come from the battle pool only');
select is((select count(distinct qv.question_id)::integer from public.battle_questions bq join public.question_versions qv on qv.id = bq.question_version_id
           where bq.battle_id = current_setting('t.b1')::uuid), 5, 'no duplicate questions sampled');

-- enter round 1
select pg_temp.shift_battle(current_setting('t.b1')::uuid, interval '6 seconds');
select set_config('t.q1', (select question_version_id::text from public.battle_questions where battle_id = current_setting('t.b1')::uuid and position = 1), true) is not null as setup;
select set_config('t.q1_ok', (select correct_option_id::text from private.question_answer_keys where question_version_id = current_setting('t.q1')::uuid), true) is not null as setup;
select set_config('t.q2opt', (select o.id::text from public.battle_questions bq join public.question_options o on o.question_version_id = bq.question_version_id
  where bq.battle_id = current_setting('t.b1')::uuid and bq.position = 2 limit 1), true) is not null as setup;

select pg_temp.login(current_setting('t.a')::uuid);
select set_config('t.s1', (public.get_battle_state_v1(current_setting('t.b1')::uuid))::text, true) is not null as setup;
select is(current_setting('t.s1')::jsonb ->> 'state', 'active', 'countdown elapsed -> active (catch-up on read)');
select is((current_setting('t.s1')::jsonb -> 'current_question' ->> 'position')::integer, 1, 'only the current prompt is returned');
select is(jsonb_array_length(current_setting('t.s1')::jsonb -> 'current_question' -> 'options'), 4, 'current prompt includes options');
select ok(not jsonb_path_exists(current_setting('t.s1')::jsonb, '$.participants[*] ? (@.correct_count != null)')
  and position('correct_option_id' in current_setting('t.s1'))=0, 'state payload hides correctness and keys during play');

select is((public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q1_ok')::uuid, '00000000-0000-4000-8000-00000000d101')) ->> 'accepted',
  'true', 'answer acknowledged');
select ok(position('correct' in (public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q1_ok')::uuid,
  '00000000-0000-4000-8000-00000000d101'))::text) = 0, 'acknowledgement does not reveal correctness');
select is((public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q1_ok')::uuid, '00000000-0000-4000-8000-00000000d101')) ->> 'accepted',
  'true', 'retry with same request key returns prior acknowledgement');
select is((public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q1_ok')::uuid, gen_random_uuid())) ->> 'already_answered',
  'true', 'first valid answer wins; second answer ignored');
select throws_ok($$select public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 2, current_setting('t.q2opt')::uuid, gen_random_uuid())$$,
  'PT409', 'INVALID_STATE', 'future question cannot be answered');
select throws_ok($$select public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q2opt')::uuid, gen_random_uuid())$$,
  'PT422', 'VALIDATION_FAILED', 'option from another question rejected');
select is((select count(*)::integer from public.battles), 0, 'battles are not directly readable');
select throws_ok($$select * from public.battle_answers$$, '42501', null, 'battle answers not readable');
select throws_ok($$select * from private.battle_slots$$, '42501', null, 'battle slots not readable');
select throws_ok($$insert into public.battle_answers (battle_id, user_id, position, question_version_id, option_id, request_key, received_at, is_correct)
  values (current_setting('t.b1')::uuid, auth.uid(), 2, current_setting('t.q1')::uuid, current_setting('t.q1_ok')::uuid, gen_random_uuid(), now(), true)$$,
  '42501', null, 'client cannot insert answers or correctness directly');
reset role;

-- B "disconnects" (never answers); round 1 closes
select pg_temp.shift_battle(current_setting('t.b1')::uuid, interval '20 seconds');
select pg_temp.login(current_setting('t.b')::uuid);
select throws_ok($$select public.submit_battle_answer_v1(current_setting('t.b1')::uuid, 1, current_setting('t.q1_ok')::uuid, gen_random_uuid())$$,
  'PT409', 'DEADLINE_PASSED', 'answer after the question deadline rejected');
select is((public.get_battle_state_v1(current_setting('t.b1')::uuid)) ->> 'state', 'active', 'disconnect alone does not forfeit or end the battle');
reset role;

-- A already hit the learning cap today: battle XP must still be granted.
insert into private.daily_counters (user_id, local_date, learning_xp_awarded) values (current_setting('t.a')::uuid, private.lagos_date(), 100);

-- scheduled end reached
select pg_temp.shift_battle(current_setting('t.b1')::uuid, interval '200 seconds');
select pg_temp.login(current_setting('t.b')::uuid);
select set_config('t.fb', (public.get_battle_state_v1(current_setting('t.b1')::uuid))::text, true) is not null as setup;
select is(current_setting('t.fb')::jsonb ->> 'state', 'finished', 'battle reaching scheduled end is finalized');
select is(current_setting('t.fb')::jsonb -> 'outcome' ->> 'result', 'loss', 'B lost (accuracy only)');
select is((current_setting('t.fb')::jsonb -> 'outcome' ->> 'xp_awarded')::integer, 0, 'zero correct answers and a loss earns no XP');
select is(jsonb_array_length(current_setting('t.fb')::jsonb -> 'rounds'), 5, 'results list every round');
select ok(position('correct_option' in current_setting('t.fb')::jsonb::text) = 0, 'results never reveal battle answer keys');
reset role;
select pg_temp.login(current_setting('t.a')::uuid);
select is((public.get_battle_state_v1(current_setting('t.b1')::uuid)) -> 'outcome' ->> 'result', 'win', 'A won');
select is(((public.get_battle_state_v1(current_setting('t.b1')::uuid)) -> 'outcome' ->> 'xp_awarded')::integer, 7,
  'accuracy plus win bonus applies independently of legacy learning counters');
select is(jsonb_array_length((public.get_my_battles_v1()) -> 'items'), 1, 'battle history lists the battle');
reset role;
select is(private.finalize_battle(current_setting('t.b1')::uuid), 'finished', 'finalizer is idempotent');
select is((select count(*)::integer from public.points_ledger where source_id = current_setting('t.b1')::uuid), 2, 'exactly one reward per participant');
select is((select count(*)::integer from public.activity_events where source_id = current_setting('t.b1')::uuid and kind = 'battle_completed'), 2,
  'completed battle counts as activity for both');
select is((select count(*)::integer from private.battle_slots where user_id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid)), 0,
  'live slots released on terminal state');
select is((select learning_xp_awarded from private.daily_counters where user_id = current_setting('t.a')::uuid and local_date = private.lagos_date()), 100,
  'battle reward did not touch the learning counter');

-- ---------------------------------------------------------------- unlimited participation; pre-start cancel = no XP
select pg_temp.login(current_setting('t.a')::uuid);
select is((select count(*)::integer from generate_series(1, 5) g
           cross join lateral (select (public.create_direct_battle_v1(current_setting('t.off')::uuid, gen_random_uuid()) ->> 'battle_id')::uuid as id) c
           cross join lateral (select public.forfeit_battle_v1(c.id, gen_random_uuid()) ->> 'state' as st) f
           where f.st = 'cancelled'), 5, 'no daily quota: consecutive battles allowed; pre-start cancel works');
reset role;
select is((select count(*)::integer from public.points_ledger l join public.battles b on b.id = l.source_id where b.state = 'cancelled'), 0,
  'cancelled battles award no XP');

-- ---------------------------------------------------------------- queue match + early forfeit (no XP for either)
select pg_temp.login(current_setting('t.a')::uuid);
select is((public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())) ->> 'state', 'waiting', 'A waits in queue');
select throws_ok($$select public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())$$, 'PT409', 'SLOT_BUSY',
  'a second queue entry is rejected while waiting');
reset role;
select pg_temp.login(current_setting('t.b')::uuid);
select set_config('t.qb', (public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.qb')::jsonb ->> 'state', 'matched', 'B is matched with A');
select set_config('t.b2', current_setting('t.qb')::jsonb ->> 'battle_id', true) is not null as setup;
select is((public.ready_battle_v1(current_setting('t.b2')::uuid, gen_random_uuid())) ->> 'state', 'ready', 'B ready');
reset role;
select pg_temp.login(current_setting('t.a')::uuid);
select is((public.get_my_live_battle_v1()) -> 'battle' ->> 'battle_id', current_setting('t.b2'), 'A discovers the matched battle');
select is((public.ready_battle_v1(current_setting('t.b2')::uuid, gen_random_uuid())) ->> 'state', 'countdown', 'both ready');
reset role;
select pg_temp.shift_battle(current_setting('t.b2')::uuid, interval '30 seconds');
select pg_temp.login(current_setting('t.a')::uuid);
select set_config('t.ff', (public.forfeit_battle_v1(current_setting('t.b2')::uuid, gen_random_uuid()))::text, true) is not null as setup;
select is(current_setting('t.ff')::jsonb ->> 'state', 'cancelled', 'early forfeit cancels the battle');
select is(current_setting('t.ff')::jsonb ->> 'result_kind', 'forfeit', 'result kind is forfeit');
reset role;
select is((select count(*)::integer from public.points_ledger where source_id = current_setting('t.b2')::uuid), 0, 'early forfeit awards no XP to either player');
select is((select count(*)::integer from private.battle_slots where battle_id = current_setting('t.b2')::uuid), 0, 'slots released after forfeit');
select is((select count(*)::integer from public.notifications where user_id = current_setting('t.b')::uuid and kind = 'battle_cancelled'), 1, 'opponent notified');

-- ---------------------------------------------------------------- ready timeout
select pg_temp.login(current_setting('t.a')::uuid);
select is((public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())) ->> 'state', 'waiting', 'A queues again');
reset role;
select pg_temp.login(current_setting('t.b')::uuid);
select set_config('t.b3', (public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())) ->> 'battle_id', true) is not null as setup;
reset role;
select pg_temp.shift_battle(current_setting('t.b3')::uuid, interval '11 seconds');
select pg_temp.login(current_setting('t.b')::uuid);
select is((public.get_battle_state_v1(current_setting('t.b3')::uuid)) ->> 'cancel_reason', 'ready_timeout', 'ready window expiry cancels');
select throws_ok($$select public.ready_battle_v1(current_setting('t.b3')::uuid, gen_random_uuid())$$, 'PT409', 'DEADLINE_PASSED',
  'ready after the window is rejected');
reset role;

-- ---------------------------------------------------------------- queue expiry and leave
select pg_temp.login(current_setting('t.c')::uuid);
select set_config('t.qc', (public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())) ->> 'queue_id', true) is not null as setup;
reset role;
update public.battle_queue set queued_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute' where id = current_setting('t.qc')::uuid;
update private.battle_slots set expires_at = now() - interval '1 minute' where queue_id = current_setting('t.qc')::uuid;
select ok(private.reconcile_reservations() >= 1, 'worker reconciles expired reservations');
select is((select state from public.battle_queue where id = current_setting('t.qc')::uuid), 'expired', 'queue entry expired after timeout');
select is((select count(*)::integer from private.battle_slots where user_id = current_setting('t.c')::uuid), 0, 'expired queue slot released');
select pg_temp.login(current_setting('t.c')::uuid);
select is((public.join_queue_v1(current_setting('t.off')::uuid, gen_random_uuid())) ->> 'state', 'waiting', 'can queue again after expiry');
select is((public.leave_queue_v1()) ->> 'state', 'cancelled', 'leave queue cancels the entry');
reset role;

-- ---------------------------------------------------------------- draw + worker finalization without clients
select pg_temp.login(current_setting('t.a')::uuid);
select set_config('t.b4json', (public.create_direct_battle_v1(current_setting('t.off')::uuid, gen_random_uuid()))::text, true) is not null as setup;
select set_config('t.b4', current_setting('t.b4json')::jsonb ->> 'battle_id', true) is not null as setup;
reset role;
select pg_temp.login(current_setting('t.b')::uuid);
select is((public.accept_battle_v1(current_setting('t.b4json')::jsonb ->> 'invite_token', gen_random_uuid())) ->> 'state', 'ready', 'accepted');
select is((public.ready_battle_v1(current_setting('t.b4')::uuid, gen_random_uuid())) ->> 'state', 'ready', 'B ready');
reset role;
select pg_temp.login(current_setting('t.a')::uuid);
select is((public.ready_battle_v1(current_setting('t.b4')::uuid, gen_random_uuid())) ->> 'state', 'countdown', 'countdown');
reset role;
select pg_temp.shift_battle(current_setting('t.b4')::uuid, interval '300 seconds');
select ok((private.run_sweep() ->> 'battles_advanced')::integer >= 1, 'sweep advances overdue battles');
select is((select state from public.battles where id = current_setting('t.b4')::uuid), 'finished', 'worker finalized battle with both clients closed');
select is((select result_kind from public.battles where id = current_setting('t.b4')::uuid), 'draw', 'equal accuracy is a draw (D05)');
select is((select sum(amount)::integer from public.points_ledger where source_id = current_setting('t.b4')::uuid), 4, 'zero-correct draw awards 2 XP to each');
select ok((select count(*) from private.outbox where topic = 'battle:' || current_setting('t.b4')) >= 1, 'state changes enqueued to the outbox');
select ok(not exists (select 1 from private.outbox where position('correct' in safe_payload::text) > 0), 'outbox payloads are redacted');

select * from finish();
rollback;
