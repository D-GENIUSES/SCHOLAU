begin;

alter table public.attempt_answers
  alter column option_id drop not null,
  add column text_answer text,
  add constraint attempt_answer_one_value check (
    (option_id is null) <> (text_answer is null)
    and (text_answer is null or char_length(btrim(text_answer)) between 1 and 240)
  );

-- Quiz units group related lessons without changing lesson identifiers or learner progress.
create table private.topic_quiz_unit_members (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  unit_id uuid not null references public.lessons(id) on delete cascade,
  title text not null
);
alter table private.topic_quiz_unit_members enable row level security;
revoke all on private.topic_quiz_unit_members from public, anon, authenticated;

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
  v_text text;
  v_written boolean;
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
      v_text := nullif(btrim(v_item ->> 'text_answer'), '');
      v_rev := (v_item ->> 'answer_revision')::integer;
    exception when others then
      perform private.raise_error('VALIDATION_FAILED', 'Malformed answer.', jsonb_build_object('answers', 'malformed'));
    end;
    if v_qv is null or v_rev is null or v_rev < 1
      or (v_opt is null) = (v_text is null) or length(v_text) > 240
      or (v_text is not null and jsonb_typeof(v_item->'text_answer') <> 'string') then
      perform private.raise_error('VALIDATION_FAILED', 'Malformed answer.', jsonb_build_object('answers', 'malformed'));
    end if;

    select aq.option_order, qv.answer_format = 'fill_in_gap' into v_order, v_written
    from public.attempt_questions aq join public.question_versions qv on qv.id = aq.question_version_id
    where aq.attempt_id = p_attempt.id and aq.question_version_id = v_qv;
    if v_order is null then
      v_field_errors := v_field_errors || jsonb_build_object(v_qv::text, 'question_not_in_attempt');
      continue;
    end if;
    if v_written is distinct from (v_text is not null) or (v_opt is not null and not (v_opt = any (v_order))) then
      v_field_errors := v_field_errors || jsonb_build_object(v_qv::text, 'option_not_in_question');
      continue;
    end if;

    select * into v_existing from public.attempt_answers
    where attempt_id = p_attempt.id and question_version_id = v_qv;
    if found then
      if v_existing.locked_at is not null then
        if v_existing.option_id is distinct from v_opt or v_existing.text_answer is distinct from v_text then
          v_stale := v_stale || jsonb_build_object(v_qv::text, jsonb_build_object('reason', 'locked', 'answer_revision', v_existing.answer_revision));
        end if;
        continue;
      end if;
      if v_rev < v_existing.answer_revision or (v_rev = v_existing.answer_revision and (v_opt is distinct from v_existing.option_id or v_text is distinct from v_existing.text_answer)) then
        v_stale := v_stale || jsonb_build_object(v_qv::text, jsonb_build_object('reason', 'stale', 'answer_revision', v_existing.answer_revision));
        continue;
      end if;
      if v_rev = v_existing.answer_revision then
        v_saved := v_saved || jsonb_build_object('question_version_id', v_qv, 'answer_revision', v_rev);
        continue;
      end if;
      update public.attempt_answers set option_id = v_opt, text_answer = v_text, answer_revision = v_rev, received_at = now()
      where attempt_id = p_attempt.id and question_version_id = v_qv;
    else
      insert into public.attempt_answers (attempt_id, question_version_id, option_id, text_answer, answer_revision, received_at)
      values (p_attempt.id, v_qv, v_opt, v_text, v_rev, now());
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
     set is_correct = case when ans.text_answer is not null then private.gap_answer_matches(ans.text_answer, k.gap_answers)
                       else ans.option_id = k.correct_option_id end,
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
    select aq.position, aq.question_version_id, qv.prompt, qv.difficulty, qv.answer_format, aq.option_order,
           ans.option_id as saved_option_id, ans.text_answer, ans.answer_revision, ans.locked_at, ans.is_correct,
           k.correct_option_id, k.gap_answers, k.explanation,
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
        'answer_format', q.answer_format,
        'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by ord.n)
                    from unnest(q.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id), '[]'::jsonb),
        'saved', case when q.saved_option_id is null and q.text_answer is null then null else jsonb_build_object(
                   'option_id', q.saved_option_id, 'text_answer', q.text_answer, 'answer_revision', q.answer_revision,
                   'locked', q.locked_at is not null) end,
        'feedback', case when q.reveal then jsonb_build_object(
                   'is_correct', coalesce(q.is_correct, q.saved_option_id = q.correct_option_id, false),
                   'correct_option_id', q.correct_option_id,
                   'correct_text_answer', q.gap_answers->0->'accepted_answers'->>0,
                   'explanation', q.explanation,
                   'steps', coalesce((select to_jsonb(o.steps) from public.question_options o where o.id = q.correct_option_id and o.question_version_id = q.question_version_id), '[]'::jsonb)) else null end
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

