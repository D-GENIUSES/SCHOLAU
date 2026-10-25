-- Fill-in-gap questions use gap_answers, not MCQ options; align publish validation with import rules.

create or replace function private.publish_question_version(p_version_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.question_versions;
  q public.questions;
  v_options integer;
  v_field jsonb := '{}'::jsonb;
begin
  select * into v from public.question_versions where id = p_version_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Question version not found.');
  end if;
  if v.status = 'published' then
    return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', v.status, 'already_published', true);
  end if;
  if v.status <> 'draft' then
    perform private.raise_error('INVALID_STATE', 'Retired versions cannot be republished; create a new draft.');
  end if;
  if not private.user_is_admin(p_actor_id) then
    perform private.raise_error('FORBIDDEN', 'A reviewer with admin role is required.');
  end if;
  select * into q from public.questions where id = v.question_id;

  if v.answer_format = 'fill_in_gap' then
    if not exists (
      select 1
      from private.question_answer_keys k
      where k.question_version_id = v.id
        and jsonb_typeof(k.gap_answers) = 'array'
        and jsonb_array_length(k.gap_answers) >= 1
        and exists (
          select 1
          from jsonb_array_elements(k.gap_answers) g
          where jsonb_typeof(g -> 'accepted_answers') = 'array'
            and jsonb_array_length(g -> 'accepted_answers') >= 1
        )
    ) then
      v_field := v_field || jsonb_build_object('gap_answers', 'at least one gap with accepted answers required');
    end if;
  else
    select count(*) into v_options from public.question_options where question_version_id = v.id;
    if q.pool = 'battle' and v_options <> 4 then
      v_field := v_field || jsonb_build_object('options', 'Battles require exactly four options.');
    end if;
    if q.pool = 'battle' and v.answer_format = 'worked_solution' and exists (
      select 1 from public.question_options o where o.question_version_id = v.id and cardinality(o.steps) = 0
    ) then
      v_field := v_field || jsonb_build_object('steps', 'Each solution must include its calculation steps.');
    end if;
    if v_options < 2 then
      v_field := v_field || jsonb_build_object('options', 'at least two options required');
    end if;
    if not exists (
      select 1 from private.question_answer_keys k
      where k.question_version_id = v.id and k.correct_option_id is not null
    ) then
      v_field := v_field || jsonb_build_object('correct_option', 'exactly one answer key required');
    end if;
  end if;

  if coalesce(length(btrim(v.source_reference)), 0) = 0 then
    v_field := v_field || jsonb_build_object('source_reference', 'required');
  end if;
  if q.pool = 'battle' and v.usage <> array['battle']::text[] then
    v_field := v_field || jsonb_build_object('usage', 'battle-pool questions must have usage [battle] only');
  end if;
  if q.pool = 'learning' and 'battle' = any (v.usage) then
    v_field := v_field || jsonb_build_object('usage', 'learning-pool questions cannot be used in battles');
  end if;
  if q.lesson_id is not null and not exists (select 1 from public.lessons l where l.id = q.lesson_id and l.course_id = q.course_id) then
    v_field := v_field || jsonb_build_object('lesson_id', 'lesson belongs to a different course');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Question version failed publish validation.', v_field);
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.question_versions
     set status = 'retired', retired_at = now(), retired_by = p_actor_id, retired_reason = 'superseded'
   where question_id = v.question_id and status = 'published';
  update public.question_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, p_actor_id), published_at = now()
   where id = p_version_id;
  perform set_config('scholau.allow_publish', 'off', true);
  return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', 'published', 'already_published', false);
end;
$$;
