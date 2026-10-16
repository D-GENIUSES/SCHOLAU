-- Mastery XP v2. Append-only history; no historical awards or silent balance resets.
-- Deployment must stop for an explicit migration decision if legacy awards exist.
do $$ begin
  if exists (select 1 from public.points_ledger where amount <> 0) then
    raise exception 'XP v2 requires an approved legacy-balance migration before rollout. Existing XP has been preserved.';
  end if;
end $$;

alter table public.assessment_attempts add column xp_review_stage integer check (xp_review_stage between 1 and 3);

create table private.xp_bests (
  user_id uuid not null references public.profiles(id),
  activity_type text not null check (activity_type in ('lesson', 'practice', 'mock')),
  activity_id uuid not null,
  earned integer not null default 0 check (earned >= 0),
  primary key (user_id, activity_type, activity_id)
);
create table private.topic_mastery (
  user_id uuid not null references public.profiles(id),
  lesson_id uuid not null references public.lessons(id),
  mastered_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create table private.review_awards (
  user_id uuid not null references public.profiles(id),
  lesson_id uuid not null references public.lessons(id),
  stage integer not null check (stage between 1 and 3),
  attempt_id uuid not null references public.assessment_attempts(id),
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id, stage)
);
create table private.xp_badges (
  user_id uuid not null references public.profiles(id),
  code text not null check (code in ('first_steps', 'topic_mastered', 'perfect_practice', 'exam_ready', 'long_term_recall')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, code)
);
create table private.battle_xp_counts (
  user_id uuid not null references public.profiles(id),
  local_date date not null,
  completed integer not null default 0,
  primary key (user_id, local_date)
);
create table private.battle_opponent_counts (
  user_id uuid not null references public.profiles(id),
  opponent_id uuid not null references public.profiles(id),
  local_date date not null,
  completed integer not null default 0,
  primary key (user_id, opponent_id, local_date)
);
alter table private.xp_bests enable row level security;
alter table private.topic_mastery enable row level security;
alter table private.review_awards enable row level security;
alter table private.xp_badges enable row level security;
alter table private.battle_xp_counts enable row level security;
alter table private.battle_opponent_counts enable row level security;
revoke all on private.xp_bests, private.topic_mastery, private.review_awards, private.xp_badges,
  private.battle_xp_counts, private.battle_opponent_counts from public, anon, authenticated;

-- Keep historical rule versions intact; scoring is determined by the server functions below.
update private.point_rules set effective_until = now() where effective_until is null and effective_from < now();
insert into private.point_rules(code, version, amount, daily_cap, policy, effective_from)
select code, coalesce((select max(r.version) from private.point_rules r where r.code = v.code), 0) + 1,
       amount, null, '{"system":"mastery_v2"}'::jsonb, now()
from (values ('lesson_complete',20), ('review_correct',10), ('practice_first',50), ('mock_first',100),
             ('battle_win',5), ('battle_draw',2), ('battle_loss',1)) v(code, amount);

create or replace function private.xp_level(p_total bigint)
returns jsonb language sql immutable set search_path = '' as $$
  with l as (select floor((1 + sqrt(1 + greatest(p_total,0)::numeric / 12.5)) / 2)::bigint as n)
  select jsonb_build_object('level', n, 'current_level_xp', 50*n*(n-1),
    'next_level_xp', 50*n*(n+1), 'xp_into_level', greatest(p_total,0)-50*n*(n-1), 'xp_to_advance',100*n) from l
$$;

create or replace function private.grant_xp_badge(p_user uuid, p_code text)
returns void language sql set search_path = '' as $$
  insert into private.xp_badges(user_id,code) values(p_user,p_code) on conflict do nothing
$$;

