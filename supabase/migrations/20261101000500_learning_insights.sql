-- Strengths and weaknesses from submitted lesson and course quizzes.
-- A topic needs at least three locked answers before it appears.

create function public.get_learning_insights_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_strengths jsonb;
  v_weaknesses jsonb;
begin
  with scored as (
    select a.lesson_id, a.course_id,
           count(*)::integer as answered,
           count(*) filter (where ans.is_correct)::integer as correct
    from public.attempt_answers ans
    join public.assessment_attempts at on at.id = ans.attempt_id
    join public.assessments a on a.id = at.assessment_id
    where at.user_id = v_uid
      and at.status in ('submitted', 'expired')
      and ans.locked_at is not null
    group by a.lesson_id, a.course_id
  ), labeled as (
    select s.lesson_id, s.answered, s.correct,
           round(100.0 * s.correct / s.answered)::integer as accuracy,
           coalesce(lv.title, c.title) as title,
           c.code as course_code,
           c.title as course_title
    from scored s
    join public.courses c on c.id = s.course_id
    left join lateral (
      select title from public.lesson_versions
      where lesson_id = s.lesson_id and status = 'published'
      order by version desc
      limit 1
    ) lv on true
    where s.answered >= 3
  )
  select
    coalesce((select jsonb_agg(to_jsonb(x) order by x.accuracy desc, x.answered desc) from (
      select lesson_id, course_code, course_title, title, answered, correct, accuracy
      from labeled where accuracy >= 80
      order by accuracy desc, answered desc, title
      limit 6
    ) x), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(x) order by x.accuracy asc, x.answered desc) from (
      select lesson_id, course_code, course_title, title, answered, correct, accuracy
      from labeled where accuracy <= 50
      order by accuracy asc, answered desc, title
      limit 6
    ) x), '[]'::jsonb)
  into v_strengths, v_weaknesses;

  return private.envelope(jsonb_build_object('strengths', v_strengths, 'weaknesses', v_weaknesses));
end;
$$;

revoke all on function public.get_learning_insights_v1() from public, anon;
grant execute on function public.get_learning_insights_v1() to authenticated;
