-- Class quizzes for a shared course (e.g. COS 201) reach every programme
-- offering of that course in the same semester: CS, Software Engineering, Cybersecurity, etc.

create or replace function private.shared_course_offerings(p_offering uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sibling.id
  from public.course_offerings source
  join public.course_offerings sibling
    on sibling.course_id = source.course_id
   and sibling.semester_id = source.semester_id
   and sibling.status = 'published'
  where source.id = p_offering
    and source.status = 'published';
$$;

create or replace function private.quiz_class_student(p_offering uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.shared_course_offerings(p_offering) sibling
    where private.challenge_student(sibling, p_user)
  );
$$;

revoke all on function private.shared_course_offerings(uuid), private.quiz_class_student(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.publish_lecturer_quiz_v1(p_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
begin
  select * into q from private.lecturer_course_quizzes where id = p_id for update;
  if not found or not private.challenge_teacher(q.offering_id, u) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if q.status = 'published' then
    return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
  end if;
  if q.status <> 'draft' then perform private.raise_error('INVALID_STATE'); end if;
  if q.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if jsonb_array_length(q.questions) not between 1 and 100 then
    perform private.raise_error('VALIDATION_FAILED', 'Add at least one question.');
  end if;
  if q.opens_at is null or q.closes_at is null or q.closes_at <= q.opens_at then
    perform private.raise_error('VALIDATION_FAILED', 'Set when the quiz opens and closes.');
  end if;
  if q.closes_at <= clock_timestamp() then
    perform private.raise_error('VALIDATION_FAILED', 'Close time must be in the future.');
  end if;
  if not exists(select 1 from public.course_offerings where id = q.offering_id and status = 'published') then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  update private.lecturer_course_quizzes set status = 'published', revision = revision + 1 where id = p_id returning * into q;
  insert into public.notifications(user_id, kind, title, body, safe_target, event_key, category, context, expires_at)
  select
    e.user_id,
    'course_quiz',
    c.title,
    'New class quiz in ' || c.title || ': ' || q.title,
    '/course-quizzes/' || q.id::text,
    'course-quiz:' || q.id::text || ':' || e.user_id::text,
    'academic',
    jsonb_build_object('offering_id', e.offering_id, 'quiz_id', q.id),
    greatest(q.closes_at, clock_timestamp() + interval '24 hours')
  from private.shared_course_offerings(q.offering_id) sibling
  join public.enrollments e on e.offering_id = sibling and e.ended_at is null
  join public.course_offerings o on o.id = sibling
  join public.courses c on c.id = o.course_id
  where private.challenge_student(sibling, e.user_id)
  on conflict (event_key) do nothing;
  perform private.audit(u, 'publish_lecturer_quiz', 'lecturer_quiz', q.id, null);
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
end;
$$;

create or replace function public.list_course_quizzes_v1(p_offering_id uuid, p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  teacher boolean := private.challenge_teacher(p_offering_id, u);
  allowed boolean;
  items jsonb;
begin
  allowed := teacher or private.challenge_student(p_offering_id, u);
  if not allowed and not exists (
    select 1 from private.lecturer_course_quiz_attempts a
    join private.lecturer_course_quizzes q on q.id = a.quiz_id
    where q.offering_id in (select private.shared_course_offerings(p_offering_id))
      and a.user_id = u
  ) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select coalesce(jsonb_agg(x.item order by x.created_at desc, x.id), '[]') into items
  from (
    select private.quiz_summary(q) item, q.created_at, q.id
    from private.lecturer_course_quizzes q
    where (
        teacher and q.offering_id = p_offering_id
      )
      or (
        not teacher
        and q.status = 'published'
        and q.offering_id in (select private.shared_course_offerings(p_offering_id))
        and (
          allowed
          or exists(select 1 from private.lecturer_course_quiz_attempts a where a.quiz_id = q.id and a.user_id = u)
        )
      )
    order by q.created_at desc, q.id
    limit 20 offset greatest(0, coalesce(p_offset, 0))
  ) x;
  return private.envelope(jsonb_build_object(
    'items', items,
    'teacher', teacher,
    'course', (
      select jsonb_build_object('code', co.code, 'title', co.title, 'semester', s.label, 'period', ap.label)
      from public.course_offerings o
      join public.courses co on co.id = o.course_id
      join public.semesters s on s.id = o.semester_id
      join public.academic_periods ap on ap.id = s.academic_period_id
      where o.id = p_offering_id
    )
  ));
end;
$$;

create or replace function public.get_course_quiz_v1(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
  teacher boolean;
  show_answers boolean := false;
  questions jsonb := '[]'::jsonb;
  attempts_used integer;
begin
  select * into q from private.lecturer_course_quizzes where id = p_id for share;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  teacher := private.challenge_teacher(q.offering_id, u);
  if not teacher and not (
    private.quiz_class_student(q.offering_id, u)
    or exists(select 1 from private.lecturer_course_quiz_attempts where quiz_id = p_id and user_id = u)
  ) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if not teacher and q.status = 'draft' then perform private.raise_error('FORBIDDEN'); end if;
  select * into a from private.lecturer_course_quiz_attempts
  where quiz_id = p_id and user_id = u and submitted_at is null and expires_at > clock_timestamp()
  order by attempt_number desc limit 1;
  if a.id is null then
    select * into a from private.lecturer_course_quiz_attempts
    where quiz_id = p_id and user_id = u
    order by attempt_number desc limit 1;
  end if;
  select count(*)::int into attempts_used from private.lecturer_course_quiz_attempts where quiz_id = p_id and user_id = u;
  if teacher and q.status = 'draft' then
    questions := q.questions;
  elsif a.id is not null and (a.submitted_at is not null or clock_timestamp() >= a.expires_at) then
    show_answers := teacher
      or coalesce(q.settings->>'feedback_mode', 'after_submit') = 'after_submit';
    questions := private.quiz_student_questions(
      q.questions, a.question_order, a.option_orders,
      show_answers and (a.submitted_at is not null or teacher)
    );
  elsif a.id is not null and a.submitted_at is null and clock_timestamp() < a.expires_at then
    questions := private.quiz_student_questions(q.questions, a.question_order, a.option_orders, false);
  end if;
  if a.id is not null and a.submitted_at is null and clock_timestamp() >= a.expires_at then
    update private.lecturer_course_quiz_attempts set
      submitted_at = expires_at,
      score = private.quiz_score(q.questions, answers),
      revision = revision + 1
    where id = a.id returning * into a;
    show_answers := teacher
      or coalesce(q.settings->>'feedback_mode', 'after_submit') = 'after_submit';
    questions := private.quiz_student_questions(q.questions, a.question_order, a.option_orders, show_answers);
  end if;
  return private.envelope(jsonb_build_object(
    'quiz', private.quiz_summary(q),
    'teacher', teacher,
    'questions', questions,
    'attempts_used', attempts_used,
    'identity', case when teacher or a.id is null then null else jsonb_build_object(
      'matric_number', a.matric_number,
      'display_name', a.display_name_snapshot,
      'department', a.department_snapshot
    ) end,
    'attempt', case when a.id is null then null else jsonb_build_object(
      'id', a.id,
      'attempt_number', a.attempt_number,
      'answers', a.answers,
      'question_order', to_jsonb(a.question_order),
      'option_orders', a.option_orders,
      'revision', a.revision,
      'started_at', a.started_at,
      'expires_at', a.expires_at,
      'submitted_at', a.submitted_at,
      'score', case when a.submitted_at is not null then a.score end
    ) end,
    'profile', case when teacher then null else (
      select jsonb_build_object(
        'display_name', p.display_name,
        'department', d.name,
        'matric_number', p.matric_number
      )
      from public.profiles p
      left join public.departments d on d.id = p.department_id
      where p.id = u
    ) end,
    'server_time', clock_timestamp()
  ));
end;
$$;

create or replace function public.start_lecturer_quiz_attempt_v1(p_quiz_id uuid, p_matric_number text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
  dept text;
  dname text;
  max_att integer;
  used integer;
  v_qo integer[];
  v_oo jsonb;
  matric text := btrim(coalesce(p_matric_number, ''));
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for update;
  if not found or not private.quiz_class_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if q.status <> 'published' or private.quiz_display_state(q) <> 'open' then
    perform private.raise_error('INVALID_STATE', 'This quiz is not open.');
  end if;
  if length(matric) not between 3 and 32 or matric !~ '^[A-Za-z0-9][A-Za-z0-9/_-]*$' then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a valid matriculation number.');
  end if;
  max_att := greatest(1, least(3, coalesce((q.settings->>'max_attempts')::int, 1)));
  select count(*)::int into used from private.lecturer_course_quiz_attempts where quiz_id = p_quiz_id and user_id = u;
  select * into a from private.lecturer_course_quiz_attempts
  where quiz_id = p_quiz_id and user_id = u and submitted_at is null and expires_at > clock_timestamp()
  order by attempt_number desc limit 1;
  if a.id is not null then
    return public.get_course_quiz_v1(p_quiz_id);
  end if;
  if used >= max_att then
    perform private.raise_error('ATTEMPT_LIMIT', 'You have used all attempts for this quiz.');
  end if;
  select p.display_name, d.name into dname, dept
  from public.profiles p left join public.departments d on d.id = p.department_id where p.id = u;
  if dept is null then dept := 'Not set'; end if;
  update public.profiles set matric_number = matric where id = u and matric_number is null;
  select s.question_order, s.option_orders into v_qo, v_oo
  from private.quiz_build_shuffle(q.questions, p_quiz_id::text || ':' || u::text || ':' || (used + 1)::text) s
  limit 1;
  insert into private.lecturer_course_quiz_attempts(
    quiz_id, user_id, attempt_number, matric_number, display_name_snapshot, department_snapshot,
    question_order, option_orders, expires_at
  )
  values (
    p_quiz_id, u, used + 1, matric, dname, dept,
    v_qo, v_oo,
    private.quiz_attempt_deadline(q.closes_at, clock_timestamp(), q.duration_minutes)
  );
  return public.get_course_quiz_v1(p_quiz_id);
end;
$$;

create or replace function public.save_lecturer_quiz_answer_v1(
  p_quiz_id uuid, p_display_question integer, p_display_option integer, p_revision integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
  cq integer;
  co integer;
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for share;
  if not found or not private.quiz_class_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select * into a from private.lecturer_course_quiz_attempts
  where quiz_id = p_quiz_id and user_id = u and submitted_at is null and expires_at > clock_timestamp()
  order by attempt_number desc limit 1 for update;
  if not found then perform private.raise_error('DEADLINE_PASSED'); end if;
  if p_display_question is null or p_display_question < 0 or p_display_question >= array_length(a.question_order, 1) then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if p_display_option is null or p_display_option < 0
    or p_display_option >= jsonb_array_length(a.option_orders->p_display_question) then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  cq := a.question_order[p_display_question + 1];
  co := (a.option_orders->p_display_question->>p_display_option)::int;
  if a.answers->>cq::text = co::text then
    return public.get_course_quiz_v1(p_quiz_id);
  end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  update private.lecturer_course_quiz_attempts set
    answers = jsonb_set(answers, array[cq::text], to_jsonb(co)),
    revision = revision + 1
  where id = a.id;
  return public.get_course_quiz_v1(p_quiz_id);
end;
$$;

create or replace function public.submit_lecturer_quiz_attempt_v1(p_quiz_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for share;
  if not found or not private.quiz_class_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select * into a from private.lecturer_course_quiz_attempts
  where quiz_id = p_quiz_id and user_id = u and submitted_at is null
  order by attempt_number desc limit 1 for update;
  if not found then perform private.raise_error('INVALID_STATE'); end if;
  if a.revision is distinct from p_revision and clock_timestamp() < a.expires_at then
    perform private.raise_error('STALE_REVISION');
  end if;
  if a.submitted_at is null then
    update private.lecturer_course_quiz_attempts set
      submitted_at = least(clock_timestamp(), expires_at),
      score = private.quiz_score(q.questions, answers),
      revision = revision + 1
    where id = a.id;
  end if;
  return public.get_course_quiz_v1(p_quiz_id);
end;
$$;

create or replace function public.report_lecturer_quiz_integrity_v1(p_attempt_id uuid, p_event_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  attempt private.lecturer_course_quiz_attempts;
  quiz private.lecturer_course_quizzes;
  received timestamptz;
  flags integer;
begin
  if p_event_id is null or p_kind is null or p_kind not in (
    'app_hidden', 'focus_lost', 'possible_split_screen', 'fullscreen_exit',
    'screenshot_shortcut', 'recording_shortcut', 'casting_shortcut'
  ) then perform private.raise_error('VALIDATION_FAILED'); end if;

  select * into attempt from private.lecturer_course_quiz_attempts
  where id = p_attempt_id and user_id = actor for update;
  if not found then perform private.raise_error('FORBIDDEN'); end if;
  select * into quiz from private.lecturer_course_quizzes where id = attempt.quiz_id;
  if not private.quiz_class_student(quiz.offering_id, actor) then perform private.raise_error('FORBIDDEN'); end if;

  received := clock_timestamp();
  select count(*) into flags from private.lecturer_quiz_integrity_events where attempt_id = attempt.id;
  if quiz.status <> 'published' or received > least(attempt.expires_at, attempt.submitted_at) + interval '1 minute'
    or flags >= 100 then return jsonb_build_object('closed', true); end if;

  insert into private.lecturer_quiz_integrity_events(attempt_id, event_id, kind, received_at)
  select attempt.id, p_event_id, p_kind, received
  where not exists (
    select 1 from private.lecturer_quiz_integrity_events e where e.attempt_id = attempt.id
      and (e.kind = p_kind or (e.kind in ('app_hidden','focus_lost') and p_kind in ('app_hidden','focus_lost')))
      and e.received_at > received - interval '2 seconds'
  )
  on conflict (attempt_id, event_id) do nothing;
  return jsonb_build_object('closed', false);
end;
$$;

create or replace function public.lecturer_quiz_roster_v1(
  p_offering_id uuid, p_quiz_id uuid, p_search text default '', p_offset integer default 0
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  items jsonb;
  total integer;
begin
  if not private.challenge_teacher(p_offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id and offering_id = p_offering_id for share;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  with rows as (
    select
      p.id user_id,
      p.display_name,
      a.attempt_number,
      a.matric_number,
      a.display_name_snapshot,
      a.department_snapshot,
      a.score,
      a.submitted_at,
      a.started_at,
      a.expires_at
    from private.shared_course_offerings(p_offering_id) sibling
    join public.enrollments e on e.offering_id = sibling and e.ended_at is null
    join public.profiles p on p.id = e.user_id
    left join lateral (
      select * from private.lecturer_course_quiz_attempts x
      where x.quiz_id = p_quiz_id and x.user_id = p.id
      order by x.attempt_number desc limit 1
    ) a on true
  ),
  filtered as (
    select * from rows
    where coalesce(display_name_snapshot, display_name, '') ilike '%' || left(coalesce(p_search, ''), 100) || '%'
       or coalesce(matric_number, '') ilike '%' || left(coalesce(p_search, ''), 100) || '%'
  ),
  page as (
    select * from filtered order by submitted_at desc nulls last, display_name, user_id
    limit 50 offset greatest(0, coalesce(p_offset, 0))
  )
  select (select count(*)::int from filtered),
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'name', coalesce(display_name_snapshot, display_name),
      'matric_number', matric_number,
      'department', department_snapshot,
      'attempt_number', attempt_number,
      'score', score,
      'submitted_at', submitted_at,
      'status', case
        when submitted_at is not null then 'submitted'
        when started_at is not null then 'in_progress'
        else 'not_started'
      end
    ) order by submitted_at desc nulls last), '[]'::jsonb)
  into total, items from page;
  return private.envelope(jsonb_build_object('items', items, 'total', total, 'quiz', private.quiz_summary(q)));
end;
$$;