create or replace function private.award_points(
  p_user_id uuid, p_rule_code text, p_source_type text, p_source_id uuid, p_event_key text,
  p_requested integer default null, p_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule private.point_rules;
  v_date date := private.lagos_date(p_at);
  v_requested integer;
  v_amount integer;
  v_id uuid;
begin
  if exists (select 1 from public.points_ledger l where l.user_id = p_user_id and l.event_key = p_event_key) then
    return 0;
  end if;

  select * into v_rule from private.point_rules r
  where r.code = p_rule_code and r.effective_from <= p_at and (r.effective_until is null or r.effective_until > p_at)
  order by r.version desc limit 1;
  if not found then
    raise exception 'no active point rule for %', p_rule_code;
  end if;

  v_requested := greatest(coalesce(p_requested, v_rule.amount), 0);
  v_amount := v_requested;


  insert into public.points_ledger (user_id, source_type, source_id, event_key, rule_id, requested_amount, amount,
                                    cap_applied, local_date, reason)
  values (p_user_id, p_source_type, p_source_id, p_event_key, v_rule.id, v_requested, v_amount,
          false, v_date,
          case when p_source_type='battle' and v_amount=0 and exists(select 1 from private.battle_xp_counts where user_id=p_user_id and local_date=v_date and completed>10)
                 then 'Daily battle XP limit reached.'
               when p_source_type='battle' and v_amount=0 and exists(select 1 from private.battle_opponent_counts where user_id=p_user_id and local_date=v_date and completed>2
                 and opponent_id in (select user_id from public.battle_participants where battle_id=p_source_id and user_id<>p_user_id))
                 then 'Opponent battle XP limit reached.'
               when p_source_type='battle' then 'Correct answers plus match result bonus.'
               when p_source_type='review' and v_amount>0 then 'Scheduled review completed at 80% or higher.'
               when p_source_type='review' then 'Review threshold not met or this stage was already rewarded.'
               when v_amount=0 then 'Best score unchanged. Improve your best score to earn more XP.'
               else 'Initial achievement or personal-best improvement.' end)
  on conflict (user_id, event_key) do nothing
  returning id into v_id;

  if v_id is null then
    return 0;
  end if;


  if v_amount <> 0 then
    insert into public.user_points (user_id, total) values (p_user_id, v_amount)
    on conflict (user_id) do update set total = public.user_points.total + excluded.total, updated_at = now();
  end if;
  return v_amount;
end;
$$;

create or replace function private.award_mastery_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.assessment_attempts;
  content public.assessments;
  v_type text; v_id uuid; v_max integer; v_target integer; v_old integer; v_delta integer;
  v_rule text; v_mastered timestamptz; v_inserted integer;
begin
  select * into a from public.assessment_attempts where id = p_attempt_id;
  if a.status <> 'submitted' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || a.user_id::text, 0));
  if exists (select 1 from public.points_ledger where user_id = a.user_id and event_key = 'mastery:' || a.id::text) then return; end if;
  select * into content from public.assessments where id = a.assessment_id;
  if content.kind = 'review' and content.lesson_id is not null and a.xp_review_stage is not null then
    select mastered_at into v_mastered from private.topic_mastery where user_id = a.user_id and lesson_id = content.lesson_id;
    if v_mastered is null or now() < v_mastered + make_interval(days => (array[1,7,30])[a.xp_review_stage])
       or (a.xp_review_stage > 1 and not exists (select 1 from private.review_awards
           where user_id = a.user_id and lesson_id = content.lesson_id and stage = a.xp_review_stage-1)) then
      perform private.raise_error('VALIDATION_FAILED', 'This review is not due yet.');
    end if;
    v_delta := 0;
    if a.correct_count * 5 >= a.total_count * 4 then
      insert into private.review_awards(user_id,lesson_id,stage,attempt_id)
        values(a.user_id,content.lesson_id,a.xp_review_stage,a.id) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_delta := 10; end if;
      if (select count(*) from private.review_awards where user_id=a.user_id and lesson_id=content.lesson_id)=3 then
        perform private.grant_xp_badge(a.user_id,'long_term_recall');
      end if;
    end if;
    perform private.award_points(a.user_id,'review_correct','review',a.id,'mastery:' || a.id::text,v_delta);
    return;
  end if;
  if content.kind = 'review' then
    if content.lesson_id is null then return; end if;
    v_type := 'lesson'; v_id := content.lesson_id; v_max := 20; v_rule := 'lesson_complete';
    perform private.grant_xp_badge(a.user_id,'first_steps');
    if a.correct_count * 5 >= a.total_count * 4 then
      insert into private.topic_mastery(user_id,lesson_id) values(a.user_id,content.lesson_id) on conflict do nothing;
      perform private.grant_xp_badge(a.user_id,'topic_mastered');
    end if;
  elsif content.kind = 'practice' then
    v_type := 'practice'; v_id := content.id; v_max := 50; v_rule := 'practice_first';
    if a.correct_count = a.total_count then perform private.grant_xp_badge(a.user_id,'perfect_practice'); end if;
  elsif content.kind = 'mock' then
    v_type := 'mock'; v_id := content.id; v_max := 100; v_rule := 'mock_first';
    if a.correct_count * 5 >= a.total_count * 4 then perform private.grant_xp_badge(a.user_id,'exam_ready'); end if;
  else return;
  end if;
  insert into private.xp_bests(user_id,activity_type,activity_id) values(a.user_id,v_type,v_id) on conflict do nothing;
  select earned into v_old from private.xp_bests where user_id=a.user_id and activity_type=v_type and activity_id=v_id for update;
  v_target := floor(v_max::numeric * coalesce(a.correct_count,0) / a.total_count)::integer;
  v_delta := greatest(v_target-v_old,0);
  perform private.award_points(a.user_id,v_rule,v_type,a.id,'mastery:' || a.id::text,v_delta);
  update private.xp_bests set earned=greatest(earned,v_target) where user_id=a.user_id and activity_type=v_type and activity_id=v_id;
