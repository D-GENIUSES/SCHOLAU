-- ScholAu migration 6b: profile, onboarding, catalog, lessons, assessments and home RPCs.
-- See 20261012000600_rpc_foundation.sql for the error convention and lock order.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Active enrollment of the user in a published offering of the course; raises NOT_ENROLLED.
create or replace function private.require_course_enrollment(p_user_id uuid, p_course_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offering uuid;
begin
  select e.offering_id into v_offering
  from public.enrollments e
  join public.course_offerings o on o.id = e.offering_id
  where e.user_id = p_user_id and e.ended_at is null and o.course_id = p_course_id and o.status = 'published'
  order by e.enrolled_at desc
  limit 1;
  if v_offering is null then
    perform private.raise_error('NOT_ENROLLED');
  end if;
  return v_offering;
end;
$$;

create or replace function private.require_offering_enrollment(p_user_id uuid, p_offering_id uuid)
returns public.course_offerings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offering public.course_offerings;
begin
  select o.* into v_offering from public.course_offerings o where o.id = p_offering_id;
  if not found or v_offering.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  if not exists (select 1 from public.enrollments e
                 where e.user_id = p_user_id and e.offering_id = p_offering_id and e.ended_at is null) then
    perform private.raise_error('NOT_ENROLLED');
  end if;
  return v_offering;
end;
$$;

create or replace function private.academic_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'university_id', p.university_id, 'faculty_id', p.faculty_id, 'department_id', p.department_id,
    'level_id', p.level_id, 'academic_period_id', p.academic_period_id, 'semester_id', p.semester_id)
  from public.profiles p where p.id = p_user_id
$$;

create or replace function private.profile_payload(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'leaderboard_visible', p.leaderboard_visible,
    'needs_onboarding', p.university_id is null,
    'academic', case when p.university_id is null then null else jsonb_build_object(
      'university', jsonb_build_object('id', u.id, 'name', u.name),
      'faculty', jsonb_build_object('id', f.id, 'name', f.name),
      'department', jsonb_build_object('id', d.id, 'name', d.name),
      'level', jsonb_build_object('id', l.id, 'label', l.label),
      'academic_period', jsonb_build_object('id', ap.id, 'label', ap.label),
      'semester', jsonb_build_object('id', s.id, 'label', s.label),
      'changed_at', p.academic_changed_at,
      'self_change_used_this_period', exists (
        select 1 from public.academic_profile_changes c
        where c.user_id = p.id and c.academic_period_id = p.academic_period_id and c.kind = 'self_change'))
    end,
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id), '[]'::jsonb),
    'premium', private.has_entitlement(p.id),
    'xp_total', coalesce((select up.total from public.user_points up where up.user_id = p.id), 0),
    'streak', private.streak(p.id),
    'learning_totals', jsonb_build_object(
      'lessons_completed', (select count(*) from public.lesson_progress lp where lp.user_id = p.id and lp.state = 'completed'),
      'assessments_completed', (select count(*) from public.assessment_attempts a
                                where a.user_id = p.id and a.status in ('submitted', 'expired')),
      'battles_completed', (select count(*) from public.battle_participants bp join public.battles b on b.id = bp.battle_id
                            where bp.user_id = p.id and b.state = 'finished')),
    'created_at', p.created_at
  )
  from public.profiles p
  left join public.universities u on u.id = p.university_id
  left join public.faculties f on f.id = p.faculty_id
  left join public.departments d on d.id = p.department_id
  left join public.levels l on l.id = p.level_id
  left join public.academic_periods ap on ap.id = p.academic_period_id
  left join public.semesters s on s.id = p.semester_id
  where p.id = p_user_id
$$;

