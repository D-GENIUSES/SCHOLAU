-- Opaque links for immutable bank versions and published lesson checkpoints.
create table private.shared_study_links (
  token uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('bank', 'checkpoint')),
  version_id uuid not null,
  checkpoint integer not null check (
    (source_kind = 'bank' and checkpoint = 0) or (source_kind = 'checkpoint' and checkpoint > 0)
  ),
  unique (source_kind, version_id, checkpoint)
);

alter table private.shared_study_links enable row level security;
revoke all on private.shared_study_links from public, anon, authenticated;

create index shared_study_assessment_question_lookup on public.assessment_questions (question_version_id);
create index shared_study_attempt_question_lookup on public.attempt_questions (question_version_id);
create index shared_study_battle_question_lookup on public.battle_questions (question_version_id);

create function private.study_question_is_protected(p_course uuid, p_question uuid, p_prompt text)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.questions q
    join public.question_versions v on v.question_id = q.id
    where q.course_id = p_course
      and (q.id = p_question or v.prompt = p_prompt)
      and (
        (v.status = 'published' and (q.pool = 'battle' or v.usage && array['mock', 'battle']))
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
          select 1 from public.battle_questions bq where bq.question_version_id = v.id
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

-- The internal payload is used only by the three public wrappers below.
create function private.shared_study_payload(p_kind text, p_version uuid, p_checkpoint integer)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'courseId', q.course_id,
    'topic', coalesce(lv.title, c.title),
    'prompt', v.prompt,
    'options', coalesce(options.items, '[]'::jsonb),
    'correctId', k.correct_option_id,
    'gapAnswers', k.gap_answers->0->'accepted_answers',
    'explanation', k.explanation,
    'report', jsonb_build_object('targetType', 'question', 'targetId', v.id)
  )
  from public.question_versions v
  join public.questions q on q.id = v.question_id
  join public.courses c on c.id = q.course_id
  join private.question_answer_keys k on k.question_version_id = v.id
  left join public.lesson_versions lv on lv.lesson_id = q.lesson_id and lv.status = 'published'
  cross join lateral (
    select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'steps', o.steps) order by o.position) items
    from public.question_options o where o.question_version_id = v.id
  ) options
  where p_kind = 'bank' and v.id = p_version and v.status = 'published' and c.active
    and q.pool = 'learning' and v.usage && array['practice', 'review']
    and not private.study_question_is_protected(q.course_id, q.id, v.prompt)
    and (k.correct_option_id is not null or jsonb_typeof(k.gap_answers->0->'accepted_answers') = 'array')
  union all
  select jsonb_build_object(
    'courseId', l.course_id,
    'topic', lv.title,
    'prompt', checkpoint.block->>'question',
    'options', options.items,
    'correctId', checkpoint.block->>'correct_index',
    'explanation', checkpoint.block->>'explanation',
    'report', jsonb_build_object('targetType', 'lesson', 'targetId', l.id,
      'reference', format('Lesson version %s, checkpoint %s', lv.id, p_checkpoint))
  )
  from public.lesson_versions lv
  join public.lessons l on l.id = lv.lesson_id
  join public.courses c on c.id = l.course_id
  cross join lateral (
    select b.value as block
    from jsonb_array_elements(lv.blocks) with ordinality b(value, position)
    where b.value->>'type' = 'checkpoint'
    order by b.position offset greatest(p_checkpoint - 1, 0) limit 1
  ) checkpoint
  cross join lateral (
    select jsonb_agg(jsonb_build_object('id', (o.position - 1)::text, 'body', o.value) order by o.position) items
    from jsonb_array_elements_text(checkpoint.block->'options') with ordinality o(value, position)
  ) options
  where p_kind = 'checkpoint' and p_checkpoint > 0 and lv.id = p_version
    and lv.status = 'published' and c.active
    and not private.study_question_is_protected(l.course_id, null, checkpoint.block->>'question');
$$;