end $$;

create or replace function private.award_mastery_battle(p_user uuid,p_battle uuid,p_rule text,p_requested integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_day date := private.lagos_date(); v_other uuid; v_count integer; v_pair integer; v_award integer;
begin
  -- Same user lock for every XP source; finalizers acquire both users in sorted order.
  perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || p_user::text,0));
  if exists(select 1 from public.points_ledger where user_id=p_user and event_key='battle:' || p_battle::text) then return 0; end if;
  if not exists(select 1 from public.battles where id=p_battle and state='finished' and result_kind in ('win','draw')) then return 0; end if;
  select user_id into v_other from public.battle_participants where battle_id=p_battle and user_id<>p_user;
  if v_other is null then return 0; end if;
  insert into private.battle_xp_counts(user_id,local_date,completed) values(p_user,v_day,1)
    on conflict(user_id,local_date) do update set completed=private.battle_xp_counts.completed+1 returning completed into v_count;
  insert into private.battle_opponent_counts(user_id,opponent_id,local_date,completed) values(p_user,v_other,v_day,1)
    on conflict(user_id,opponent_id,local_date) do update set completed=private.battle_opponent_counts.completed+1 returning completed into v_pair;
  v_award := case when v_count<=10 and v_pair<=2 then p_requested else 0 end;
  return private.award_points(p_user,p_rule,'battle',p_battle,'battle:' || p_battle::text,v_award);
end $$;

create or replace function private.finalize_attempt(p_attempt_id uuid, p_status text default 'submitted')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts;
  v_kind text;
  v_correct integer;
  v_answered integer;
  v_status text;
  r record;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id for update;
  if not found then
    return null;
  end if;
  if v_attempt.status <> 'active' then
    return private.attempt_payload(p_attempt_id);
  end if;

  v_status := case when p_status = 'expired'
                     or (v_attempt.expires_at is not null and v_attempt.expires_at <= now()) then 'expired'
                   else 'submitted' end;

  select a.kind into v_kind from public.assessments a where a.id = v_attempt.assessment_id;

  -- Only answers received before the deadline are eligible (saves after the deadline are rejected).
  update public.attempt_answers ans
     set is_correct = (ans.option_id = k.correct_option_id),
         locked_at = coalesce(ans.locked_at, now())
    from private.question_answer_keys k
   where ans.attempt_id = p_attempt_id and k.question_version_id = ans.question_version_id
     and (v_attempt.expires_at is null or ans.received_at <= v_attempt.expires_at);

  select count(*) filter (where ans.is_correct), count(*)
    into v_correct, v_answered
    from public.attempt_answers ans
   where ans.attempt_id = p_attempt_id
     and (v_attempt.expires_at is null or ans.received_at <= v_attempt.expires_at);

  update public.assessment_attempts
     set status = v_status, finalized_at = now(), correct_count = v_correct, answered_count = v_answered,
         revision = revision + 1
   where id = p_attempt_id;

  if v_answered > 0 then
    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (v_attempt.user_id, 'assessment_completed', p_attempt_id, private.lagos_date())
    on conflict do nothing;


  end if;

  perform private.award_mastery_attempt(p_attempt_id);

  perform private.enqueue_event('user:' || v_attempt.user_id::text, 'attempt_finalized',
    jsonb_build_object('attempt_id', p_attempt_id, 'status', v_status, 'revision', v_attempt.revision + 1),
    'attempt_finalized:' || p_attempt_id::text);

  return private.attempt_payload(p_attempt_id);
end;
$$;