create or replace function private.topic_quiz_pool_v2(p_user uuid, p_course uuid)
returns table(lesson_id uuid, question_version_id uuid)
language sql stable set search_path = '' as $$
  with eligible as (
    select q.lesson_id, qv.id, qv.difficulty
    from public.questions q
    join public.lessons l on l.id = q.lesson_id and l.course_id = q.course_id
    join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
    join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
    join private.question_answer_keys k on k.question_version_id = qv.id
    where q.course_id = p_course and q.pool = 'learning'
      and case
        when 'practice' = any(qv.usage) then true
        when 'review' = any(qv.usage) then not private.study_question_is_protected(q.course_id, q.id, qv.prompt)
        else false
      end
      and (
        (qv.answer_format = 'standard' and k.correct_option_id is not null
          and (select count(*) from public.question_options o where o.question_version_id = qv.id) = 4)
        or (qv.answer_format = 'fill_in_gap'
          and k.gap_answers->1 is null
          and jsonb_typeof(k.gap_answers->0->'accepted_answers') = 'array'
          and k.gap_answers->0->'accepted_answers'->>0 <> ''
          and not private.study_question_is_protected(q.course_id, q.id, qv.prompt))
      )
  )
  select e.lesson_id, e.id from eligible e
  where e.difficulty <> 'advanced'
    or exists(select 1 from private.topic_mastery tm where tm.user_id = p_user and tm.lesson_id = e.lesson_id)
    or not exists(select 1 from eligible normal where normal.lesson_id = e.lesson_id and normal.difficulty <> 'advanced');
$$;

create or replace function public.get_topic_quiz_options_v2(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  return private.envelope(jsonb_build_object(
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.id, 'title', lv.title,
        'module_id', coalesce(unit.unit_id, m.id), 'module_title', coalesce(unit.title, m.title),
        'question_count', coalesce(counts.question_count, 0)
      ) order by m.position, l.position)
      from public.lessons l join public.modules m on m.id = l.module_id
      join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
      left join private.topic_quiz_unit_members unit on unit.lesson_id = l.id
      left join (
        select pool.lesson_id, count(*) as question_count
        from private.topic_quiz_pool_v2(v_uid, v_offering.course_id) pool
        group by pool.lesson_id
      ) counts on counts.lesson_id = l.id
      where l.course_id = v_offering.course_id
    ), '[]'::jsonb),
    'active_attempt_id', (select a.id from public.assessment_attempts a
      join private.topic_quiz_banks b on b.assessment_id = a.assessment_id
      where a.user_id = v_uid and a.offering_id = p_offering_id and a.status = 'active' limit 1)
  ));
end;
$$;

