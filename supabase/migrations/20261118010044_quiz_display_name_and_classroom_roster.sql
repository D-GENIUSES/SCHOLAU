-- Let learners choose the name attached to this quiz attempt, and retain the
-- existing profile name for their account and other ScholAu features.
create function public.start_lecturer_quiz_attempt_v2(
  p_quiz_id uuid,
  p_matric_number text,
  p_display_name text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  a private.lecturer_course_quiz_attempts;
  dept text;
  dname text := btrim(coalesce(p_display_name, ''));
  max_att integer;
  used integer;
  v_qo integer[];
  v_oo jsonb;
  matric text := btrim(coalesce(p_matric_number, ''));
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for update;
  if not found or not private.quiz_student_can_access(p_quiz_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if q.status <> 'published' or private.quiz_display_state(q) <> 'open' then
    perform private.raise_error('INVALID_STATE', 'This quiz is not open.');
  end if;
  if length(matric) not between 3 and 32 or matric !~ '^[A-Za-z0-9][A-Za-z0-9/_-]*$' then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a valid matriculation number.');
  end if;
  if length(dname) not between 2 and 60 or dname ~ '[<>]' or strpos(dname, '@') > 0 then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a valid display name (2–60 characters).');
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
  select d.name into dept
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

revoke all on function public.start_lecturer_quiz_attempt_v2(uuid, text, text) from public, anon;
grant execute on function public.start_lecturer_quiz_attempt_v2(uuid, text, text) to authenticated;