-- Validates and applies an academic tuple. Caller has authorized the actor. Lock: profiles row.
create or replace function private.apply_academic_profile(
  p_user_id uuid, p_actor_id uuid, p_university_id uuid, p_faculty_id uuid, p_department_id uuid,
  p_level_id uuid, p_academic_period_id uuid, p_semester_id uuid, p_kind text, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_errors jsonb := '{}'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_kind text := p_kind;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Profile not found.');
  end if;

  if p_request_key is not null and exists (
      select 1 from public.academic_profile_changes c where c.actor_id = p_actor_id and c.request_key = p_request_key) then
    return private.profile_payload(p_user_id);
  end if;

  if not exists (select 1 from public.universities where id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('university_id', 'invalid');
  end if;
  if not exists (select 1 from public.faculties where id = p_faculty_id and university_id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('faculty_id', 'invalid');
  end if;
  if not exists (select 1 from public.departments where id = p_department_id and faculty_id = p_faculty_id
                 and university_id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('department_id', 'invalid');
  end if;
  if not exists (select 1 from public.levels where id = p_level_id and university_id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('level_id', 'invalid');
  end if;
  if not exists (select 1 from public.academic_periods where id = p_academic_period_id
                 and university_id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('academic_period_id', 'invalid');
  end if;
  if not exists (select 1 from public.semesters where id = p_semester_id and academic_period_id = p_academic_period_id
                 and university_id = p_university_id and active) then
    v_errors := v_errors || jsonb_build_object('semester_id', 'invalid');
  end if;
  if v_errors <> '{}'::jsonb then
    perform private.raise_error('INVALID_PROFILE', 'That combination of academic selections is not valid.', v_errors);
  end if;

  v_before := private.academic_snapshot(p_user_id);
  v_after := jsonb_build_object(
    'university_id', p_university_id, 'faculty_id', p_faculty_id, 'department_id', p_department_id,
    'level_id', p_level_id, 'academic_period_id', p_academic_period_id, 'semester_id', p_semester_id);

  if v_profile.university_id is null then
    v_kind := case when p_kind = 'admin_correction' then 'admin_correction' else 'initial' end;
    if v_kind = 'initial' then
      v_before := null;
    end if;
  elsif v_before = v_after then
    return private.profile_payload(p_user_id);
  elsif p_kind = 'self_change' and exists (
      select 1 from public.academic_profile_changes c
      where c.user_id = p_user_id and c.academic_period_id = p_academic_period_id and c.kind = 'self_change') then
    perform private.raise_error('FORBIDDEN',
      'You can change your academic profile once per academic period. Ask support for a correction.',
      jsonb_build_object('academic_period_id', 'change_limit_reached'));
  end if;

  update public.profiles
     set university_id = p_university_id, faculty_id = p_faculty_id, department_id = p_department_id,
         level_id = p_level_id, academic_period_id = p_academic_period_id, semester_id = p_semester_id,
         academic_changed_at = now()
   where id = p_user_id;

  insert into public.academic_profile_changes (user_id, academic_period_id, before_profile, after_profile, kind,
                                               actor_id, reason, request_key)
  values (p_user_id, p_academic_period_id, v_before, v_after, v_kind, p_actor_id, p_reason, p_request_key);

  -- PR-03: a profile change never grants continued access to offerings outside the new scope.
  update public.enrollments e
     set ended_at = now()
    from public.course_offerings o
   where e.offering_id = o.id and e.user_id = p_user_id and e.ended_at is null
     and (o.department_id, o.level_id, o.semester_id) is distinct from (p_department_id, p_level_id, p_semester_id);

  return private.profile_payload(p_user_id);
end;
$$;

-- Safe question payload for an attempt (never includes keys unless feedback is permitted).
create or replace function private.attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with a as (
    select at.*, asm.kind, asm.title, asm.course_id
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
      'voided_reason', a.voided_reason) else null end
  )
  from a
$$;

-- Grades an attempt and writes result, activity, rewards and outbox atomically (TR-01). Internal only.
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

    if v_kind = 'review' then
      -- +2 per question answered correctly for the first time in review (keyed by logical question).
      for r in
        select qv.question_id
        from public.attempt_answers ans
        join public.question_versions qv on qv.id = ans.question_version_id
        where ans.attempt_id = p_attempt_id and ans.is_correct
        order by qv.question_id
      loop
        perform private.award_points(v_attempt.user_id, 'review_correct', 'review', p_attempt_id,
                                     'review_correct:' || r.question_id::text);
      end loop;
    elsif v_kind = 'practice' then
      perform private.award_points(v_attempt.user_id, 'practice_first', 'practice', p_attempt_id,
                                   'practice_first:' || v_attempt.assessment_id::text);
    elsif v_kind = 'mock' then
      perform private.award_points(v_attempt.user_id, 'mock_first', 'mock', p_attempt_id,
                                   'mock_first:' || v_attempt.assessment_id::text);
    end if;
  end if;

  perform private.enqueue_event('user:' || v_attempt.user_id::text, 'attempt_finalized',
    jsonb_build_object('attempt_id', p_attempt_id, 'status', v_status, 'revision', v_attempt.revision + 1),
    'attempt_finalized:' || p_attempt_id::text);

  return private.attempt_payload(p_attempt_id);
end;
$$;

-- Applies a batch of answers to an active attempt. Caller holds the attempt row lock.
-- p_strict: raise STALE_REVISION on stale/locked items; otherwise skip them.
create or replace function private.apply_attempt_answers(p_attempt public.assessment_attempts, p_answers jsonb, p_strict boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_qv uuid;
  v_opt uuid;
  v_rev integer;
  v_existing public.attempt_answers;
  v_order uuid[];
  v_field_errors jsonb := '{}'::jsonb;
  v_stale jsonb := '{}'::jsonb;
  v_saved jsonb := '[]'::jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'answers must be an array.', jsonb_build_object('answers', 'invalid'));
  end if;
  if jsonb_array_length(p_answers) > 200 then
    perform private.raise_error('VALIDATION_FAILED', 'Too many answers in one request.', jsonb_build_object('answers', 'too_many'));
  end if;

  for v_item in select value from jsonb_array_elements(p_answers) loop
    begin
      v_qv := (v_item ->> 'question_version_id')::uuid;
      v_opt := (v_item ->> 'option_id')::uuid;
      v_rev := (v_item ->> 'answer_revision')::integer;
    exception when others then
      perform private.raise_error('VALIDATION_FAILED', 'Malformed answer.', jsonb_build_object('answers', 'malformed'));
    end;
    if v_qv is null or v_opt is null or v_rev is null or v_rev < 1 then
      perform private.raise_error('VALIDATION_FAILED', 'Malformed answer.', jsonb_build_object('answers', 'malformed'));
    end if;

    select aq.option_order into v_order from public.attempt_questions aq
    where aq.attempt_id = p_attempt.id and aq.question_version_id = v_qv;
    if v_order is null then
      v_field_errors := v_field_errors || jsonb_build_object(v_qv::text, 'question_not_in_attempt');
      continue;
    end if;
    if not (v_opt = any (v_order)) then
      v_field_errors := v_field_errors || jsonb_build_object(v_qv::text, 'option_not_in_question');
      continue;
    end if;

    select * into v_existing from public.attempt_answers
    where attempt_id = p_attempt.id and question_version_id = v_qv;
    if found then
      if v_existing.locked_at is not null then
        if v_existing.option_id <> v_opt then
          v_stale := v_stale || jsonb_build_object(v_qv::text, jsonb_build_object('reason', 'locked', 'answer_revision', v_existing.answer_revision));
        end if;
        continue;
      end if;
      if v_rev < v_existing.answer_revision or (v_rev = v_existing.answer_revision and v_opt <> v_existing.option_id) then
        v_stale := v_stale || jsonb_build_object(v_qv::text, jsonb_build_object('reason', 'stale', 'answer_revision', v_existing.answer_revision));
        continue;
      end if;
      if v_rev = v_existing.answer_revision then
        v_saved := v_saved || jsonb_build_object('question_version_id', v_qv, 'answer_revision', v_rev);
        continue;
      end if;
      update public.attempt_answers set option_id = v_opt, answer_revision = v_rev, received_at = now()
      where attempt_id = p_attempt.id and question_version_id = v_qv;
    else
      insert into public.attempt_answers (attempt_id, question_version_id, option_id, answer_revision, received_at)
      values (p_attempt.id, v_qv, v_opt, v_rev, now());
    end if;
    v_saved := v_saved || jsonb_build_object('question_version_id', v_qv, 'answer_revision', v_rev);
  end loop;

  if v_field_errors <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Some answers do not belong to this attempt.', v_field_errors);
  end if;
  if p_strict and v_stale <> '{}'::jsonb then
    perform private.raise_error('STALE_REVISION', 'Some answers were changed elsewhere or are locked.', v_stale);
  end if;
  return v_saved;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile & onboarding
-- ---------------------------------------------------------------------------
create or replace function public.get_my_profile_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  return private.envelope(private.profile_payload(v_uid));
end;
$$;

create or replace function public.update_profile_v1(
  p_display_name text default null,
  p_avatar_path text default null,
  p_clear_avatar boolean default false,
  p_leaderboard_visible boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_name text := btrim(p_display_name);
  v_errors jsonb := '{}'::jsonb;
begin
  perform private.assert_client_supported();
  if p_display_name is not null and (length(v_name) < 2 or length(v_name) > 60) then
    v_errors := v_errors || jsonb_build_object('display_name', 'must be 2-60 characters');
  end if;
  if p_display_name is not null and v_name ~ '[<>]' then
    v_errors := v_errors || jsonb_build_object('display_name', 'contains unsupported characters');
  end if;
  if p_avatar_path is not null and (p_avatar_path !~ '^[A-Za-z0-9/_.-]{1,300}$' or p_avatar_path like '%..%') then
    v_errors := v_errors || jsonb_build_object('avatar_path', 'invalid storage path');
  end if;
  if v_errors <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', null, v_errors);
  end if;

  update public.profiles
     set display_name = coalesce(v_name, display_name),
         avatar_path = case when p_clear_avatar then null else coalesce(p_avatar_path, avatar_path) end,
         leaderboard_visible = coalesce(p_leaderboard_visible, leaderboard_visible)
   where id = v_uid;

  return private.envelope(private.profile_payload(v_uid));
end;
$$;

-- Cascading option lists for onboarding. Pass the parent ids selected so far.
create or replace function public.get_onboarding_options_v1(
  p_university_id uuid default null,
  p_faculty_id uuid default null,
  p_academic_period_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  return private.envelope(jsonb_build_object(
    'universities', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'slug', u.slug) order by u.name)
                              from public.universities u where u.active), '[]'::jsonb),
    'faculties', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.name)
                           from public.faculties f where f.university_id = p_university_id and f.active), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name)
                             from public.departments d
                             where d.faculty_id = p_faculty_id and d.university_id = p_university_id and d.active), '[]'::jsonb),
    'levels', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label) order by l.sort_order)
                        from public.levels l where l.university_id = p_university_id and l.active), '[]'::jsonb),
    'academic_periods', coalesce((select jsonb_agg(jsonb_build_object('id', ap.id, 'label', ap.label,
                                         'starts_on', ap.starts_on, 'ends_on', ap.ends_on) order by ap.starts_on desc)
                                  from public.academic_periods ap where ap.university_id = p_university_id and ap.active), '[]'::jsonb),
    'semesters', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label) order by s.sort_order)
                           from public.semesters s
                           where s.academic_period_id = p_academic_period_id and s.university_id = p_university_id and s.active), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.set_academic_profile_v1(
  p_university_id uuid, p_faculty_id uuid, p_department_id uuid, p_level_id uuid,
  p_academic_period_id uuid, p_semester_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  return private.envelope(private.apply_academic_profile(
    v_uid, v_uid, p_university_id, p_faculty_id, p_department_id, p_level_id,
    p_academic_period_id, p_semester_id, 'self_change', null, p_request_key), p_request_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog & enrollment
-- ---------------------------------------------------------------------------
create or replace function public.get_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.university_id is null then
    return private.envelope(jsonb_build_object('needs_onboarding', true, 'offerings', '[]'::jsonb));
  end if;
  return private.envelope(jsonb_build_object(
    'needs_onboarding', false,
    'offerings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'offering_id', o.id,
        'course', jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title, 'description', c.description),
        'enrolled', exists (select 1 from public.enrollments e where e.user_id = v_uid and e.offering_id = o.id and e.ended_at is null),
        'lesson_count', (select count(*) from public.lessons l
                         where l.course_id = c.id
                           and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')),
        'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
                              where lp.user_id = v_uid and l.course_id = c.id and lp.state = 'completed')
      ) order by c.code)
      from public.course_offerings o
      join public.courses c on c.id = o.course_id
      where o.status = 'published' and c.active
        and o.university_id = v_profile.university_id and o.department_id = v_profile.department_id
        and o.level_id = v_profile.level_id and o.semester_id = v_profile.semester_id
    ), '[]'::jsonb)
  ));
