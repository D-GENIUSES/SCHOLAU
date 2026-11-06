-- Personal quizzes reuse the existing saved-attempt, grading and XP engine.
-- A private registry holds one non-published session anchor per course. It is
-- deliberately absent from the catalogue: only the RPC below can start it.
create table private.topic_quiz_banks (
  course_id uuid primary key references public.courses(id),
  assessment_id uuid not null unique references public.assessments(id),
  assessment_version_id uuid not null unique references public.assessment_versions(id)
);
alter table private.topic_quiz_banks enable row level security;
revoke all on private.topic_quiz_banks from public, anon, authenticated;

create function private.topic_quiz_pool(p_user uuid, p_course uuid)
returns table(lesson_id uuid, question_version_id uuid)
language sql stable set search_path = '' as $$
  with eligible as (
    select q.lesson_id, qv.id, qv.difficulty
    from public.questions q
    join public.lessons l on l.id=q.lesson_id and l.course_id=q.course_id
    join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
    join public.question_versions qv on qv.question_id=q.id and qv.status='published'
    join private.question_answer_keys k on k.question_version_id=qv.id
    where q.course_id=p_course and q.pool='learning' and 'practice'=any(qv.usage)
      and qv.answer_format='standard'
      and (select count(*) from public.question_options o where o.question_version_id=qv.id)=4
  )
  select e.lesson_id,e.id from eligible e
  where e.difficulty<>'advanced'
    or exists(select 1 from private.topic_mastery tm where tm.user_id=p_user and tm.lesson_id=e.lesson_id)
    or not exists(select 1 from eligible normal where normal.lesson_id=e.lesson_id and normal.difficulty<>'advanced');
$$;
revoke all on function private.topic_quiz_pool(uuid,uuid) from public,anon,authenticated;

create function public.get_topic_quiz_options_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
begin
  v_offering := private.require_offering_enrollment(v_uid,p_offering_id);
  return private.envelope(jsonb_build_object(
    'topics',coalesce((
      select jsonb_agg(jsonb_build_object('lesson_id',l.id,'title',lv.title,'module_title',m.title,
        'question_count',(select count(*) from private.topic_quiz_pool(v_uid,v_offering.course_id) pool where pool.lesson_id=l.id))
        order by m.position,l.position)
      from public.lessons l join public.modules m on m.id=l.module_id
      join public.lesson_versions lv on lv.lesson_id=l.id and lv.status='published'
      where l.course_id=v_offering.course_id),'[]'::jsonb),
    'active_attempt_id',(select a.id from public.assessment_attempts a
      join private.topic_quiz_banks b on b.assessment_id=a.assessment_id
      where a.user_id=v_uid and a.offering_id=p_offering_id and a.status='active' limit 1)
  ));
end;
$$;

create function public.start_topic_quiz_v1(p_offering_id uuid,p_lesson_ids uuid[],p_question_count integer,p_request_key uuid)
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
  if exists(select 1 from unnest(p_lesson_ids) selected(id) where not exists(
    select 1 from private.topic_quiz_pool(v_uid,v_offering.course_id) pool where pool.lesson_id=selected.id)) then
    perform private.raise_error('CONTENT_UNAVAILABLE','One of these topics has no available practice questions.');
  end if;
  -- Snapshot the eligible pool once so retirement cannot change it between checks.
  select array_agg(pool.question_version_id) into v_pool
    from private.topic_quiz_pool(v_uid,v_offering.course_id) pool where pool.lesson_id=any(p_lesson_ids);
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
      (select array_agg(o.id order by random()) from public.question_options o where o.question_version_id=s.id)
    from (select ranked.id from (
      select qv.id,row_number() over(partition by q.lesson_id order by random()) as topic_position
      from public.question_versions qv join public.questions q on q.id=qv.question_id where qv.id=any(v_pool)
    ) ranked order by ranked.topic_position,random() limit p_question_count) s;
  return private.envelope(private.attempt_payload(v_attempt) || jsonb_build_object('resumed',false),p_request_key);
end;
$$;
revoke all on function public.get_topic_quiz_options_v1(uuid),public.start_topic_quiz_v1(uuid,uuid[],integer,uuid) from public,anon;
grant execute on function public.get_topic_quiz_options_v1(uuid),public.start_topic_quiz_v1(uuid,uuid[],integer,uuid) to authenticated;
