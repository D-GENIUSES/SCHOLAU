begin;

-- Let administrators manage published quizzes from the existing quiz room.
do $$ declare definition text; original text;
begin
  select pg_get_functiondef('public.get_course_quiz_v1(uuid)'::regprocedure) into definition;
  original := definition;
  definition := replace(
    definition,
    'teacher := private.challenge_teacher(q.offering_id, u);',
    'teacher := private.challenge_teacher(q.offering_id, u) or private.user_is_admin(u);'
  );
  if definition = original then
    raise exception 'Could not grant administrators quiz management access';
  end if;
  execute definition;
end $$;

create or replace function public.extend_lecturer_quiz_v1(
  p_id uuid,
  p_revision integer,
  p_closes_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
begin
  select * into q
  from private.lecturer_course_quizzes
  where id = p_id
  for update;

  if not found or (
    not private.challenge_teacher(q.offering_id, u)
    and not private.user_is_admin(u)
  ) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if q.status <> 'published' then
    perform private.raise_error('INVALID_STATE', 'Only published quizzes can be extended.');
  end if;
  if q.revision is distinct from p_revision then
    perform private.raise_error('STALE_REVISION');
  end if;
  if p_closes_at is null
    or q.opens_at is null
    or p_closes_at <= q.opens_at
    or p_closes_at <= clock_timestamp()
  then
    perform private.raise_error('VALIDATION_FAILED', 'Choose a future close time after the quiz opens.');
  end if;

  update private.lecturer_course_quizzes
  set closes_at = p_closes_at,
      revision = revision + 1
  where id = p_id
  returning * into q;

  update private.lecturer_course_quiz_attempts
  set submitted_at = null,
      score = null,
      expires_at = least(started_at + make_interval(mins => q.duration_minutes), p_closes_at),
      revision = revision + 1
  where quiz_id = p_id
    and submitted_at is not null
    and submitted_at = expires_at
    and expires_at < p_closes_at;

  update private.lecturer_course_quiz_attempts
  set expires_at = least(started_at + make_interval(mins => q.duration_minutes), p_closes_at),
      revision = revision + 1
  where quiz_id = p_id
    and submitted_at is null
    and expires_at < p_closes_at;

  perform private.audit(u, 'extend_lecturer_quiz', 'lecturer_quiz', q.id, null);
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
end;
$$;

revoke all on function public.extend_lecturer_quiz_v1(uuid, integer, timestamptz) from public, anon;
grant execute on function public.extend_lecturer_quiz_v1(uuid, integer, timestamptz) to authenticated;

commit;