end;
$$;

create or replace function public.enroll_course_v1(p_offering_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_offering public.course_offerings;
  v_enrollment public.enrollments;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.university_id is null then
    perform private.raise_error('INVALID_PROFILE', 'Complete your academic profile first.');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id;
  if not found or v_offering.status <> 'published'
     or not exists (select 1 from public.courses c where c.id = v_offering.course_id and c.active) then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  if (v_offering.university_id, v_offering.department_id, v_offering.level_id, v_offering.semester_id)
     is distinct from (v_profile.university_id, v_profile.department_id, v_profile.level_id, v_profile.semester_id) then
    perform private.raise_error('FORBIDDEN', 'This course is not offered for your academic profile.');
  end if;

  insert into public.enrollments (user_id, offering_id, request_key)
  values (v_uid, p_offering_id, p_request_key)
  on conflict (user_id, offering_id) do update
    set ended_at = null,
        enrolled_at = case when public.enrollments.ended_at is null then public.enrollments.enrolled_at else now() end,
        request_key = case when public.enrollments.ended_at is null then public.enrollments.request_key else excluded.request_key end
  returning * into v_enrollment;

  return private.envelope(jsonb_build_object(
    'offering_id', v_enrollment.offering_id, 'enrolled_at', v_enrollment.enrolled_at, 'active', true), p_request_key);
end;
$$;

create or replace function public.get_course_overview_v1(p_offering_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_total integer;
  v_done integer;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  select * into v_course from public.courses where id = v_offering.course_id;

  select count(*), count(*) filter (where lp.state = 'completed')
    into v_total, v_done
    from public.lessons l
    left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
   where l.course_id = v_course.id
     and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published');

  return private.envelope(jsonb_build_object(
    'offering_id', v_offering.id,
    'course', jsonb_build_object('id', v_course.id, 'code', v_course.code, 'title', v_course.title, 'description', v_course.description),
    'progress', jsonb_build_object('lessons_total', v_total, 'lessons_completed', v_done,
                                   'percent', case when v_total > 0 then round(100.0 * v_done / v_total) else 0 end),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'position', m.position,
        'lessons', coalesce((
          select jsonb_agg(jsonb_build_object(
            'lesson_id', l.id, 'lesson_version_id', lv.id, 'position', l.position, 'title', lv.title,
            'objective', lv.objective, 'estimated_minutes', lv.estimated_minutes,
            'state', coalesce(lp.state, 'not_started'), 'completed_at', lp.completed_at
          ) order by l.position)
          from public.lessons l
          join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
          left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
          where l.module_id = m.id), '[]'::jsonb)
      ) order by m.position)
      from public.modules m where m.course_id = v_course.id
        and exists (select 1 from public.lessons l join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
                    where l.module_id = m.id)), '[]'::jsonb),
    'assessments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assessment_id', a.id, 'assessment_version_id', av.id, 'kind', a.kind, 'title', a.title, 'lesson_id', a.lesson_id,
        'question_count', av.question_count, 'duration_seconds', av.duration_seconds, 'feedback_mode', av.feedback_mode,
        'active_attempt_id', (select at.id from public.assessment_attempts at
                              where at.user_id = v_uid and at.assessment_id = a.id and at.status = 'active' limit 1),
        'completed_attempts', (select count(*) from public.assessment_attempts at
                               where at.user_id = v_uid and at.assessment_id = a.id and at.status in ('submitted', 'expired')),
        'best_percent', (select max(round(100.0 * at.correct_count / at.total_count)) from public.assessment_attempts at
                         where at.user_id = v_uid and at.assessment_id = a.id and at.status in ('submitted', 'expired')),
        'first_completion_rewarded', exists (
          select 1 from public.points_ledger pl where pl.user_id = v_uid
            and pl.event_key in ('practice_first:' || a.id::text, 'mock_first:' || a.id::text))
      ) order by case a.kind when 'review' then 1 when 'practice' then 2 else 3 end, a.position)
      from public.assessments a
      join public.assessment_versions av on av.assessment_id = a.id and av.status = 'published'
      where a.course_id = v_course.id), '[]'::jsonb),
    'battle_ready', (select count(*) from public.questions q
                     where q.course_id = v_course.id and q.pool = 'battle'
                       and exists (select 1 from public.question_versions qv where qv.question_id = q.id
                                   and qv.status = 'published' and 'battle' = any (qv.usage)))
                    >= coalesce((select br.round_count from public.battle_rules br where br.published_at is not null
                                 and br.published_at <= now() order by br.version desc limit 1), 5)
  ));