create or replace function public.complete_lesson_v1(p_lesson_version_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_version public.lesson_versions;
  v_course uuid;
  v_progress public.lesson_progress;
  v_awarded integer := 0;
  v_already boolean := false;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into v_version from public.lesson_versions where id = p_lesson_version_id;
  if not found or v_version.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  select course_id into v_course from public.lessons where id = v_version.lesson_id;
  perform private.require_course_enrollment(v_uid, v_course);

  insert into public.lesson_progress (user_id, lesson_id, last_version_id, state)
  values (v_uid, v_version.lesson_id, v_version.id, 'started')
  on conflict (user_id, lesson_id) do nothing;
  select * into v_progress from public.lesson_progress
  where user_id = v_uid and lesson_id = v_version.lesson_id for update;

  if v_progress.state = 'completed' then
    v_already := true;
  else
    update public.lesson_progress
       set state = 'completed', completed_at = now(), last_version_id = v_version.id, updated_at = now()
     where user_id = v_uid and lesson_id = v_version.lesson_id
    returning * into v_progress;

    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (v_uid, 'lesson_completed', v_version.lesson_id, private.lagos_date())
    on conflict do nothing;

    -- Reading completion records progress; XP requires the knowledge check.
  end if;

  return private.envelope(jsonb_build_object(
    'lesson_id', v_version.lesson_id,
    'state', v_progress.state,
    'completed_at', v_progress.completed_at,
    'already_completed', v_already,
    'xp_awarded', v_awarded,
    'xp_capped', exists (select 1 from public.points_ledger l where l.user_id = v_uid
                         and l.event_key = 'lesson:' || v_version.lesson_id::text and l.cap_applied),
    'xp_total', (select total from public.user_points where user_id = v_uid),
    'streak', private.streak(v_uid)
  ), p_request_key);
end;
$$;

create or replace function private.finalize_battle(p_battle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
  v_rules public.battle_rules;
  v_c1 integer;
  v_c2 integer;
  v_u1 uuid;
  v_u2 uuid;
  v_winner uuid;
  v_kind text;
  r record;
  v_code text;
  v_xp integer;
  v_awarded integer;
begin
  select * into b from public.battles where id = p_battle_id for update;
  if not found then
    return null;
  end if;
  if b.state not in ('countdown', 'active') or b.ends_at is null or b.ends_at > now() then
    return b.state;
  end if;
  select * into v_rules from public.battle_rules where id = b.rules_id;

  -- Serialize XP for both participants before any award to avoid crossed-player deadlocks.
  for r in select user_id from public.battle_participants where battle_id=p_battle_id order by user_id loop
    perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || r.user_id::text,0));
  end loop;

  update public.battle_answers ba
     set is_correct = (ba.option_id = k.correct_option_id)
    from private.question_answer_keys k
   where ba.battle_id = p_battle_id and k.question_version_id = ba.question_version_id;

  update public.battle_participants bp
     set correct_count = (select count(*) from public.battle_answers ba
                          join public.battle_questions bq on bq.battle_id = ba.battle_id and bq.position = ba.position
                          where ba.battle_id = bp.battle_id and ba.user_id = bp.user_id and ba.is_correct
                            and ba.received_at < bq.deadline),
         activity_date = private.lagos_date()
   where bp.battle_id = p_battle_id;

  select user_id, correct_count into v_u1, v_c1 from public.battle_participants where battle_id = p_battle_id and seat = 1;
  select user_id, correct_count into v_u2, v_c2 from public.battle_participants where battle_id = p_battle_id and seat = 2;

  if v_c1 > v_c2 then
    v_winner := v_u1; v_kind := 'win';
  elsif v_c2 > v_c1 then
    v_winner := v_u2; v_kind := 'win';
  else
    v_winner := null; v_kind := 'draw';
  end if;

  update public.battles
     set state = 'finished', result_kind = v_kind, winner_user_id = v_winner, finalized_at = now(), revision = revision + 1
   where id = p_battle_id;

  for r in select bp.user_id, bp.correct_count from public.battle_participants bp where bp.battle_id = p_battle_id order by bp.user_id loop
    if v_winner is null then
      v_code := 'battle_draw'; v_xp := 2 * r.correct_count + 2;
    elsif v_winner = r.user_id then
      v_code := 'battle_win'; v_xp := 2 * r.correct_count + 5;
    else
      v_code := 'battle_loss'; v_xp := 2 * r.correct_count;
    end if;
    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (r.user_id, 'battle_completed', p_battle_id, private.lagos_date())
    on conflict do nothing;
    v_awarded := private.award_mastery_battle(r.user_id, p_battle_id, v_code, v_xp);
    insert into public.notifications (user_id, kind, body, safe_target, event_key)
    values (r.user_id, 'battle_finished',
            case v_code when 'battle_win' then 'You won your battle' when 'battle_draw' then 'Your battle ended in a draw'
                        else 'Your battle is over' end || format(' (+%s XP).', v_awarded),
            '/battles/' || p_battle_id::text, 'battle_finished:' || p_battle_id::text || ':' || r.user_id::text)
    on conflict (event_key) do nothing;
  end loop;

  delete from private.battle_slots where battle_id = p_battle_id;
  delete from private.battle_invites where battle_id = p_battle_id;
  perform private.battle_event(p_battle_id);
  return 'finished';