create function public.start_topic_quiz_v2(p_offering_id uuid,p_lesson_ids uuid[],p_question_count integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_bank private.topic_quiz_banks;
  v_existing public.assessment_attempts;
  v_assessment uuid;
  v_version uuid;
  v_attempt uuid;
  v_pool uuid[];
  v_topics_found integer;
  v_epoch integer := (private.lagos_date() - date '2020-01-01') / 3;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  v_offering := private.require_offering_enrollment(v_uid,p_offering_id);
  perform pg_advisory_xact_lock(hashtextextended('scholau.start:' || v_uid::text,0));
  select * into v_existing from public.assessment_attempts where user_id=v_uid and request_key=p_request_key;
  if found then
    if v_existing.offering_id<>p_offering_id or not exists(select 1 from private.topic_quiz_banks b where b.assessment_id=v_existing.assessment_id) then
      perform private.raise_error('VALIDATION_FAILED','This request key belongs to another session.');
    end if;
    return private.envelope(private.attempt_payload(v_existing.id) || jsonb_build_object('resumed',true),p_request_key);
  end if;
  if p_lesson_ids is null or cardinality(p_lesson_ids) not between 1 and 30
    or cardinality(p_lesson_ids)<>(select count(distinct x) from unnest(p_lesson_ids) x)
    or p_question_count is null or p_question_count not between cardinality(p_lesson_ids) and 100 then
    perform private.raise_error('VALIDATION_FAILED','Choose 1–30 topics and 1–100 questions, with at least one question per topic.');
  end if;
  -- Use the same pool snapshot for validation and sampling.
  select array_agg(pool.question_version_id), count(distinct pool.lesson_id) into v_pool, v_topics_found
    from private.topic_quiz_pool_v2(v_uid,v_offering.course_id) pool where pool.lesson_id=any(p_lesson_ids);
  if v_topics_found <> cardinality(p_lesson_ids) then
    perform private.raise_error('CONTENT_UNAVAILABLE','One of these topics has no available practice questions.');
  end if;
  if coalesce(cardinality(v_pool),0)<p_question_count then
    perform private.raise_error('VALIDATION_FAILED','Choose fewer questions for the selected topics.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('scholau.quiz-bank:' || v_offering.course_id::text,0));
  select * into v_bank from private.topic_quiz_banks where course_id=v_offering.course_id;
  if not found then
    insert into public.assessments(course_id,kind,title) values(v_offering.course_id,'practice','Personal topic quiz') returning id into v_assessment;
    insert into public.assessment_versions(assessment_id,version,question_count,feedback_mode)
      values(v_assessment,1,100,'after_submit') returning id into v_version;
    insert into private.topic_quiz_banks values(v_offering.course_id,v_assessment,v_version) returning * into v_bank;
  end if;
  select * into v_existing from public.assessment_attempts where user_id=v_uid and assessment_id=v_bank.assessment_id and status='active' for update;
  if found then
    perform private.raise_error('ATTEMPT_ACTIVE','Finish or resume your current quiz first.',jsonb_build_object('attempt_id',v_existing.id));
  end if;
  insert into public.assessment_attempts(user_id,offering_id,assessment_id,assessment_version_id,request_key,
    started_at,scoring_version,feedback_mode,total_count)
    values(v_uid,p_offering_id,v_bank.assessment_id,v_bank.assessment_version_id,p_request_key,now(),1,'after_submit',p_question_count)
    returning id into v_attempt;
  -- Round-robin sampling guarantees every selected topic appears, without duplicates.
  insert into public.attempt_questions(attempt_id,question_version_id,position,option_order)
    select v_attempt,s.id,row_number() over(order by random())::integer,
      coalesce((select array_agg(o.id order by random()) from public.question_options o where o.question_version_id=s.id),'{}'::uuid[])
    from (select ranked.id from (
      select bank.id,row_number() over(partition by bank.lesson_id
        order by mod(bank.position - 1 - mod(v_epoch::bigint * 10, bank.total) + bank.total, bank.total) / 20, random()) as topic_position
      from (
        select qv.id, q.lesson_id,
          row_number() over(partition by coalesce(unit.unit_id, q.lesson_id) order by md5(qv.id::text), qv.id) as position,
          count(*) over(partition by coalesce(unit.unit_id, q.lesson_id)) as total
        from public.question_versions qv join public.questions q on q.id=qv.question_id
        left join private.topic_quiz_unit_members unit on unit.lesson_id = q.lesson_id
        where qv.id=any(v_pool)
      ) bank
    ) ranked order by ranked.topic_position,random() limit p_question_count) s;
  return private.envelope(private.attempt_payload(v_attempt) || jsonb_build_object('resumed',false),p_request_key);
end;
$$;

revoke all on function private.topic_quiz_pool_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_topic_quiz_options_v2(uuid),public.start_topic_quiz_v2(uuid,uuid[],integer,uuid) from public,anon;
grant execute on function public.get_topic_quiz_options_v2(uuid),public.start_topic_quiz_v2(uuid,uuid[],integer,uuid) to authenticated;

commit;