end;
$$;

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------
create or replace function public.get_lesson_v1(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_lesson public.lessons;
  v_version public.lesson_versions;
  v_offering uuid;
  v_prev uuid;
  v_next uuid;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  v_offering := private.require_course_enrollment(v_uid, v_lesson.course_id);
  select * into v_version from public.lesson_versions where lesson_id = p_lesson_id and status = 'published';
  if not found then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;

  with ordered as (
    select l.id, lag(l.id) over w as prev_id, lead(l.id) over w as next_id
    from public.lessons l join public.modules m on m.id = l.module_id
    where l.course_id = v_lesson.course_id
      and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')
    window w as (order by m.position, l.position)
  )
  select prev_id, next_id into v_prev, v_next from ordered where id = p_lesson_id;

  return private.envelope(jsonb_build_object(
    'lesson_id', v_lesson.id,
    'lesson_version_id', v_version.id,
    'version', v_version.version,
    'offering_id', v_offering,
    'course_id', v_lesson.course_id,
    'module', (select jsonb_build_object('id', m.id, 'title', m.title, 'position', m.position)
               from public.modules m where m.id = v_lesson.module_id),
    'position', v_lesson.position,
    'title', v_version.title,
    'objective', v_version.objective,
    'estimated_minutes', v_version.estimated_minutes,
    'blocks', v_version.blocks,
    'previous_lesson_id', v_prev,
    'next_lesson_id', v_next,
    'progress', (select jsonb_build_object('state', lp.state, 'started_at', lp.started_at, 'completed_at', lp.completed_at)
                 from public.lesson_progress lp where lp.user_id = v_uid and lp.lesson_id = p_lesson_id),
    'review', (select jsonb_build_object('assessment_id', a.id, 'assessment_version_id', av.id, 'title', a.title)
               from public.assessments a join public.assessment_versions av on av.assessment_id = a.id and av.status = 'published'
               where a.lesson_id = p_lesson_id and a.kind = 'review' order by a.position limit 1)
  ));
end;
$$;

create or replace function public.start_lesson_v1(p_lesson_version_id uuid)
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
begin
  select * into v_version from public.lesson_versions where id = p_lesson_version_id;
  if not found or v_version.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  select course_id into v_course from public.lessons where id = v_version.lesson_id;
  perform private.require_course_enrollment(v_uid, v_course);

  insert into public.lesson_progress (user_id, lesson_id, last_version_id, state)
  values (v_uid, v_version.lesson_id, v_version.id, 'started')
  on conflict (user_id, lesson_id) do update set last_version_id = excluded.last_version_id, updated_at = now()
  returning * into v_progress;

  return private.envelope(jsonb_build_object('lesson_id', v_progress.lesson_id, 'state', v_progress.state,
    'started_at', v_progress.started_at, 'completed_at', v_progress.completed_at));
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

    v_awarded := private.award_points(v_uid, 'lesson_complete', 'lesson', v_version.lesson_id,
                                      'lesson:' || v_version.lesson_id::text);
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

-- ---------------------------------------------------------------------------
-- Assessments
-- ---------------------------------------------------------------------------
create or replace function public.start_attempt_v1(
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

create or replace function private.lock_owned_attempt(p_uid uuid, p_attempt_id uuid)
returns public.assessment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Attempt not found.');
  end if;
  if v_attempt.user_id <> p_uid then
    perform private.raise_error('FORBIDDEN');
  end if;
  return v_attempt;
end;
$$;

create or replace function public.save_attempt_answers_v1(p_attempt_id uuid, p_answers jsonb, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_attempt public.assessment_attempts;
  v_saved jsonb;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  v_attempt := private.lock_owned_attempt(v_uid, p_attempt_id);
  if v_attempt.status <> 'active' or (v_attempt.expires_at is not null and v_attempt.expires_at <= now()) then
    perform private.raise_error('DEADLINE_PASSED', 'This attempt is closed; saved answers can no longer change.');
  end if;
  v_saved := private.apply_attempt_answers(v_attempt, p_answers, true);
  update public.assessment_attempts set revision = revision + 1 where id = p_attempt_id
  returning * into v_attempt;
  return private.envelope(jsonb_build_object(
    'attempt_id', v_attempt.id, 'revision', v_attempt.revision, 'expires_at', v_attempt.expires_at,
    'saved', v_saved), p_request_key);
end;
$$;

create or replace function public.check_review_answer_v1(
  p_attempt_id uuid, p_question_version_id uuid, p_option_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_attempt public.assessment_attempts;
  v_order uuid[];
  v_answer public.attempt_answers;
  v_key private.question_answer_keys;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  v_attempt := private.lock_owned_attempt(v_uid, p_attempt_id);
  if v_attempt.feedback_mode <> 'immediate' then
    perform private.raise_error('FORBIDDEN', 'Feedback for this assessment is shown after submission.');
  end if;

  select * into v_answer from public.attempt_answers
  where attempt_id = p_attempt_id and question_version_id = p_question_version_id;

  if not (found and v_answer.locked_at is not null) then
    if v_attempt.status <> 'active' or (v_attempt.expires_at is not null and v_attempt.expires_at <= now()) then
      perform private.raise_error('DEADLINE_PASSED');
    end if;
    select aq.option_order into v_order from public.attempt_questions aq
    where aq.attempt_id = p_attempt_id and aq.question_version_id = p_question_version_id;
    if v_order is null then
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('question_version_id', 'question_not_in_attempt'));
    end if;
    if p_option_id is null or not (p_option_id = any (v_order)) then
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('option_id', 'option_not_in_question'));
    end if;
    select * into v_key from private.question_answer_keys where question_version_id = p_question_version_id;

    insert into public.attempt_answers (attempt_id, question_version_id, option_id, answer_revision, received_at, locked_at, is_correct)
    values (p_attempt_id, p_question_version_id, p_option_id, 1, now(), now(), p_option_id = v_key.correct_option_id)
    on conflict (attempt_id, question_version_id) do update
      set option_id = excluded.option_id, answer_revision = public.attempt_answers.answer_revision + 1,
          received_at = excluded.received_at, locked_at = excluded.locked_at, is_correct = excluded.is_correct
    returning * into v_answer;

    update public.assessment_attempts set revision = revision + 1 where id = p_attempt_id;
  else
    select * into v_key from private.question_answer_keys where question_version_id = p_question_version_id;
  end if;

  return private.envelope(jsonb_build_object(
    'attempt_id', p_attempt_id,
    'question_version_id', p_question_version_id,
    'option_id', v_answer.option_id,
    'locked', true,
    'is_correct', v_answer.option_id = v_key.correct_option_id,
    'correct_option_id', v_key.correct_option_id,
    'explanation', v_key.explanation), p_request_key);
end;
$$;

create or replace function public.submit_attempt_v1(p_attempt_id uuid, p_answers jsonb default null, p_request_key uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_attempt public.assessment_attempts;
  v_deadline_passed boolean;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  v_attempt := private.lock_owned_attempt(v_uid, p_attempt_id);
  if v_attempt.status <> 'active' then
    return private.envelope(private.attempt_payload(p_attempt_id) || jsonb_build_object('deadline_passed', false), p_request_key);
  end if;
  v_deadline_passed := v_attempt.expires_at is not null and v_attempt.expires_at <= now();
  if not v_deadline_passed and p_answers is not null and jsonb_typeof(p_answers) = 'array' and jsonb_array_length(p_answers) > 0 then
    perform private.apply_attempt_answers(v_attempt, p_answers, false);
  end if;
  return private.envelope(
    private.finalize_attempt(p_attempt_id, case when v_deadline_passed then 'expired' else 'submitted' end)
      || jsonb_build_object('deadline_passed', v_deadline_passed), p_request_key);
end;
$$;

create or replace function public.get_attempt_result_v1(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Attempt not found.');
  end if;
  if v_attempt.user_id <> v_uid then
    perform private.raise_error('FORBIDDEN');
  end if;
  -- Opportunistic catch-up when the scheduler is late.
  if v_attempt.status = 'active' and v_attempt.expires_at is not null and v_attempt.expires_at <= now() then
    perform private.finalize_attempt(p_attempt_id, 'expired');
  end if;
  return private.envelope(private.attempt_payload(p_attempt_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Home summary
-- ---------------------------------------------------------------------------
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
    'learning_xp_today', coalesce((select c.learning_xp_awarded from private.daily_counters c
                                   where c.user_id = v_uid and c.local_date = private.lagos_date()), 0),
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

-- ---------------------------------------------------------------------------
-- Reports, notifications, push tokens
-- ---------------------------------------------------------------------------
create or replace function public.report_content_v1(
  p_target_type text, p_target_id uuid, p_category text, p_note text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_report public.content_reports;
  v_errors jsonb := '{}'::jsonb;
  v_note text := btrim(coalesce(p_note, ''));
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_report from public.content_reports where user_id = v_uid and request_key = p_request_key;
  if found then
    return private.envelope(jsonb_build_object('report_id', v_report.id, 'state', v_report.state,
                                               'created_at', v_report.created_at), p_request_key);
  end if;

  if p_target_type is null or p_target_type not in ('lesson', 'question', 'battle', 'technical') then
    v_errors := v_errors || jsonb_build_object('target_type', 'invalid');
  end if;
  if p_category is null or p_category not in ('incorrect', 'unclear', 'typo', 'offensive', 'broken', 'other') then
    v_errors := v_errors || jsonb_build_object('category', 'invalid');
  end if;
  if length(v_note) < 1 or length(v_note) > 2000 then
    v_errors := v_errors || jsonb_build_object('note', 'must be 1-2000 characters');
  end if;
  if p_target_type in ('lesson', 'question', 'battle') and p_target_id is null then
    v_errors := v_errors || jsonb_build_object('target_id', 'required');
  elsif p_target_type = 'lesson' and not exists (select 1 from public.lessons where id = p_target_id) then
    v_errors := v_errors || jsonb_build_object('target_id', 'not_found');
  elsif p_target_type = 'question' and not exists (select 1 from public.question_versions where id = p_target_id)
        and not exists (select 1 from public.questions where id = p_target_id) then
    v_errors := v_errors || jsonb_build_object('target_id', 'not_found');
  elsif p_target_type = 'battle' and not exists (select 1 from public.battle_participants
                                                where battle_id = p_target_id and user_id = v_uid) then
    v_errors := v_errors || jsonb_build_object('target_id', 'not_found');
  end if;
  if v_errors <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', null, v_errors);
  end if;

  if (select count(*) from public.content_reports where user_id = v_uid and created_at > now() - interval '1 hour') >= 10 then
    perform private.raise_error('RATE_LIMITED', 'You have sent many reports recently. Please try again later.');
  end if;

  insert into public.content_reports (user_id, target_type, target_id, category, note, request_key)
  values (v_uid, p_target_type, p_target_id, p_category, v_note, p_request_key)
  returning * into v_report;

  return private.envelope(jsonb_build_object('report_id', v_report.id, 'state', v_report.state,
                                             'created_at', v_report.created_at), p_request_key);
end;
$$;

create or replace function public.mark_notification_read_v1(p_notification_id uuid default null, p_all boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_count integer;
  v_owner uuid;
begin
  if coalesce(p_all, false) then
    update public.notifications set read_at = now() where user_id = v_uid and read_at is null;
    get diagnostics v_count = row_count;
  else
    select user_id into v_owner from public.notifications where id = p_notification_id;
    if v_owner is null then
      perform private.raise_error('NOT_FOUND');
    end if;
    if v_owner <> v_uid then
      perform private.raise_error('FORBIDDEN');
    end if;
    update public.notifications set read_at = coalesce(read_at, now()) where id = p_notification_id;
    v_count := 1;
  end if;
  return private.envelope(jsonb_build_object('updated', v_count,
    'unread', (select count(*) from public.notifications where user_id = v_uid and read_at is null)));
end;
$$;

create or replace function public.register_push_token_v1(p_platform text, p_device_key text, p_delivery_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid;
begin
  if p_platform not in ('web', 'ios', 'android') or p_device_key is null or length(p_device_key) not between 8 and 200
     or p_delivery_config is null or jsonb_typeof(p_delivery_config) <> 'object' then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  insert into public.push_tokens (user_id, platform, device_key, delivery_config, consented_at)
  values (v_uid, p_platform, p_device_key, p_delivery_config, now())
  on conflict (user_id, platform, device_key) do update
    set delivery_config = excluded.delivery_config, revoked_at = null, consented_at = now(), updated_at = now()
  returning id into v_id;
  return private.envelope(jsonb_build_object('push_token_id', v_id));
end;
$$;

create or replace function public.revoke_push_token_v1(p_platform text, p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  update public.push_tokens set revoked_at = now(), updated_at = now()
  where user_id = v_uid and platform = p_platform and device_key = p_device_key and revoked_at is null;
  return private.envelope(jsonb_build_object('revoked', found));
end;
$$;