end;
$$;

create or replace function private.start_attempt_base_v2(
  p_assessment_version_id uuid, p_request_key uuid, p_resume boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_version public.assessment_versions;
  v_assessment public.assessments;
  v_offering uuid;
  v_existing public.assessment_attempts;
  v_attempt_id uuid;
  v_available integer;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_existing from public.assessment_attempts where user_id = v_uid and request_key = p_request_key;
  if found then
    return private.envelope(private.attempt_payload(v_existing.id) || jsonb_build_object('resumed', true), p_request_key);
  end if;

  select * into v_version from public.assessment_versions where id = p_assessment_version_id;
  if not found or v_version.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  select * into v_assessment from public.assessments where id = v_version.assessment_id;
  v_offering := private.require_course_enrollment(v_uid, v_assessment.course_id);

  select * into v_existing from public.assessment_attempts
  where user_id = v_uid and assessment_id = v_assessment.id and status = 'active'
  for update;
  if found then
    if v_existing.expires_at is not null and v_existing.expires_at <= now() then
      perform private.finalize_attempt(v_existing.id, 'expired');
    elsif p_resume then
      return private.envelope(private.attempt_payload(v_existing.id) || jsonb_build_object('resumed', true), p_request_key);
    else
      perform private.raise_error('ATTEMPT_ACTIVE', null, jsonb_build_object('attempt_id', v_existing.id));
    end if;
  end if;

  select count(*) into v_available
  from public.assessment_questions aq
  join public.question_versions qv on qv.id = aq.question_version_id and qv.status = 'published'
  where aq.assessment_version_id = v_version.id;
  if v_available < v_version.question_count then
    perform private.raise_error('CONTENT_UNAVAILABLE', 'This assessment does not have enough published questions.');
  end if;

  begin
    insert into public.assessment_attempts (user_id, offering_id, assessment_id, assessment_version_id, request_key,
                                            started_at, expires_at, scoring_version, feedback_mode, total_count)
    values (v_uid, v_offering, v_assessment.id, v_version.id, p_request_key, now(),
            case when v_version.duration_seconds is null then null
                 else now() + make_interval(secs => v_version.duration_seconds) end,
            v_version.scoring_version, v_version.feedback_mode, v_version.question_count)
    returning id into v_attempt_id;
  exception when unique_violation then
    perform private.raise_error('ATTEMPT_ACTIVE', 'Another attempt was started at the same time.');
  end;

  insert into public.attempt_questions (attempt_id, question_version_id, position, option_order)
  select v_attempt_id, s.qv_id, row_number() over (order by s.rnd)::integer,
         (select array_agg(o.id order by random()) from public.question_options o where o.question_version_id = s.qv_id)
  from (
    select aq.question_version_id as qv_id, random() as rnd
    from public.assessment_questions aq
    join public.question_versions qv on qv.id = aq.question_version_id and qv.status = 'published'
    where aq.assessment_version_id = v_version.id
    order by random()
    limit v_version.question_count
  ) s;

  return private.envelope(private.attempt_payload(v_attempt_id) || jsonb_build_object('resumed', false), p_request_key);
end;
$$;

create or replace function public.start_attempt_v1(p_assessment_version_id uuid,p_request_key uuid,p_resume boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('scholau.start:' || v_user::text,0));
  v_payload := private.start_attempt_base_v2(p_assessment_version_id,p_request_key,p_resume);
  -- Resume an existing scheduled review as itself; never change an attempt's earning category.
  return v_payload;
end $$;

create or replace function public.start_topic_review_v1(p_lesson_id uuid,p_stage integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user(); v_mastered timestamptz; v_version uuid; v_count integer;
  v_attempt uuid; v_payload jsonb; v_existing public.assessment_attempts;
begin
  perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended('scholau.start:' || v_user::text,0));
  select * into v_existing from public.assessment_attempts where user_id=v_user and request_key=p_request_key;
  if found then
    if v_existing.xp_review_stage is distinct from p_stage or not exists(select 1 from public.assessments
      where id=v_existing.assessment_id and lesson_id=p_lesson_id) then perform private.raise_error('VALIDATION_FAILED'); end if;
    return private.envelope(private.attempt_payload(v_existing.id),p_request_key);
  end if;
  if p_stage is null or p_stage not between 1 and 3 then perform private.raise_error('VALIDATION_FAILED'); end if;
  select mastered_at into v_mastered from private.topic_mastery where user_id=v_user and lesson_id=p_lesson_id;
  if v_mastered is null or now()<v_mastered+make_interval(days=>(array[1,7,30])[p_stage])
    or exists(select 1 from private.review_awards where user_id=v_user and lesson_id=p_lesson_id and stage=p_stage)
    or (p_stage>1 and not exists(select 1 from private.review_awards where user_id=v_user and lesson_id=p_lesson_id and stage=p_stage-1)) then
    perform private.raise_error('VALIDATION_FAILED','This review is not available yet.');
  end if;
  select av.id,av.question_count into v_version,v_count from public.assessments a
    join public.assessment_versions av on av.assessment_id=a.id and av.status='published'
    where a.lesson_id=p_lesson_id and a.kind='review' order by a.position,a.id limit 1;
  if v_version is null then perform private.raise_error('CONTENT_UNAVAILABLE','No published topic review is available.'); end if;
  select at.* into v_existing from public.assessment_attempts at join public.assessments a on a.id=at.assessment_id
    where at.user_id=v_user and a.lesson_id=p_lesson_id and at.status='active';
  if found and (v_existing.expires_at is null or v_existing.expires_at>now()) then
    if v_existing.xp_review_stage=p_stage then return private.envelope(private.attempt_payload(v_existing.id),p_request_key); end if;
    perform private.raise_error('ATTEMPT_ACTIVE','Finish your current topic check before starting a review.',jsonb_build_object('attempt_id',v_existing.id));
  end if;
  v_payload := private.start_attempt_base_v2(v_version,p_request_key,false);
  v_attempt := (v_payload->>'attempt_id')::uuid;
  update public.assessment_attempts set xp_review_stage=p_stage where id=v_attempt;
  -- Prefer logical questions not seen in this topic. Reuse is allowed if the pool is small.
  delete from public.attempt_questions where attempt_id=v_attempt;
  insert into public.attempt_questions(attempt_id,question_version_id,position,option_order)
  select v_attempt,s.id,row_number() over(order by s.seen,s.rnd)::integer,
    (select array_agg(o.id order by random()) from public.question_options o where o.question_version_id=s.id)
  from (
    select qv.id,random() rnd, exists(select 1 from public.attempt_questions aq
      join public.question_versions oldq on oldq.id=aq.question_version_id
      join public.assessment_attempts at on at.id=aq.attempt_id
      join public.assessments olda on olda.id=at.assessment_id
      where at.user_id=v_user and olda.lesson_id=p_lesson_id and oldq.question_id=qv.question_id) seen
    from public.assessment_questions pool join public.question_versions qv on qv.id=pool.question_version_id and qv.status='published'
    where pool.assessment_version_id=v_version order by seen,rnd limit v_count
  ) s;
  return private.envelope(private.attempt_payload(v_attempt),p_request_key);
end $$;

create or replace function private.attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with a as (
    select at.*, asm.kind, asm.title, asm.course_id, asm.lesson_id
    from public.assessment_attempts at
    join public.assessments asm on asm.id = at.assessment_id
    where at.id = p_attempt_id
  ), q as (
    select aq.position, aq.question_version_id, qv.prompt, qv.difficulty, aq.option_order,
           ans.option_id as saved_option_id, ans.answer_revision, ans.locked_at, ans.is_correct,
           k.correct_option_id, k.explanation,
           (a.status in ('submitted', 'expired') or (a.feedback_mode = 'immediate' and ans.locked_at is not null)) as reveal
    from a
    join public.attempt_questions aq on aq.attempt_id = a.id
    join public.question_versions qv on qv.id = aq.question_version_id
    left join public.attempt_answers ans on ans.attempt_id = a.id and ans.question_version_id = aq.question_version_id
    left join private.question_answer_keys k on k.question_version_id = aq.question_version_id
  )
  select jsonb_build_object(
    'attempt_id', a.id,
    'assessment_id', a.assessment_id,
    'assessment_version_id', a.assessment_version_id,
    'offering_id', a.offering_id,
    'kind', a.kind,
    'lesson_id', a.lesson_id,
    'xp_review_stage', a.xp_review_stage,
    'title', a.title,
    'status', a.status,
    'feedback_mode', a.feedback_mode,
    'started_at', a.started_at,
    'expires_at', a.expires_at,
    'finalized_at', a.finalized_at,
    'revision', a.revision,
    'total_count', a.total_count,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', q.position,
        'question_version_id', q.question_version_id,
        'prompt', q.prompt,
        'difficulty', q.difficulty,
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by ord.n)
                    from unnest(q.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id),
        'saved', case when q.saved_option_id is null then null else jsonb_build_object(
                   'option_id', q.saved_option_id, 'answer_revision', q.answer_revision,
                   'locked', q.locked_at is not null) end,
        'feedback', case when q.reveal then jsonb_build_object(
                   'is_correct', coalesce(q.saved_option_id = q.correct_option_id, false),
                   'correct_option_id', q.correct_option_id,
                   'explanation', q.explanation) else null end
      ) order by q.position) from q), '[]'::jsonb),
    'result', case when a.status in ('submitted', 'expired', 'voided') then jsonb_build_object(
      'correct_count', a.correct_count,
      'answered_count', a.answered_count,
      'total_count', a.total_count,
      'percent', case when a.total_count > 0 then round(100.0 * coalesce(a.correct_count, 0) / a.total_count, 1) else 0 end,
      'xp_awarded', coalesce((select sum(l.amount) from public.points_ledger l
                              where l.user_id = a.user_id and l.source_id = a.id), 0),
      'xp_capped', exists (select 1 from public.points_ledger l
                           where l.user_id = a.user_id and l.source_id = a.id and l.cap_applied),
      'xp_review_stage', a.xp_review_stage,
      'xp_progress', private.xp_level(coalesce((select total from public.user_points where user_id=a.user_id),0)),
      'voided_reason', a.voided_reason) else null end
  )
  from a
