-- Lecturer course quizzes: scheduled MC forms for enrolled students (Google Forms replacement).
-- Private tables; browsers use authenticated RPCs only.

alter table public.profiles
  add column if not exists matric_number text
  check (
    matric_number is null
    or (
      length(matric_number) between 3 and 32
      and matric_number ~ '^[A-Za-z0-9][A-Za-z0-9/_-]*$'
    )
  );

create table private.lecturer_course_quizzes (
  id uuid primary key,
  offering_id uuid not null references public.course_offerings(id),
  created_by uuid not null references public.profiles(id),
  title text not null check (length(title) between 1 and 160),
  instructions text not null default '' check (length(instructions) <= 4000),
  duration_minutes integer not null default 15 check (duration_minutes between 1 and 180),
  questions jsonb not null default '[]',
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  settings jsonb not null default '{"max_attempts":1,"feedback_mode":"after_submit"}'::jsonb,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 100),
  check (
    status = 'draft'
    or (
      opens_at is not null
      and closes_at is not null
      and closes_at > opens_at
    )
  )
);

create index lecturer_course_quizzes_offering on private.lecturer_course_quizzes(offering_id, created_at desc);

create table private.lecturer_course_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references private.lecturer_course_quizzes(id),
  user_id uuid not null references public.profiles(id),
  attempt_number integer not null check (attempt_number > 0),
  matric_number text not null check (length(matric_number) between 3 and 32),
  display_name_snapshot text not null,
  department_snapshot text not null,
  question_order integer[] not null,
  option_orders jsonb not null,
  answers jsonb not null default '{}',
  started_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score integer,
  revision integer not null default 1,
  unique (quiz_id, user_id, attempt_number)
);

create index lecturer_quiz_attempts_quiz on private.lecturer_course_quiz_attempts(quiz_id, user_id);

