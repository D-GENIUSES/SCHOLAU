-- Lecturer lesson editor: expose one lesson's current version and save immutable-safe drafts.

create or replace function public.get_lecturer_lesson_editor_v1(p_offering_id uuid, p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_lesson public.lessons;
  v_version public.lesson_versions;
begin
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_lesson from public.lessons where id = p_lesson_id and course_id = v_offering.course_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;

  select * into v_version
  from public.lesson_versions
  where lesson_id = p_lesson_id and status in ('draft', 'published')
  order by version desc limit 1;
  if not found then perform private.raise_error('NOT_FOUND', 'Lesson content is not available.'); end if;

  return private.envelope(jsonb_build_object(
    'lesson_id', v_lesson.id,
    'version_id', v_version.id,
    'version_status', v_version.status,
    'title', v_version.title,
    'objective', v_version.objective,
    'blocks', v_version.blocks,
    'estimated_minutes', v_version.estimated_minutes,
    'source_reference', v_version.source_reference
  ));
end;
$$;

create or replace function public.lecturer_save_lesson_draft_v1(
  p_offering_id uuid,
  p_lesson_id uuid,
  p_title text,
  p_objective text,
  p_blocks jsonb,
  p_estimated_minutes integer,
  p_source_reference text,
  p_request_key uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_lesson public.lessons;
  v_latest public.lesson_versions;
  v_version_id uuid;
  v_version integer;
  v_errors text[];
  v_title text := btrim(coalesce(p_title, ''));
  v_objective text := btrim(coalesce(p_objective, ''));
  v_source text := nullif(btrim(coalesce(p_source_reference, '')), '');
begin
  perform private.require_request_key(p_request_key);
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_lesson from public.lessons where id = p_lesson_id and course_id = v_offering.course_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;

  if length(v_title) not between 1 and 200
    or length(v_objective) not between 1 and 1000
    or p_estimated_minutes is null or p_estimated_minutes not between 1 and 240
    or length(coalesce(v_source, '')) > 500 then
    perform private.raise_error('VALIDATION_FAILED', 'Check the lesson title, objective, duration, and source.');
  end if;
  v_errors := private.validate_lesson_blocks(p_blocks);
  if cardinality(v_errors) > 0 then
    perform private.raise_error('VALIDATION_FAILED', array_to_string(v_errors, '; '));
  end if;

  select * into v_latest from public.lesson_versions
  where lesson_id = p_lesson_id and status in ('draft', 'published')
  order by version desc limit 1 for update;
  if not found then perform private.raise_error('NOT_FOUND', 'Lesson content is not available.'); end if;

  if v_latest.status = 'draft' then
    v_version_id := v_latest.id;
    v_version := v_latest.version;
    update public.lesson_versions
       set title = v_title,
           objective = v_objective,
           blocks = p_blocks,
           estimated_minutes = p_estimated_minutes,
           source_reference = coalesce(v_source, 'Lecturer edited lesson'),
           reviewed_by = null
     where id = v_version_id;
  else
    v_version := v_latest.version + 1;
    insert into public.lesson_versions (
      lesson_id, version, title, objective, blocks, estimated_minutes, source_reference
    ) values (
      p_lesson_id, v_version, v_title, v_objective, p_blocks, p_estimated_minutes,
      coalesce(v_source, 'Lecturer edited lesson')
    ) returning id into v_version_id;
  end if;

  perform private.audit(v_uid, 'lecturer_save_lesson_draft', 'lesson_version', v_version_id, p_request_key);
  return private.envelope(jsonb_build_object(
    'lesson_id', p_lesson_id, 'lesson_version_id', v_version_id,
    'version', v_version, 'status', 'draft'
  ), p_request_key);
end;
$$;

revoke all on function public.get_lecturer_lesson_editor_v1(uuid, uuid),
  public.lecturer_save_lesson_draft_v1(uuid, uuid, text, text, jsonb, integer, text, uuid)
  from public, anon;
grant execute on function public.get_lecturer_lesson_editor_v1(uuid, uuid),
  public.lecturer_save_lesson_draft_v1(uuid, uuid, text, text, jsonb, integer, text, uuid)
  to authenticated;
