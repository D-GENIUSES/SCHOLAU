-- Personal/topic quiz questions may be shared unless tied to a non-terminal battle,
-- mock content, battle-only pool, or published course challenges.

create or replace function private.study_question_is_protected(p_course uuid, p_question uuid, p_prompt text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.questions q
    join public.question_versions v on v.question_id = q.id
    where q.course_id = p_course
      and (q.id = p_question or v.prompt = p_prompt)
      and (
        (v.status = 'published' and (
          q.pool = 'battle'
          or v.usage && array['mock']
          or (v.usage && array['battle'] and not (v.usage && array['practice', 'review']))
        ))
        or exists (
          select 1
          from public.assessment_questions aq
          join public.assessment_versions av on av.id = aq.assessment_version_id
          join public.assessments a on a.id = av.assessment_id
          where aq.question_version_id = v.id and a.kind = 'mock' and av.published_at is not null
        )
        or exists (
          select 1
          from public.attempt_questions aq
          join public.assessment_attempts aa on aa.id = aq.attempt_id
          join public.assessments a on a.id = aa.assessment_id
          where aq.question_version_id = v.id and a.kind = 'mock'
        )
        or exists (
          select 1
          from public.battle_questions bq
          join public.battles b on b.id = bq.battle_id
          where bq.question_version_id = v.id
            and b.state in ('waiting', 'ready', 'countdown', 'active')
        )
      )
  ) or exists (
    select 1
    from private.course_challenges c
    join public.course_offerings o on o.id = c.offering_id
    cross join lateral jsonb_array_elements(c.questions) item
    left join public.question_versions v on v.id::text = item->>'source_version_id'
    where o.course_id = p_course and c.status in ('published', 'cancelled')
      and (v.question_id = p_question or item->>'prompt' = p_prompt)
  );
$$;
