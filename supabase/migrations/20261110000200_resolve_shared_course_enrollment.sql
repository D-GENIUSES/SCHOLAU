-- When a student opens a sibling programme's offering of a shared course
-- (e.g. CS COS 201 while enrolled in Software Engineering COS 201), resolve
-- to their own enrollment so overview / assessments / back-links work.

create or replace function private.require_offering_enrollment(p_user_id uuid, p_offering_id uuid)
returns public.course_offerings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offering public.course_offerings;
  v_resolved public.course_offerings;
begin
  select o.* into v_offering from public.course_offerings o where o.id = p_offering_id;
  if not found or v_offering.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  if exists (
    select 1 from public.enrollments e
    where e.user_id = p_user_id and e.offering_id = p_offering_id and e.ended_at is null
  ) then
    return v_offering;
  end if;
  -- Shared course across programmes in the same semester (COS 201 CS/SE/Cyber…).
  select sibling.* into v_resolved
  from private.shared_course_offerings(p_offering_id) sid
  join public.enrollments e on e.offering_id = sid and e.user_id = p_user_id and e.ended_at is null
  join public.course_offerings sibling on sibling.id = e.offering_id and sibling.status = 'published'
  order by e.enrolled_at desc
  limit 1;
  if found then
    return v_resolved;
  end if;
  perform private.raise_error('NOT_ENROLLED');
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
  viewer_offering uuid;
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

  if teacher then
    viewer_offering := q.offering_id;
  else
    select e.offering_id into viewer_offering
    from private.shared_course_offerings(q.offering_id) sid
    join public.enrollments e on e.offering_id = sid and e.user_id = u and e.ended_at is null
    order by case when e.offering_id = q.offering_id then 0 else 1 end, e.enrolled_at desc
    limit 1;
    viewer_offering := coalesce(viewer_offering, q.offering_id);
  end if;

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
    'viewer_offering_id', viewer_offering,
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