create function public.create_shared_study_link_v1(p_kind text, p_version uuid, p_checkpoint integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb;
  link_token uuid;
begin
  perform private.require_user();
  if p_kind is null or p_kind not in ('bank', 'checkpoint') or p_checkpoint is null or
    (p_kind = 'bank' and p_checkpoint <> 0) or (p_kind = 'checkpoint' and p_checkpoint < 1)
  then return null; end if;

  payload := private.shared_study_payload(p_kind, p_version, p_checkpoint);
  if payload is null or not (authz.is_enrolled_in_course((payload->>'courseId')::uuid) or authz.is_admin())
  then return null; end if;

  insert into private.shared_study_links (source_kind, version_id, checkpoint)
  values (p_kind, p_version, p_checkpoint)
  on conflict (source_kind, version_id, checkpoint) do nothing returning token into link_token;
  if link_token is null then
    select token into link_token from private.shared_study_links
    where source_kind = p_kind and version_id = p_version and checkpoint = p_checkpoint;
  end if;
  return jsonb_build_object('token', link_token, 'topic', payload->>'topic');
end;
$$;

create function public.read_shared_study_link_v1(p_token uuid, p_answer text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  payload jsonb;
  correct_option jsonb;
  right_answer text;
  correct boolean;
begin
  select private.shared_study_payload(source_kind, version_id, checkpoint) into payload
  from private.shared_study_links where token = p_token;
  if payload is null then return null; end if;

  if p_answer is null then
    return (payload - array['courseId', 'correctId', 'gapAnswers', 'explanation']) || jsonb_build_object(
      'options', (select coalesce(jsonb_agg(o.value - 'steps' order by o.position), '[]'::jsonb)
        from jsonb_array_elements(payload->'options') with ordinality o(value, position))
    );
  end if;
  if length(btrim(p_answer)) not between 1 and 500 then return null; end if;

  if jsonb_typeof(payload->'gapAnswers') = 'array' then
    right_answer := payload->'gapAnswers'->>0;
    select exists (
      select 1 from jsonb_array_elements_text(payload->'gapAnswers') as alias(value)
      where private.normalize_gap_answer(alias.value) = private.normalize_gap_answer(p_answer)
    ) into correct;
  else
    if not exists (select 1 from jsonb_array_elements(payload->'options') o where o->>'id' = p_answer)
    then return null; end if;
    select o into correct_option from jsonb_array_elements(payload->'options') o
    where o->>'id' = payload->>'correctId';
    right_answer := correct_option->>'body';
    correct := p_answer = payload->>'correctId';
  end if;

  return jsonb_build_object('correct', correct, 'answer', right_answer,
    'explanation', payload->>'explanation', 'steps', correct_option->'steps');
end;
$$;

-- The web catalog already publishes these questions. Recheck any mirrored bank item
-- and protected assessments before using the catalog copy.
create function public.can_share_catalog_question_v1(p_course_code text, p_key text, p_prompt text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.courses c
    where c.code = p_course_code
      and (
        not c.active
        or private.study_question_is_protected(c.id,
          (select id from public.questions where course_id = c.id and logical_key = p_key), p_prompt)
        or exists (
          select 1 from public.questions q join public.question_versions v on v.question_id = q.id
          where q.course_id = c.id and q.logical_key = p_key and v.prompt = p_prompt and v.status = 'retired'
            and not exists (
              select 1 from public.question_versions live
              where live.question_id = q.id and live.prompt = p_prompt and live.status = 'published'
                and live.usage && array['practice', 'review']
            )
        )
      )
  );
$$;

revoke all on function private.study_question_is_protected(uuid, uuid, text),
  private.shared_study_payload(text, uuid, integer),
  public.create_shared_study_link_v1(text, uuid, integer),
  public.read_shared_study_link_v1(uuid, text),
  public.can_share_catalog_question_v1(text, text, text) from public, anon, authenticated;
grant execute on function public.create_shared_study_link_v1(text, uuid, integer) to authenticated;
grant execute on function public.read_shared_study_link_v1(uuid, text),
  public.can_share_catalog_question_v1(text, text, text) to anon, authenticated;