$$;

create or replace function public.get_xp_progress_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_total bigint;
begin
  select coalesce(total,0) into v_total from public.user_points where user_id=v_user;
  return private.envelope(jsonb_build_object('xp_total',coalesce(v_total,0),'progress',private.xp_level(coalesce(v_total,0)),
    'badges',coalesce((select jsonb_agg(jsonb_build_object('code',code,'awarded_at',awarded_at) order by awarded_at,code)
      from private.xp_badges where user_id=v_user),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'activity',h.source_type,'amount',h.amount,
      'reason',coalesce(h.reason,case when h.amount=0 then 'No additional XP: best score unchanged, review threshold not met, or battle limit reached.'
        else 'Learning achievement or completed battle' end),'date',h.created_at) order by h.created_at desc,h.id)
      from (select * from public.points_ledger where user_id=v_user order by created_at desc,id limit 50) h),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(jsonb_build_object('lesson_id',m.lesson_id,'title',lv.title,'stage',s.stage,
      'due_at',m.mastered_at+make_interval(days=>s.days),
      'completed',exists(select 1 from private.review_awards r where r.user_id=v_user and r.lesson_id=m.lesson_id and r.stage=s.stage),
      'available',now()>=m.mastered_at+make_interval(days=>s.days)
        and not exists(select 1 from private.review_awards r where r.user_id=v_user and r.lesson_id=m.lesson_id and r.stage=s.stage)
        and (s.stage=1 or exists(select 1 from private.review_awards r where r.user_id=v_user and r.lesson_id=m.lesson_id and r.stage=s.stage-1))
        and exists(select 1 from public.assessments a join public.assessment_versions av on av.assessment_id=a.id and av.status='published'
          where a.lesson_id=m.lesson_id and a.kind='review' and (select count(*) from public.assessment_questions aq
            join public.question_versions qv on qv.id=aq.question_version_id and qv.status='published'
            where aq.assessment_version_id=av.id)>=av.question_count)
        and exists(select 1 from public.lessons l join public.course_offerings o on o.course_id=l.course_id and o.status='published'
          join public.enrollments e on e.offering_id=o.id and e.user_id=v_user and e.ended_at is null where l.id=m.lesson_id)
      ) order by m.mastered_at,s.stage)
      from private.topic_mastery m join public.lesson_versions lv on lv.lesson_id=m.lesson_id and lv.status='published'
      cross join (values(1,1),(2,7),(3,30)) s(stage,days) where m.user_id=v_user),'[]'::jsonb)));