create table private.lecturer_quiz_import_jobs (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references private.lecturer_course_quizzes(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  object_key text not null,
  mime_type text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  proposed_questions jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.lecturer_course_quizzes enable row level security;
alter table private.lecturer_course_quiz_attempts enable row level security;
alter table private.lecturer_quiz_import_jobs enable row level security;

revoke all on private.lecturer_course_quizzes, private.lecturer_course_quiz_attempts, private.lecturer_quiz_import_jobs
  from public, anon, authenticated;

create function private.quiz_display_state(q private.lecturer_course_quizzes) returns text
language sql stable set search_path = '' as $$
  select case
    when q.status = 'draft' then 'draft'
    when q.status = 'cancelled' then 'cancelled'
    when clock_timestamp() < q.opens_at then 'upcoming'
    when clock_timestamp() < q.closes_at then 'open'
    else 'closed'
  end
$$;

create function private.quiz_summary(q private.lecturer_course_quizzes) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id,
    'offering_id', q.offering_id,
    'title', q.title,
    'instructions', q.instructions,
    'duration_minutes', q.duration_minutes,
    'state', private.quiz_display_state(q),
    'opens_at', q.opens_at,
    'closes_at', q.closes_at,
    'revision', q.revision,
    'question_count', jsonb_array_length(q.questions),
  'max_attempts', coalesce((q.settings->>'max_attempts')::int, 1),
    'feedback_mode', coalesce(q.settings->>'feedback_mode', 'after_submit')
  )
$$;

create function private.quiz_score(p_questions jsonb, p_answers jsonb) returns integer
language sql immutable set search_path = '' as $$
  select count(*)::integer
  from jsonb_array_elements(p_questions) with ordinality q(v, n)
  where p_answers->>((n - 1)::text) = q.v->>'correct'
$$;

create function private.quiz_attempt_deadline(p_closes timestamptz, p_started timestamptz, p_duration_min integer)
returns timestamptz
language sql immutable set search_path = '' as $$
  select least(p_closes, p_started + make_interval(mins => p_duration_min))
$$;

create function private.quiz_build_shuffle(p_questions jsonb, p_seed text)
returns table(question_order integer[], option_orders jsonb)
language plpgsql immutable set search_path = '' as $$
declare
  n integer := jsonb_array_length(p_questions);
  qo integer[];
  oo jsonb := '[]'::jsonb;
  i integer;
  j integer;
  k integer;
  opts integer[];
  tmp integer;
begin
  qo := array(select s - 1 from generate_series(1, n) s order by md5(p_seed || ':q:' || (s - 1)::text));
  for i in 0..(n - 1) loop
    opts := array(
      select s - 1
      from generate_series(1, jsonb_array_length(p_questions->i->'options')) s
      order by md5(p_seed || ':o:' || i::text || ':' || (s - 1)::text)
    );
    oo := oo || to_jsonb(opts);
  end loop;
  question_order := qo;
  option_orders := oo;
  return next;
end;
$$;

create function private.quiz_validate_question(q jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  n integer;
  c integer;
begin
  if coalesce(length(btrim(q->>'prompt')), 0) not between 1 and 2000 then
    perform private.raise_error('VALIDATION_FAILED', 'Complete each question prompt.');
  end if;
  if jsonb_typeof(q->'options') is distinct from 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'Each question needs options.');
  end if;
  n := jsonb_array_length(q->'options');
  if n not between 2 and 6 then
    perform private.raise_error('VALIDATION_FAILED', 'Use between 2 and 6 options per question.');
  end if;
  if coalesce(q->>'correct', '') !~ '^\d+$' or (q->>'correct')::int < 0 or (q->>'correct')::int >= n then
    perform private.raise_error('VALIDATION_FAILED', 'Mark the correct option for each question.');
  end if;
  if coalesce(length(q->>'explanation'), 0) > 4000 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if exists (
    select 1 from jsonb_array_elements(q->'options') x
    where jsonb_typeof(x) <> 'string' or length(btrim(x #>> '{}')) not between 1 and 1000
  ) then
    perform private.raise_error('VALIDATION_FAILED', 'Option text is required.');
  end if;
  if (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(q->'options') x) <> n then
    perform private.raise_error('VALIDATION_FAILED', 'Options must be distinct.');
  end if;
end;
$$;

create function private.quiz_normalize_questions(p_data jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  questions jsonb := '[]'::jsonb;
  q jsonb;
begin
  if jsonb_typeof(p_data->'questions') is distinct from 'array' then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if jsonb_array_length(p_data->'questions') > 100 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  for q in select value from jsonb_array_elements(p_data->'questions') loop
    perform private.quiz_validate_question(q);
    questions := questions || jsonb_build_array(
      jsonb_build_object(
        'prompt', btrim(q->>'prompt'),
        'options', q->'options',
        'correct', (q->>'correct')::int,
        'explanation', coalesce(q->>'explanation', '')
      )
    );
  end loop;
  return questions;
end;
$$;

create function private.quiz_student_questions(
  p_questions jsonb,
  p_question_order integer[],
  p_option_orders jsonb,
  p_reveal boolean
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  out jsonb := '[]'::jsonb;
  i integer;
  cq integer;
  opts jsonb;
  perm jsonb;
  j integer;
  idx integer;
begin
  for i in 0..(coalesce(array_length(p_question_order, 1), 0) - 1) loop
    cq := p_question_order[i + 1];
    perm := p_option_orders->i;
    opts := '[]'::jsonb;
    for j in 0..(jsonb_array_length(perm) - 1) loop
      idx := (perm->>j)::int;
      opts := opts || jsonb_build_array(p_questions->cq->'options'->idx);
    end loop;
    out := out || jsonb_build_array(
      case
        when p_reveal then jsonb_build_object(
          'prompt', p_questions->cq->>'prompt',
          'options', opts,
          'correct', coalesce((
            select pos - 1 from jsonb_array_elements(perm) with ordinality p(v, pos)
            where (v #>> '{}')::int = (p_questions->cq->>'correct')::int
            limit 1
          ), 0),
          'explanation', p_questions->cq->>'explanation'
        )
        else jsonb_build_object('prompt', p_questions->cq->>'prompt', 'options', opts)
      end
    );
  end loop;
  return out;
end;
$$;

create function public.list_course_quizzes_v1(p_offering_id uuid, p_offset integer default 0) returns jsonb
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
    where q.offering_id = p_offering_id and a.user_id = u
  ) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select coalesce(jsonb_agg(x.item order by x.created_at desc, x.id), '[]') into items
  from (
    select private.quiz_summary(q) item, q.created_at, q.id
    from private.lecturer_course_quizzes q
    where q.offering_id = p_offering_id
      and (
        teacher
        or (
          q.status = 'published'
          and (allowed or exists(select 1 from private.lecturer_course_quiz_attempts a where a.quiz_id = q.id and a.user_id = u))
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

create function public.save_lecturer_quiz_v1(p_id uuid, p_offering_id uuid, p_revision integer, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  questions jsonb;
  settings jsonb;
begin
  if not private.challenge_teacher(p_offering_id, u) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if not exists(select 1 from public.course_offerings where id = p_offering_id and status = 'published') then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  if p_id is null
    or coalesce(length(btrim(p_data->>'title')), 0) not between 1 and 160
    or coalesce(length(p_data->>'instructions'), 0) > 4000
    or coalesce(p_data->>'duration_minutes', '') !~ '^\d{1,3}$'
    or (p_data->>'duration_minutes')::int not between 1 and 180
  then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  questions := private.quiz_normalize_questions(p_data);
  settings := jsonb_build_object(
    'max_attempts', greatest(1, least(3, coalesce((p_data->>'max_attempts')::int, 1))),
    'feedback_mode', case when p_data->>'feedback_mode' = 'immediate' then 'immediate' else 'after_submit' end
  );
  perform pg_advisory_xact_lock(hashtextextended('lecturer-quiz:' || p_id::text, 0));
  select * into q from private.lecturer_course_quizzes where id = p_id for update;
  if found then
    if q.offering_id <> p_offering_id then perform private.raise_error('FORBIDDEN'); end if;
    if q.status <> 'draft' then perform private.raise_error('INVALID_STATE'); end if;
    if q.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  elsif p_revision is distinct from 0 then
    perform private.raise_error('STALE_REVISION');
  end if;
  insert into private.lecturer_course_quizzes(
    id, offering_id, created_by, title, instructions, duration_minutes, questions,
    opens_at, closes_at, settings, revision
  )
  values (
    p_id, p_offering_id, u, btrim(p_data->>'title'), coalesce(p_data->>'instructions', ''),
    (p_data->>'duration_minutes')::int, questions,
    nullif(p_data->>'opens_at', '')::timestamptz,
    nullif(p_data->>'closes_at', '')::timestamptz,
    settings, 0
  )
  on conflict (id) do update set
    title = excluded.title,
    instructions = excluded.instructions,
    duration_minutes = excluded.duration_minutes,
    questions = excluded.questions,
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    settings = excluded.settings,
    revision = private.lecturer_course_quizzes.revision + 1
  returning * into q;
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q), 'questions', q.questions));
end;
$$;

create function public.publish_lecturer_quiz_v1(p_id uuid, p_revision integer) returns jsonb
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
  insert into public.notifications(user_id, kind, body, safe_target, event_key)
  select e.user_id, 'course_quiz', 'New course quiz: ' || q.title, '/course-quizzes/' || q.id::text, 'course-quiz:' || q.id::text || ':' || e.user_id::text
  from public.enrollments e
  where e.offering_id = q.offering_id and e.ended_at is null and private.challenge_student(q.offering_id, e.user_id)
  on conflict (event_key) do nothing;
  perform private.audit(u, 'publish_lecturer_quiz', 'lecturer_quiz', q.id, null);
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
end;
$$;

create function public.cancel_lecturer_quiz_draft_v1(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); q private.lecturer_course_quizzes;
begin
  select * into q from private.lecturer_course_quizzes where id = p_id for update;
  if not found or not private.challenge_teacher(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if q.status = 'published' and private.quiz_display_state(q) = 'closed' then
    perform private.raise_error('INVALID_STATE', 'A closed quiz cannot be cancelled.');
  end if;
  update private.lecturer_course_quizzes set status = 'cancelled', revision = revision + 1
  where id = p_id and status <> 'cancelled' returning * into q;
  return private.envelope(jsonb_build_object('cancelled', true));
end;
$$;

create function public.get_course_quiz_v1(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
  teacher boolean;
  reveal boolean := false;
  questions jsonb := '[]'::jsonb;
  attempts_used integer;
begin
  select * into q from private.lecturer_course_quizzes where id = p_id for share;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  teacher := private.challenge_teacher(q.offering_id, u);
  if not teacher and not (
    private.challenge_student(q.offering_id, u)
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
    reveal := coalesce(q.settings->>'feedback_mode', 'after_submit') = 'after_submit'
      or coalesce(q.settings->>'feedback_mode', '') = 'immediate'
      or teacher;
    questions := private.quiz_student_questions(q.questions, a.question_order, a.option_orders, reveal and (a.submitted_at is not null or teacher));
  elsif a.id is not null and a.submitted_at is null and clock_timestamp() < a.expires_at then
    questions := private.quiz_student_questions(q.questions, a.question_order, a.option_orders, false);
  end if;
  if a.id is not null and a.submitted_at is null and clock_timestamp() >= a.expires_at then
    update private.lecturer_course_quiz_attempts set
      submitted_at = expires_at,
      score = private.quiz_score(q.questions, answers),
      revision = revision + 1
    where id = a.id returning * into a;
    reveal := true;
    questions := private.quiz_student_questions(q.questions, a.question_order, a.option_orders, true);
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

create function public.start_lecturer_quiz_attempt_v1(p_quiz_id uuid, p_matric_number text) returns jsonb
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
  if not found or not private.challenge_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
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

create function public.save_lecturer_quiz_answer_v1(
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
  if not found or not private.challenge_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
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

create function public.submit_lecturer_quiz_attempt_v1(p_quiz_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for share;
  if not found or not private.challenge_student(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
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

create function public.lecturer_quiz_roster_v1(
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
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    left join lateral (
      select * from private.lecturer_course_quiz_attempts x
      where x.quiz_id = p_quiz_id and x.user_id = p.id
      order by x.attempt_number desc limit 1
    ) a on true
    where e.offering_id = p_offering_id and e.ended_at is null
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

create function public.export_lecturer_quiz_results_v1(p_quiz_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); q private.lecturer_course_quizzes; rows jsonb;
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for share;
  if not found or not private.challenge_teacher(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'matric_number', a.matric_number,
    'name', a.display_name_snapshot,
    'department', a.department_snapshot,
    'attempt_number', a.attempt_number,
    'score', a.score,
    'total', jsonb_array_length(q.questions),
    'submitted_at', a.submitted_at,
    'answers', a.answers
  ) order by a.submitted_at, a.matric_number), '[]'::jsonb) into rows
  from private.lecturer_course_quiz_attempts a
  where a.quiz_id = p_quiz_id and a.submitted_at is not null;
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q), 'questions', q.questions, 'rows', rows));
end;
$$;

create function public.start_lecturer_quiz_import_v1(
  p_quiz_id uuid, p_offering_id uuid, p_object_key text, p_mime_type text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); q private.lecturer_course_quizzes; job_id uuid := gen_random_uuid();
begin
  if not private.challenge_teacher(p_offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id and offering_id = p_offering_id;
  if not found or q.status <> 'draft' then perform private.raise_error('INVALID_STATE'); end if;
  if coalesce(length(p_object_key), 0) > 500 then perform private.raise_error('VALIDATION_FAILED'); end if;
  insert into private.lecturer_quiz_import_jobs(id, quiz_id, created_by, object_key, mime_type)
  values (job_id, p_quiz_id, u, p_object_key, coalesce(p_mime_type, 'application/pdf'));
  return private.envelope(jsonb_build_object('job_id', job_id));
end;
$$;

create function public.get_lecturer_quiz_import_v1(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); j private.lecturer_quiz_import_jobs; q private.lecturer_course_quizzes;
begin
  select j.* into j from private.lecturer_quiz_import_jobs j where j.id = p_job_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into q from private.lecturer_course_quizzes where id = j.quiz_id;
  if not private.challenge_teacher(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  return private.envelope(jsonb_build_object(
    'job_id', j.id,
    'status', j.status,
    'proposed_questions', j.proposed_questions,
    'error_message', j.error_message
  ));
end;
$$;

create function private.complete_lecturer_quiz_import(
  p_job_id uuid, p_status text, p_questions jsonb default null, p_error text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.lecturer_quiz_import_jobs set
    status = p_status,
    proposed_questions = coalesce(p_questions, proposed_questions),
    error_message = p_error,
    updated_at = clock_timestamp()
  where id = p_job_id;
end;
$$;

grant execute on function private.complete_lecturer_quiz_import(uuid, text, jsonb, text) to service_role;

revoke all on function private.quiz_display_state(private.lecturer_course_quizzes),
  private.quiz_summary(private.lecturer_course_quizzes),
  private.quiz_score(jsonb, jsonb),
  private.quiz_attempt_deadline(timestamptz, timestamptz, integer),
  private.quiz_build_shuffle(jsonb, text),
  private.quiz_validate_question(jsonb),
  private.quiz_normalize_questions(jsonb),
  private.quiz_student_questions(jsonb, integer[], jsonb, boolean),
  private.complete_lecturer_quiz_import(uuid, text, jsonb, text)
  from public, anon, authenticated;

revoke all on function public.list_course_quizzes_v1(uuid, integer),
  public.save_lecturer_quiz_v1(uuid, uuid, integer, jsonb),
  public.publish_lecturer_quiz_v1(uuid, integer),
  public.cancel_lecturer_quiz_draft_v1(uuid),
  public.get_course_quiz_v1(uuid),
  public.start_lecturer_quiz_attempt_v1(uuid, text),
  public.save_lecturer_quiz_answer_v1(uuid, integer, integer, integer),
  public.submit_lecturer_quiz_attempt_v1(uuid, integer),
  public.lecturer_quiz_roster_v1(uuid, uuid, text, integer),
  public.export_lecturer_quiz_results_v1(uuid),
  public.start_lecturer_quiz_import_v1(uuid, uuid, text, text),
  public.get_lecturer_quiz_import_v1(uuid)
  from public, anon, authenticated;

grant execute on function public.list_course_quizzes_v1(uuid, integer),
  public.save_lecturer_quiz_v1(uuid, uuid, integer, jsonb),
  public.publish_lecturer_quiz_v1(uuid, integer),
  public.cancel_lecturer_quiz_draft_v1(uuid),
  public.get_course_quiz_v1(uuid),
  public.start_lecturer_quiz_attempt_v1(uuid, text),
  public.save_lecturer_quiz_answer_v1(uuid, integer, integer, integer),
  public.submit_lecturer_quiz_attempt_v1(uuid, integer),
  public.lecturer_quiz_roster_v1(uuid, uuid, text, integer),
  public.export_lecturer_quiz_results_v1(uuid),
  public.start_lecturer_quiz_import_v1(uuid, uuid, text, text),
  public.get_lecturer_quiz_import_v1(uuid)
  to authenticated;
