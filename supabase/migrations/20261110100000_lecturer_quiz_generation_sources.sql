-- Published lesson text for lecturer quiz question generation from selected topics.

create or replace function private.lesson_blocks_teaching_text(p_blocks jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_block jsonb;
  v_parts text[] := array[]::text[];
  v_items text[];
  v_step jsonb;
  v_chunk text;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    return '';
  end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    case v_block->>'type'
      when 'heading', 'paragraph' then
        v_chunk := nullif(trim(coalesce(v_block->>'text', '')), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      when 'callout' then
        v_chunk := nullif(trim(concat_ws(
          E'\n',
          nullif(trim(coalesce(v_block->>'title', '')), ''),
          nullif(trim(coalesce(v_block->>'text', '')), '')
        )), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      when 'list' then
        select coalesce(array_agg(nullif(trim(value #>> '{}'), '') order by ordinality), array[]::text[])
          into v_items
        from jsonb_array_elements(coalesce(v_block->'items', '[]'::jsonb)) with ordinality;
        v_chunk := nullif(trim(array_to_string(array_remove(v_items, null), E'\n')), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      when 'equation' then
        v_chunk := nullif(trim(concat_ws(
          ' — ',
          nullif(trim(coalesce(v_block->>'expression', '')), ''),
          nullif(trim(coalesce(v_block->>'reading', '')), '')
        )), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      when 'worked_example' then
        v_chunk := nullif(trim(concat_ws(
          E'\n',
          nullif(trim(coalesce(v_block->>'title', '')), ''),
          nullif(trim(coalesce(v_block->>'problem', '')), '')
        )), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
        for v_step in select value from jsonb_array_elements(coalesce(v_block->'steps', '[]'::jsonb))
        loop
          v_chunk := nullif(trim(concat_ws(
            ' — ',
            nullif(trim(coalesce(v_step->>'calculation', '')), ''),
            nullif(trim(coalesce(v_step->>'explanation', '')), ''),
            nullif(trim(coalesce(v_step->>'reading', '')), '')
          )), '');
          if v_chunk is not null then
            v_parts := v_parts || v_chunk;
          end if;
        end loop;
        v_chunk := nullif(trim(coalesce(v_block->>'answer', '')), '');
        if v_chunk is not null then
          v_parts := v_parts || ('Answer: ' || v_chunk);
        end if;
      when 'code' then
        v_chunk := nullif(trim(coalesce(v_block->>'code', '')), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      when 'image' then
        v_chunk := nullif(trim(coalesce(v_block->>'alt', '')), '');
        if v_chunk is not null then
          v_parts := v_parts || v_chunk;
        end if;
      else
        -- Skip checkpoints and unknown blocks (answer keys stay out of generation context).
        null;
    end case;
  end loop;

  return trim(array_to_string(v_parts, E'\n\n'));
end;
$$;

create or replace function public.get_lecturer_quiz_generation_sources_v1(
  p_offering_id uuid,
  p_module_ids uuid[] default '{}',
  p_lesson_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_course public.courses;
  v_module_ids uuid[] := coalesce(p_module_ids, '{}');
  v_lesson_ids uuid[] := coalesce(p_lesson_ids, '{}');
  v_sources jsonb;
begin
  if not private.challenge_teacher(p_offering_id, v_uid) then
    perform private.raise_error('FORBIDDEN');
  end if;

  select * into v_offering
  from public.course_offerings
  where id = p_offering_id and status = 'published';
  if not found then
    perform private.raise_error('NOT_FOUND');
  end if;

  select * into v_course from public.courses where id = v_offering.course_id;

  if cardinality(v_module_ids) = 0 and cardinality(v_lesson_ids) = 0 then
    perform private.raise_error(
      'VALIDATION_FAILED',
      'Select at least one topic or lesson.',
      jsonb_build_object('selection', 'required')
    );
  end if;

  -- Reject ids that do not belong to this course.
  if exists (
    select 1
    from unnest(v_module_ids) mid
    where not exists (
      select 1 from public.modules m
      where m.id = mid and m.course_id = v_offering.course_id
    )
  ) or exists (
    select 1
    from unnest(v_lesson_ids) lid
    where not exists (
      select 1 from public.lessons l
      where l.id = lid and l.course_id = v_offering.course_id
    )
  ) then
    perform private.raise_error(
      'VALIDATION_FAILED',
      'Choose topics from this course.',
      jsonb_build_object('selection', 'foreign')
    );
  end if;

  with selected_lessons as (
    select distinct l.id as lesson_id
    from public.lessons l
    where l.course_id = v_offering.course_id
      and (
        l.id = any (v_lesson_ids)
        or l.module_id = any (v_module_ids)
      )
  ),
  published as (
    select
      l.id as lesson_id,
      m.position as module_position,
      l.position as lesson_position,
      m.title as module_title,
      lv.title as lesson_title,
      coalesce(lv.objective, '') as objective,
      private.lesson_blocks_teaching_text(lv.blocks) as text
    from selected_lessons s
    join public.lessons l on l.id = s.lesson_id
    join public.modules m on m.id = l.module_id
    cross join lateral (
      select v.*
      from public.lesson_versions v
      where v.lesson_id = l.id and v.status = 'published'
      order by v.version desc
      limit 1
    ) lv
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'lesson_id', p.lesson_id,
    'module_title', p.module_title,
    'lesson_title', p.lesson_title,
    'objective', p.objective,
    'text', left(p.text, 12000)
  ) order by p.module_position, p.lesson_position), '[]'::jsonb)
  into v_sources
  from published p
  where length(trim(p.text)) > 0;

  if v_sources = '[]'::jsonb then
    perform private.raise_error(
      'VALIDATION_FAILED',
      'No published lesson content for the selected topics.',
      jsonb_build_object('sources', 'empty')
    );
  end if;

  return private.envelope(jsonb_build_object(
    'course_code', v_course.code,
    'course_title', v_course.title,
    'sources', v_sources
  ));
end;
$$;

revoke all on function private.lesson_blocks_teaching_text(jsonb) from public, anon, authenticated;
revoke all on function public.get_lecturer_quiz_generation_sources_v1(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.get_lecturer_quiz_generation_sources_v1(uuid, uuid[], uuid[]) to authenticated;
