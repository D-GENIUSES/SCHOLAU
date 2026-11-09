-- Roster: fall back to profile matric/department when no attempt yet.
-- Export: every shared-course enrollment with status (not only submitted attempts).

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
      coalesce(a.display_name_snapshot, p.display_name) as name,
      coalesce(nullif(btrim(a.matric_number), ''), p.matric_number) as matric_number,
      coalesce(nullif(btrim(a.department_snapshot), ''), d.name) as department,
      a.attempt_number,
      a.score,
      a.submitted_at,
      a.started_at,
      a.expires_at
    from private.shared_course_offerings(p_offering_id) sibling
    join public.enrollments e on e.offering_id = sibling and e.ended_at is null
    join public.profiles p on p.id = e.user_id
    left join public.departments d on d.id = p.department_id
    left join lateral (
      select * from private.lecturer_course_quiz_attempts x
      where x.quiz_id = p_quiz_id and x.user_id = p.id
      order by x.attempt_number desc limit 1
    ) a on true
  ),
  filtered as (
    select * from rows
    where coalesce(name, '') ilike '%' || left(coalesce(p_search, ''), 100) || '%'
       or coalesce(matric_number, '') ilike '%' || left(coalesce(p_search, ''), 100) || '%'
  ),
  page as (
    select * from filtered order by submitted_at desc nulls last, name, user_id
    limit 50 offset greatest(0, coalesce(p_offset, 0))
  )
  select (select count(*)::int from filtered),
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'name', name,
      'matric_number', matric_number,
      'department', department,
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

create or replace function public.export_lecturer_quiz_results_v1(p_quiz_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
  rows jsonb;
  q_total integer;
begin
  select * into q from private.lecturer_course_quizzes where id = p_quiz_id for share;
  if not found or not private.challenge_teacher(q.offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  q_total := jsonb_array_length(q.questions);
  select coalesce(jsonb_agg(jsonb_build_object(
    'matric_number', r.matric_number,
    'name', r.name,
    'department', r.department,
    'status', r.status,
    'attempt_number', r.attempt_number,
    'score', r.score,
    'total', q_total,
    'submitted_at', r.submitted_at,
    'answers', r.answers
  ) order by
    case r.status when 'submitted' then 0 when 'in_progress' then 1 else 2 end,
    r.submitted_at nulls last,
    r.name,
    r.matric_number
  ), '[]'::jsonb) into rows
  from (
    select
      coalesce(nullif(btrim(a.matric_number), ''), p.matric_number, '') as matric_number,
      coalesce(a.display_name_snapshot, p.display_name, '') as name,
      coalesce(nullif(btrim(a.department_snapshot), ''), d.name, '') as department,
      a.attempt_number,
      a.score,
      a.submitted_at,
      coalesce(a.answers, '{}'::jsonb) as answers,
      case
        when a.submitted_at is not null then 'submitted'
        when a.started_at is not null then 'in_progress'
        else 'not_started'
      end as status
    from private.shared_course_offerings(q.offering_id) sibling
    join public.enrollments e on e.offering_id = sibling and e.ended_at is null
    join public.profiles p on p.id = e.user_id
    left join public.departments d on d.id = p.department_id
    left join lateral (
      select * from private.lecturer_course_quiz_attempts x
      where x.quiz_id = p_quiz_id and x.user_id = p.id
      order by x.attempt_number desc limit 1
    ) a on true
  ) r;
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q), 'questions', q.questions, 'rows', rows));
end;
$$;
