begin;

create or replace function private.topic_quiz_pool(p_user uuid, p_course uuid)
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
      and qv.answer_format = 'standard'
      and (select count(*) from public.question_options o where o.question_version_id = qv.id) = 4
  )
  select e.lesson_id, e.id from eligible e
  where e.difficulty <> 'advanced'
    or exists(select 1 from private.topic_mastery tm where tm.user_id = p_user and tm.lesson_id = e.lesson_id)
    or not exists(select 1 from eligible normal where normal.lesson_id = e.lesson_id and normal.difficulty <> 'advanced');
$$;

create or replace function public.get_topic_quiz_options_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  return private.envelope(jsonb_build_object(
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', l.id, 'title', lv.title, 'module_id', m.id, 'module_title', m.title,
        'question_count', coalesce(counts.question_count, 0)
      ) order by m.position, l.position)
      from public.lessons l join public.modules m on m.id = l.module_id
      join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
      left join (
        select pool.lesson_id, count(*) as question_count
        from private.topic_quiz_pool(v_uid, v_offering.course_id) pool
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

commit;
