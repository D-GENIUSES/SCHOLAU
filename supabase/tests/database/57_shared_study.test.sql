-- Shared study: eligibility RPCs and link creation.
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
create function pg_temp.battle_with_question(p_state text, p_version uuid) returns uuid language plpgsql as $$
declare v_battle uuid; v_creator uuid := pg_temp.enrolled_student('Battle fixture ' || p_state);
begin
  insert into public.battles(offering_id, rules_id, mode, state, created_by, request_key, starts_at, ends_at,
    finalized_at, round_count, seconds_per_round)
  values (
    '20000000-0000-4000-8000-000000000002',
    (select id from public.battle_rules where published_at is not null order by version desc limit 1),
    'direct', p_state, v_creator, gen_random_uuid(),
  case when p_state in ('finished', 'voided', 'cancelled') then now() - interval '2 minutes' else now() - interval '1 minute' end,
  case when p_state in ('finished', 'voided', 'cancelled') then now() - interval '1 minute' else now() + interval '5 minutes' end,
    case when p_state in ('finished', 'voided', 'cancelled') then now() else null end,
    1, 20
  ) returning id into v_battle;
  insert into public.battle_participants(battle_id, user_id, seat) values (v_battle, v_creator, 1);
  insert into public.battle_questions(battle_id, position, question_version_id, reading_at, opened_at, deadline, option_order)
  values (
    v_battle, 1, p_version, now() - interval '50 seconds', now() - interval '40 seconds', now() - interval '10 seconds',
    array(select o.id from public.question_options o where o.question_version_id = p_version order by o.position)
  );
  return v_battle;
end $$;

select set_config('t.s', pg_temp.enrolled_student('Share Student')::text, true) is not null as setup;
select set_config('t.o', pg_temp.new_user('Outsider')::text, true) is not null as setup;
select set_config('t.practice_qv', (select qv.id::text from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  where q.logical_key = 'L1-Q1' and qv.status = 'published' and qv.usage && array['practice','review']
  limit 1), true) is not null as setup;
select set_config('t.mock_qv', (select aq.question_version_id::text
  from public.assessment_questions aq
  join public.assessment_versions av on av.id = aq.assessment_version_id
  join public.assessments a on a.id = av.assessment_id
  where av.id = '31000000-0000-4000-8000-000000000005'::uuid and a.kind = 'mock' and av.published_at is not null
  limit 1), true) is not null as setup;

select is(public.can_share_bank_question_v1('bank', current_setting('t.practice_qv')::uuid, 0),
  true, 'practice bank version is shareable');
select is(public.can_share_bank_question_v1('bank', current_setting('t.mock_qv')::uuid, 0),
  false, 'mock exam version is not shareable');
select is((public.can_share_bank_questions_v1(array[
    current_setting('t.practice_qv')::uuid,
    current_setting('t.mock_qv')::uuid
  ]) ->> current_setting('t.practice_qv'))::boolean, true, 'batch map marks practice version shareable');
select is((public.can_share_bank_questions_v1(array[
    current_setting('t.practice_qv')::uuid,
    current_setting('t.mock_qv')::uuid
  ]) ->> current_setting('t.mock_qv'))::boolean, false, 'batch map marks mock version protected');

select pg_temp.login(current_setting('t.s')::uuid);
select ok((public.create_shared_study_link_v1('bank', current_setting('t.practice_qv')::uuid, 0) ->> 'token') is not null,
  'enrolled student creates a shared study link');
reset role;

select pg_temp.login(current_setting('t.o')::uuid);
select is(public.create_shared_study_link_v1('bank', current_setting('t.practice_qv')::uuid, 0), null,
  'unenrolled user cannot create a shared study link');
reset role;

select set_config('t.practice_qv2', (select qv.id::text from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  where q.logical_key = 'L1-Q2' and qv.status = 'published' and qv.usage && array['practice','review']
  limit 1), true) is not null as setup;

select set_config('t.finished_battle', pg_temp.battle_with_question('finished', current_setting('t.practice_qv2')::uuid)::text, true) is not null as setup;
select is(public.can_share_bank_question_v1('bank', current_setting('t.practice_qv2')::uuid, 0),
  true, 'practice version stays shareable after use in a finished battle');

select set_config('t.practice_qv3', (select qv.id::text from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  where q.logical_key = 'L1-Q3' and qv.status = 'published' and qv.usage && array['practice','review']
  limit 1), true) is not null as setup;
select set_config('t.active_battle', pg_temp.battle_with_question('active', current_setting('t.practice_qv3')::uuid)::text, true) is not null as setup;
select is(public.can_share_bank_question_v1('bank', current_setting('t.practice_qv3')::uuid, 0),
  false, 'practice version in an active battle is not shareable');

select set_config('t.practice_qv4', (select qv.id::text from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  where q.logical_key = 'L1-Q4' and qv.status = 'published' and qv.usage && array['practice','review']
  limit 1), true) is not null as setup;
select set_config('t.waiting_battle', pg_temp.battle_with_question('waiting', current_setting('t.practice_qv4')::uuid)::text, true) is not null as setup;
select is(public.can_share_bank_question_v1('bank', current_setting('t.practice_qv4')::uuid, 0),
  false, 'practice version in a waiting battle is not shareable');

select * from finish();
rollback;