end $$;

-- Rankings are outside the XP v2 release, including direct RPC callers.
do $$ declare r record; begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_leaderboard_v1' loop
    execute format('revoke execute on function %s from authenticated, anon, public',r.signature);
  end loop;
end $$;
revoke all on function public.get_xp_progress_v1(), public.start_topic_review_v1(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.get_xp_progress_v1(), public.start_topic_review_v1(uuid,integer,uuid) to authenticated;
revoke all on function private.start_attempt_base_v2(uuid,uuid,boolean), private.award_mastery_attempt(uuid),
  private.award_mastery_battle(uuid,uuid,text,integer),private.grant_xp_badge(uuid,text),private.xp_level(bigint)
  from public, anon, authenticated;

create or replace function public.get_home_summary_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_continue jsonb;
  v_cap integer;
begin
  select * into v_profile from public.profiles where id = v_uid;

  -- Last unfinished lesson in an actively enrolled course, else first uncompleted lesson.
  select jsonb_build_object('kind', 'resume', 'lesson_id', l.id, 'lesson_version_id', lv.id, 'title', lv.title,
                            'estimated_minutes', lv.estimated_minutes, 'course_id', l.course_id, 'course_title', c.title,
                            'offering_id', e.offering_id)
    into v_continue
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
    join public.courses c on c.id = l.course_id
    join public.course_offerings o on o.course_id = l.course_id and o.status = 'published'
    join public.enrollments e on e.offering_id = o.id and e.user_id = v_uid and e.ended_at is null
   where lp.user_id = v_uid and lp.state = 'started'
   order by lp.updated_at desc
   limit 1;

  if v_continue is null then
    select jsonb_build_object('kind', 'next', 'lesson_id', l.id, 'lesson_version_id', lv.id, 'title', lv.title,
                              'estimated_minutes', lv.estimated_minutes, 'course_id', l.course_id, 'course_title', c.title,
                              'offering_id', e.offering_id)
      into v_continue
      from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id and o.status = 'published'
      join public.courses c on c.id = o.course_id
      join public.lessons l on l.course_id = o.course_id
      join public.modules m on m.id = l.module_id
      join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
     where e.user_id = v_uid and e.ended_at is null
       and not exists (select 1 from public.lesson_progress lp
                       where lp.user_id = v_uid and lp.lesson_id = l.id and lp.state = 'completed')
     order by e.enrolled_at desc, m.position, l.position
     limit 1;
  end if;

  select r.daily_cap into v_cap from private.point_rules r
  where r.code = 'lesson_complete' and r.effective_from <= now() and (r.effective_until is null or r.effective_until > now())
  order by r.version desc limit 1;

  return private.envelope(jsonb_build_object(
    'display_name', v_profile.display_name,
    'needs_onboarding', v_profile.university_id is null,
    'xp_total', coalesce((select total from public.user_points where user_id = v_uid), 0),
    'learning_xp_today', coalesce((select sum(amount) from public.points_ledger where user_id=v_uid and local_date=private.lagos_date() and source_type in ('lesson','review','practice','mock')),0),
    'learning_xp_daily_cap', v_cap,
    'streak', private.streak(v_uid),
    'premium', private.has_entitlement(v_uid),
    'continue_learning', v_continue,
    'enrolled_courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'offering_id', o.id, 'course_id', c.id, 'code', c.code, 'title', c.title,
        'lessons_total', (select count(*) from public.lessons l where l.course_id = c.id
                          and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')),
        'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
                              where lp.user_id = v_uid and l.course_id = c.id and lp.state = 'completed')
      ) order by e.enrolled_at desc)
      from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id and o.status = 'published'
      join public.courses c on c.id = o.course_id
      where e.user_id = v_uid and e.ended_at is null), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(x.item order by x.created_at desc) from (
        select jsonb_build_object('kind', a.kind, 'source_id', a.source_id, 'local_date', a.local_date, 'created_at', a.created_at,
                                  'xp', coalesce((select sum(l.amount) from public.points_ledger l
                                                  where l.user_id = v_uid and l.source_id = a.source_id), 0)) as item,
               a.created_at
        from public.activity_events a where a.user_id = v_uid
        order by a.created_at desc limit 10) x), '[]'::jsonb),
    'live_battle', (select jsonb_build_object('battle_id', s.battle_id, 'queue_id', s.queue_id, 'expires_at', s.expires_at)
                    from private.battle_slots s where s.user_id = v_uid),
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null)
  ));
end;
$$;
