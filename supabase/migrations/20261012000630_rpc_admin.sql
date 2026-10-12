-- ScholAu migration 6d: publishing workflow, admin RPCs, imports, corrections, entitlements, worker.
-- Admin is an application role checked server-side (private.require_admin), never a DB superuser.
-- Every admin mutation writes private.audit_log.

-- ---------------------------------------------------------------------------
-- Publishing (internal; called by admin_publish_v1 and local seed)
-- ---------------------------------------------------------------------------
create or replace function private.publish_lesson_version(p_version_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lesson_versions;
  v_errors text[];
  v_field jsonb := '{}'::jsonb;
begin
  select * into v from public.lesson_versions where id = p_version_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Lesson version not found.');
  end if;
  if v.status = 'published' then
    return jsonb_build_object('entity_type', 'lesson_version', 'id', v.id, 'status', v.status, 'already_published', true);
  end if;
  if v.status <> 'draft' then
    perform private.raise_error('INVALID_STATE', 'Retired versions cannot be republished; create a new draft.');
  end if;
  if not private.user_is_admin(p_actor_id) then
    perform private.raise_error('FORBIDDEN', 'A reviewer with admin role is required.');
  end if;
  v_errors := private.validate_lesson_blocks(v.blocks);
  if cardinality(v_errors) > 0 then
    v_field := v_field || jsonb_build_object('blocks', to_jsonb(v_errors));
  end if;
  if coalesce(length(btrim(v.source_reference)), 0) = 0 then
    v_field := v_field || jsonb_build_object('source_reference', 'required');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Lesson version failed publish validation.', v_field);
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.lesson_versions
     set status = 'retired', retired_at = now(), retired_by = p_actor_id, retired_reason = 'superseded'
   where lesson_id = v.lesson_id and status = 'published';
  update public.lesson_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, p_actor_id), published_at = now()
   where id = p_version_id;
  perform set_config('scholau.allow_publish', 'off', true);
  return jsonb_build_object('entity_type', 'lesson_version', 'id', v.id, 'status', 'published', 'already_published', false);
end;
$$;

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

  select count(*) into v_options from public.question_options where question_version_id = v.id;
  if v_options < 2 then
    v_field := v_field || jsonb_build_object('options', 'at least two options required');
  end if;
  if not exists (select 1 from private.question_answer_keys k where k.question_version_id = v.id) then
    v_field := v_field || jsonb_build_object('correct_option', 'exactly one answer key required');
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

create or replace function private.publish_assessment_version(p_version_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.assessment_versions;
  a public.assessments;
  v_eligible integer;
  v_bad jsonb;
  v_field jsonb := '{}'::jsonb;
begin
  select * into v from public.assessment_versions where id = p_version_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Assessment version not found.');
  end if;
  if v.status = 'published' then
    return jsonb_build_object('entity_type', 'assessment_version', 'id', v.id, 'status', v.status, 'already_published', true);
  end if;
  if v.status <> 'draft' then
    perform private.raise_error('INVALID_STATE', 'Retired versions cannot be republished; create a new draft.');
  end if;
  if not private.user_is_admin(p_actor_id) then
    perform private.raise_error('FORBIDDEN', 'A reviewer with admin role is required.');
  end if;
  select * into a from public.assessments where id = v.assessment_id;

  select coalesce(jsonb_agg(aq.question_version_id), '[]'::jsonb) into v_bad
  from public.assessment_questions aq
  join public.question_versions qv on qv.id = aq.question_version_id
  join public.questions q on q.id = qv.question_id
  where aq.assessment_version_id = v.id
    and (qv.status <> 'published' or q.pool <> 'learning' or q.course_id <> a.course_id or not (a.kind = any (qv.usage)));
  if jsonb_array_length(v_bad) > 0 then
    v_field := v_field || jsonb_build_object('questions', jsonb_build_object(
      'message', 'questions must be published learning-pool questions of this course with matching usage',
      'question_version_ids', v_bad));
  end if;

  select count(*) into v_eligible from public.assessment_questions aq where aq.assessment_version_id = v.id;
  if v_eligible < v.question_count then
    v_field := v_field || jsonb_build_object('question_count', format('needs %s questions, has %s', v.question_count, v_eligible));
  end if;
  if a.kind = 'review' and v.feedback_mode <> 'immediate' then
    v_field := v_field || jsonb_build_object('feedback_mode', 'review must use immediate feedback');
  end if;
  if a.kind in ('practice', 'mock') and v.feedback_mode <> 'after_submit' then
    v_field := v_field || jsonb_build_object('feedback_mode', 'practice/mock must use after_submit feedback');
  end if;
  if a.kind = 'mock' and v.duration_seconds is null then
    v_field := v_field || jsonb_build_object('duration_seconds', 'mock exams require a duration');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Assessment version failed publish validation.', v_field);
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.assessment_versions
     set status = 'retired', retired_at = now(), retired_by = p_actor_id, retired_reason = 'superseded'
   where assessment_id = v.assessment_id and status = 'published';
  update public.assessment_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, p_actor_id), published_at = now()
   where id = p_version_id;
  perform set_config('scholau.allow_publish', 'off', true);
  return jsonb_build_object('entity_type', 'assessment_version', 'id', v.id, 'status', 'published', 'already_published', false);
end;
$$;

create or replace function public.admin_publish_v1(p_entity_type text, p_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_result jsonb;
  v_offering public.course_offerings;
begin
  perform private.require_request_key(p_request_key);
  case p_entity_type
    when 'lesson_version' then v_result := private.publish_lesson_version(p_id, v_uid);
    when 'question_version' then v_result := private.publish_question_version(p_id, v_uid);
    when 'assessment_version' then v_result := private.publish_assessment_version(p_id, v_uid);
    when 'course_offering' then
      select * into v_offering from public.course_offerings where id = p_id for update;
      if not found then
        perform private.raise_error('NOT_FOUND');
      end if;
      if v_offering.status = 'retired' then
        perform private.raise_error('INVALID_STATE', 'Retired offerings cannot be republished.');
      end if;
      update public.course_offerings set status = 'published' where id = p_id;
      v_result := jsonb_build_object('entity_type', 'course_offering', 'id', p_id, 'status', 'published',
                                     'already_published', v_offering.status = 'published');
    when 'battle_rules' then
      update public.battle_rules set published_at = coalesce(published_at, now()) where id = p_id;
      if not found then
        perform private.raise_error('NOT_FOUND');
      end if;
      v_result := jsonb_build_object('entity_type', 'battle_rules', 'id', p_id, 'status', 'published');
    else
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('entity_type', 'unsupported'));
  end case;
  perform private.audit(v_uid, 'publish', p_entity_type, p_id, p_request_key);
  return private.envelope(v_result, p_request_key);
end;
$$;

create or replace function public.admin_retire_v1(p_entity_type text, p_id uuid, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_count integer;
begin
  perform private.require_request_key(p_request_key);
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;
  case p_entity_type
    when 'lesson_version' then
      update public.lesson_versions set status = 'retired', retired_at = now(), retired_by = v_uid, retired_reason = p_reason
      where id = p_id and status = 'published';
    when 'question_version' then
      update public.question_versions set status = 'retired', retired_at = now(), retired_by = v_uid, retired_reason = p_reason
      where id = p_id and status = 'published';
    when 'assessment_version' then
      update public.assessment_versions set status = 'retired', retired_at = now(), retired_by = v_uid, retired_reason = p_reason
      where id = p_id and status = 'published';
    when 'course_offering' then
      update public.course_offerings set status = 'retired' where id = p_id and status <> 'retired';
    else
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('entity_type', 'unsupported'));
  end case;
  get diagnostics v_count = row_count;
  perform private.audit(v_uid, 'retire', p_entity_type, p_id, p_request_key, p_reason);
  return private.envelope(jsonb_build_object('entity_type', p_entity_type, 'id', p_id, 'retired', v_count > 0), p_request_key);
end;
$$;

-- Privileged reviewed access to a question version including its answer key.
create or replace function public.admin_get_question_v1(p_question_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_result jsonb;
begin
  select jsonb_build_object(
    'question_id', q.id, 'course_id', q.course_id, 'lesson_id', q.lesson_id, 'pool', q.pool, 'logical_key', q.logical_key,
    'question_version_id', qv.id, 'version', qv.version, 'status', qv.status, 'prompt', qv.prompt,
    'difficulty', qv.difficulty, 'usage', to_jsonb(qv.usage), 'source_reference', qv.source_reference,
    'reviewed_by', qv.reviewed_by, 'published_at', qv.published_at,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body, 'position', o.position)
                                          order by o.position), '[]'::jsonb)
                from public.question_options o where o.question_version_id = qv.id),
    'correct_option_id', k.correct_option_id,
    'explanation', k.explanation)
  into v_result
  from public.question_versions qv
  join public.questions q on q.id = qv.question_id
  left join private.question_answer_keys k on k.question_version_id = qv.id
  where qv.id = p_question_version_id;
  if v_result is null then
    perform private.raise_error('NOT_FOUND');
  end if;
  return private.envelope(v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Imports (validate every row first; import transactionally only when all rows are valid)
-- ---------------------------------------------------------------------------
-- Question rows (CSV columns or JSON):
--   course_code, logical_question_key, pool, usage ("review|practice" or array), difficulty, prompt,
--   option_a..option_d  OR  options: [{label?, body}],  correct_option (label), explanation,
--   source_reference, lesson_id (optional uuid)
create or replace function public.admin_import_questions_v1(p_rows jsonb, p_dry_run boolean default true, p_request_key uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row jsonb;
  v_i integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_course uuid;
  v_key text;
  v_pool text;
  v_usage text[];
  v_options jsonb;
  v_correct text;
  v_lesson uuid;
  v_seen text[] := '{}';
  v_question public.questions;
  v_latest public.question_versions;
  v_version_id uuid;
  v_version integer;
  v_opt jsonb;
  v_n integer;
  v_correct_id uuid;
  v_pass integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'rows must be a JSON array.', jsonb_build_object('rows', 'invalid'));
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    perform private.raise_error('VALIDATION_FAILED', 'At most 2000 rows per import.', jsonb_build_object('rows', 'too_many'));
  end if;
  if not coalesce(p_dry_run, true) then
    perform private.require_request_key(p_request_key);
    if exists (select 1 from private.audit_log where actor_id = v_uid and action = 'import_questions' and request_key = p_request_key) then
      return private.envelope((select safe_metadata from private.audit_log
                               where actor_id = v_uid and action = 'import_questions' and request_key = p_request_key), p_request_key);
    end if;
  end if;

  -- pass 1 validates; pass 2 writes (only when not dry run and no errors)
  for v_pass in 1..2 loop
    exit when v_pass = 2 and (coalesce(p_dry_run, true) or jsonb_array_length(v_errors) > 0);
    v_i := 0;
    v_seen := '{}';
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_i := v_i + 1;
      v_course := (select c.id from public.courses c where c.code = v_row ->> 'course_code');
      v_key := btrim(coalesce(v_row ->> 'logical_question_key', ''));
      v_pool := lower(btrim(coalesce(v_row ->> 'pool', '')));
      if jsonb_typeof(v_row -> 'usage') = 'array' then
        v_usage := array(select lower(btrim(x)) from jsonb_array_elements_text(v_row -> 'usage') x where btrim(x) <> '');
      else
        v_usage := array(select lower(btrim(x)) from regexp_split_to_table(coalesce(v_row ->> 'usage', ''), '[|;,]') x where btrim(x) <> '');
      end if;
      if jsonb_typeof(v_row -> 'options') = 'array' then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'label', upper(coalesce(nullif(btrim(o.value ->> 'label'), ''), chr(64 + o.n::integer))),
                 'body', btrim(coalesce(o.value ->> 'body', o.value #>> '{}'))) order by o.n), '[]'::jsonb)
          into v_options
          from jsonb_array_elements(v_row -> 'options') with ordinality as o(value, n);
      else
        select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'body', btrim(v_row ->> x.col)) order by x.label), '[]'::jsonb)
          into v_options
          from (values ('A', 'option_a'), ('B', 'option_b'), ('C', 'option_c'), ('D', 'option_d'), ('E', 'option_e'), ('F', 'option_f')) x(label, col)
          where coalesce(btrim(v_row ->> x.col), '') <> '';
      end if;
      v_correct := upper(btrim(coalesce(v_row ->> 'correct_option', '')));
      begin
        v_lesson := nullif(v_row ->> 'lesson_id', '')::uuid;
      exception when others then
        v_lesson := null;
        if v_pass = 1 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_id', 'message', 'must be a uuid');
        end if;
      end;

      if v_pass = 1 then
        if v_course is null then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'course_code', 'message', 'unknown course code');
        end if;
        if v_key = '' or length(v_key) > 120 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'logical_question_key', 'message', 'required (max 120 chars)');
        elsif (coalesce(v_row ->> 'course_code', '') || '/' || v_key) = any (v_seen) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'logical_question_key', 'message', 'duplicate key in this import');
        end if;
        v_seen := v_seen || (coalesce(v_row ->> 'course_code', '') || '/' || v_key);
        if v_pool not in ('learning', 'battle') then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'pool', 'message', 'must be learning or battle');
        end if;
        if cardinality(v_usage) = 0 or not (v_usage <@ array['review', 'practice', 'mock', 'battle']) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'must be review/practice/mock/battle');
        elsif v_pool = 'battle' and v_usage <> array['battle'] then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'battle pool requires usage battle only');
        elsif v_pool = 'learning' and 'battle' = any (v_usage) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'usage', 'message', 'learning pool cannot include battle');
        end if;
        if coalesce(v_row ->> 'difficulty', '') not in ('beginner', 'intermediate', 'advanced') then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'difficulty', 'message', 'must be beginner/intermediate/advanced');
        end if;
        if coalesce(length(btrim(v_row ->> 'prompt')), 0) not between 1 and 2000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'prompt', 'message', 'required (max 2000 chars)');
        end if;
        if jsonb_array_length(v_options) < 2 or jsonb_array_length(v_options) > 6 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'between 2 and 6 options required');
        elsif exists (select 1 from jsonb_array_elements(v_options) o
                      where coalesce(length(o ->> 'body'), 0) not between 1 and 1000 or length(o ->> 'label') > 4) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'option text required (max 1000 chars)');
        elsif (select count(distinct o ->> 'label') from jsonb_array_elements(v_options) o) <> jsonb_array_length(v_options) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'option labels must be unique');
        end if;
        if not exists (select 1 from jsonb_array_elements(v_options) o where o ->> 'label' = v_correct) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'correct_option', 'message', 'must match exactly one option label');
        end if;
        if coalesce(length(btrim(v_row ->> 'explanation')), 0) not between 1 and 4000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'explanation', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row ->> 'source_reference')), 0) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'source_reference', 'message', 'required');
        end if;
        if v_lesson is not null and v_course is not null
           and not exists (select 1 from public.lessons l where l.id = v_lesson and l.course_id = v_course) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_id', 'message', 'lesson not in course');
        end if;
        if v_course is not null and v_key <> '' and exists (
            select 1 from public.questions q where q.course_id = v_course and q.logical_key = v_key and q.pool <> v_pool) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'pool', 'message', 'existing question has a different pool');
        end if;
      else
        insert into public.questions (course_id, lesson_id, pool, logical_key)
        values (v_course, v_lesson, v_pool, v_key)
        on conflict (course_id, logical_key) do update set lesson_id = coalesce(excluded.lesson_id, public.questions.lesson_id)
        returning * into v_question;

        select * into v_latest from public.question_versions
        where question_id = v_question.id order by version desc limit 1 for update;
        if found and v_latest.status = 'draft' then
          v_version_id := v_latest.id;
          v_version := v_latest.version;
          delete from private.question_answer_keys where question_version_id = v_version_id;
          delete from public.question_options where question_version_id = v_version_id;
          update public.question_versions
             set prompt = btrim(v_row ->> 'prompt'), difficulty = v_row ->> 'difficulty', usage = v_usage,
                 source_reference = btrim(v_row ->> 'source_reference'), reviewed_by = null
           where id = v_version_id;
        else
          v_version := coalesce(v_latest.version, 0) + 1;
          insert into public.question_versions (question_id, version, prompt, difficulty, usage, source_reference)
          values (v_question.id, v_version, btrim(v_row ->> 'prompt'), v_row ->> 'difficulty', v_usage,
                  btrim(v_row ->> 'source_reference'))
          returning id into v_version_id;
        end if;

        v_n := 0;
        v_correct_id := null;
        for v_opt in select value from jsonb_array_elements(v_options) loop
          v_n := v_n + 1;
          if v_opt ->> 'label' = v_correct then
            insert into public.question_options (question_version_id, label, body, position)
            values (v_version_id, v_opt ->> 'label', v_opt ->> 'body', v_n)
            returning id into v_correct_id;
          else
            insert into public.question_options (question_version_id, label, body, position)
            values (v_version_id, v_opt ->> 'label', v_opt ->> 'body', v_n);
          end if;
        end loop;
        insert into private.question_answer_keys (question_version_id, correct_option_id, explanation)
        values (v_version_id, v_correct_id, btrim(v_row ->> 'explanation'));

        v_created := v_created || jsonb_build_object('row', v_i, 'question_id', v_question.id,
                                                     'question_version_id', v_version_id, 'version', v_version);
      end if;
    end loop;
  end loop;

  declare
    v_result jsonb := jsonb_build_object(
      'dry_run', coalesce(p_dry_run, true),
      'valid', jsonb_array_length(v_errors) = 0,
      'row_count', jsonb_array_length(p_rows),
      'error_count', jsonb_array_length(v_errors),
      'errors', v_errors,
      'imported', jsonb_array_length(v_created) > 0,
      'created', v_created);
  begin
    if not coalesce(p_dry_run, true) and jsonb_array_length(v_errors) = 0 then
      perform private.audit(v_uid, 'import_questions', 'question_import', null, p_request_key, null, v_result);
    end if;
    return private.envelope(v_result, p_request_key);
  end;
end;
$$;

-- Lesson rows (JSON): course_code, module_position, module_title, lesson_position, title, objective,
--   estimated_minutes, blocks (array of structured blocks), source_reference
create or replace function public.admin_import_lessons_v1(p_rows jsonb, p_dry_run boolean default true, p_request_key uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row jsonb;
  v_i integer;
  v_pass integer;
  v_errors jsonb := '[]'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_course uuid;
  v_block_errors text[];
  v_module public.modules;
  v_lesson public.lessons;
  v_latest public.lesson_versions;
  v_version_id uuid;
  v_version integer;
  v_seen text[];
  v_mpos integer;
  v_lpos integer;
  v_minutes integer;
  v_result jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'rows must be a JSON array.', jsonb_build_object('rows', 'invalid'));
  end if;
  if jsonb_array_length(p_rows) > 500 then
    perform private.raise_error('VALIDATION_FAILED', 'At most 500 rows per import.', jsonb_build_object('rows', 'too_many'));
  end if;
  if not coalesce(p_dry_run, true) then
    perform private.require_request_key(p_request_key);
    if exists (select 1 from private.audit_log where actor_id = v_uid and action = 'import_lessons' and request_key = p_request_key) then
      return private.envelope((select safe_metadata from private.audit_log
                               where actor_id = v_uid and action = 'import_lessons' and request_key = p_request_key), p_request_key);
    end if;
  end if;

  for v_pass in 1..2 loop
    exit when v_pass = 2 and (coalesce(p_dry_run, true) or jsonb_array_length(v_errors) > 0);
    v_i := 0;
    v_seen := '{}';
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_i := v_i + 1;
      v_course := (select c.id from public.courses c where c.code = v_row ->> 'course_code');
      begin
        v_mpos := (v_row ->> 'module_position')::integer;
        v_lpos := (v_row ->> 'lesson_position')::integer;
        v_minutes := (v_row ->> 'estimated_minutes')::integer;
      exception when others then
        v_mpos := null; v_lpos := null; v_minutes := null;
      end;
      if v_pass = 1 then
        if v_course is null then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'course_code', 'message', 'unknown course code');
        end if;
        if v_mpos is null or v_mpos < 1 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'module_position', 'message', 'positive integer required');
        end if;
        if v_lpos is null or v_lpos < 1 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_position', 'message', 'positive integer required');
        end if;
        if (coalesce(v_row ->> 'course_code', '') || '/' || coalesce(v_mpos::text, '?') || '/' || coalesce(v_lpos::text, '?')) = any (v_seen) then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_position', 'message', 'duplicate lesson position in this import');
        end if;
        v_seen := v_seen || (coalesce(v_row ->> 'course_code', '') || '/' || coalesce(v_mpos::text, '?') || '/' || coalesce(v_lpos::text, '?'));
        if coalesce(length(btrim(v_row ->> 'module_title')), 0) not between 1 and 200 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'module_title', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row ->> 'title')), 0) not between 1 and 200 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'title', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row ->> 'objective')), 0) not between 1 and 1000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'objective', 'message', 'required');
        end if;
        if v_minutes is null or v_minutes < 1 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'estimated_minutes', 'message', 'positive integer required');
        end if;
        v_block_errors := private.validate_lesson_blocks(v_row -> 'blocks');
        if cardinality(v_block_errors) > 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'blocks', 'message', array_to_string(v_block_errors, '; '));
        end if;
        if coalesce(length(btrim(v_row ->> 'source_reference')), 0) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'source_reference', 'message', 'required');
        end if;
      else
        insert into public.modules (course_id, title, position) values (v_course, btrim(v_row ->> 'module_title'), v_mpos)
        on conflict (course_id, position) do update set title = excluded.title
        returning * into v_module;
        insert into public.lessons (course_id, module_id, position) values (v_course, v_module.id, v_lpos)
        on conflict (module_id, position) do update set position = excluded.position
        returning * into v_lesson;

        select * into v_latest from public.lesson_versions where lesson_id = v_lesson.id order by version desc limit 1 for update;
        if found and v_latest.status = 'draft' then
          v_version_id := v_latest.id;
          v_version := v_latest.version;
          update public.lesson_versions
             set title = btrim(v_row ->> 'title'), objective = btrim(v_row ->> 'objective'), blocks = v_row -> 'blocks',
                 estimated_minutes = v_minutes, source_reference = btrim(v_row ->> 'source_reference'), reviewed_by = null
           where id = v_version_id;
        else
          v_version := coalesce(v_latest.version, 0) + 1;
          insert into public.lesson_versions (lesson_id, version, title, objective, blocks, estimated_minutes, source_reference)
          values (v_lesson.id, v_version, btrim(v_row ->> 'title'), btrim(v_row ->> 'objective'), v_row -> 'blocks',
                  v_minutes, btrim(v_row ->> 'source_reference'))
          returning id into v_version_id;
        end if;
        v_created := v_created || jsonb_build_object('row', v_i, 'module_id', v_module.id, 'lesson_id', v_lesson.id,
                                                     'lesson_version_id', v_version_id, 'version', v_version);
      end if;
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'dry_run', coalesce(p_dry_run, true),
    'valid', jsonb_array_length(v_errors) = 0,
    'row_count', jsonb_array_length(p_rows),
    'error_count', jsonb_array_length(v_errors),
    'errors', v_errors,
    'imported', jsonb_array_length(v_created) > 0,
    'created', v_created);
  if not coalesce(p_dry_run, true) and jsonb_array_length(v_errors) = 0 then
    perform private.audit(v_uid, 'import_lessons', 'lesson_import', null, p_request_key, null, v_result);
  end if;
  return private.envelope(v_result, p_request_key);
end;
$$;

-- Creates (or replaces the current draft of) an assessment version from chosen question versions.
create or replace function public.admin_upsert_assessment_draft_v1(
  p_assessment_id uuid, p_course_id uuid, p_kind text, p_title text, p_lesson_id uuid,
  p_question_count integer, p_duration_seconds integer, p_question_version_ids uuid[], p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_assessment public.assessments;
  v_latest public.assessment_versions;
  v_version_id uuid;
  v_version integer;
  v_field jsonb := '{}'::jsonb;
begin
  perform private.require_request_key(p_request_key);
  if p_assessment_id is null then
    if p_kind not in ('review', 'practice', 'mock') then
      v_field := v_field || jsonb_build_object('kind', 'invalid');
    end if;
    if coalesce(length(btrim(p_title)), 0) not between 1 and 200 then
      v_field := v_field || jsonb_build_object('title', 'required');
    end if;
    if not exists (select 1 from public.courses where id = p_course_id) then
      v_field := v_field || jsonb_build_object('course_id', 'invalid');
    end if;
    if p_lesson_id is not null and not exists (select 1 from public.lessons where id = p_lesson_id and course_id = p_course_id) then
      v_field := v_field || jsonb_build_object('lesson_id', 'lesson not in course');
    end if;
  end if;
  if p_question_count is null or p_question_count < 1 then
    v_field := v_field || jsonb_build_object('question_count', 'positive integer required');
  end if;
  if p_question_version_ids is null or cardinality(p_question_version_ids) < coalesce(p_question_count, 1) then
    v_field := v_field || jsonb_build_object('question_version_ids', 'at least question_count questions required');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', null, v_field);
  end if;

  if p_assessment_id is null then
    insert into public.assessments (course_id, lesson_id, kind, title)
    values (p_course_id, p_lesson_id, p_kind, btrim(p_title))
    returning * into v_assessment;
  else
    select * into v_assessment from public.assessments where id = p_assessment_id for update;
    if not found then
      perform private.raise_error('NOT_FOUND');
    end if;
  end if;

  if exists (select 1 from unnest(p_question_version_ids) x(id)
             left join public.question_versions qv on qv.id = x.id
             left join public.questions q on q.id = qv.question_id
             where q.id is null or q.course_id <> v_assessment.course_id or q.pool <> 'learning') then
    perform private.raise_error('VALIDATION_FAILED', null,
      jsonb_build_object('question_version_ids', 'all questions must be learning-pool questions of this course'));
  end if;

  select * into v_latest from public.assessment_versions where assessment_id = v_assessment.id order by version desc limit 1 for update;
  if found and v_latest.status = 'draft' then
    v_version_id := v_latest.id;
    v_version := v_latest.version;
    delete from public.assessment_questions where assessment_version_id = v_version_id;
    update public.assessment_versions
       set question_count = p_question_count, duration_seconds = p_duration_seconds,
           feedback_mode = case when v_assessment.kind = 'review' then 'immediate' else 'after_submit' end
     where id = v_version_id;
  else
    v_version := coalesce(v_latest.version, 0) + 1;
    insert into public.assessment_versions (assessment_id, version, question_count, duration_seconds, feedback_mode)
    values (v_assessment.id, v_version, p_question_count, p_duration_seconds,
            case when v_assessment.kind = 'review' then 'immediate' else 'after_submit' end)
    returning id into v_version_id;
  end if;

  insert into public.assessment_questions (assessment_version_id, question_version_id, position)
  select v_version_id, x.id, x.n::integer from unnest(p_question_version_ids) with ordinality x(id, n)
  on conflict do nothing;

  perform private.audit(v_uid, 'upsert_assessment_draft', 'assessment_version', v_version_id, p_request_key);
  return private.envelope(jsonb_build_object('assessment_id', v_assessment.id, 'assessment_version_id', v_version_id,
                                             'version', v_version, 'status', 'draft'), p_request_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Corrections (void with compensating ledger entries; never silent overwrite)
-- ---------------------------------------------------------------------------
create or replace function public.admin_correct_result_v1(p_result_type text, p_result_id uuid, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_state text;
  r record;
  v_amount integer;
  v_comp jsonb := '[]'::jsonb;
begin
  perform private.require_request_key(p_request_key);
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;

  if p_result_type = 'attempt' then
    select status into v_state from public.assessment_attempts where id = p_result_id for update;
    if v_state is null then
      perform private.raise_error('NOT_FOUND');
    end if;
    if v_state = 'active' then
      perform private.raise_error('INVALID_STATE', 'Active attempts cannot be corrected.');
    end if;
    if v_state <> 'voided' then
      update public.assessment_attempts set status = 'voided', voided_reason = p_reason, revision = revision + 1
      where id = p_result_id;
    end if;
  elsif p_result_type = 'battle' then
    select state into v_state from public.battles where id = p_result_id for update;
    if v_state is null then
      perform private.raise_error('NOT_FOUND');
    end if;
    if v_state <> 'finished' and v_state <> 'voided' then
      perform private.raise_error('INVALID_STATE', 'Only finished battles can be voided.');
    end if;
    if v_state = 'finished' then
      update public.battles set state = 'voided', cancel_reason = 'admin_void', revision = revision + 1 where id = p_result_id;
      perform private.battle_event(p_result_id);
    end if;
  else
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('result_type', 'must be attempt or battle'));
  end if;

  for r in
    select l.id, l.user_id from public.points_ledger l
    where l.source_id = p_result_id and l.source_type <> 'correction' and l.amount > 0
    order by l.user_id, l.id
  loop
    v_amount := private.compensate_entry(r.id, v_uid, p_reason);
    if v_amount <> 0 then
      v_comp := v_comp || jsonb_build_object('user_id', r.user_id, 'amount', v_amount, 'adjusts_entry_id', r.id);
      insert into public.notifications (user_id, kind, body, safe_target, event_key)
      values (r.user_id, 'result_corrected', format('A result was corrected by an administrator (%s XP).', v_amount), null,
              'result_corrected:' || r.id::text)
      on conflict (event_key) do nothing;
    end if;
  end loop;

  perform private.audit(v_uid, 'correct_result', p_result_type, p_result_id, p_request_key, p_reason,
                        jsonb_build_object('compensations', v_comp));
  return private.envelope(jsonb_build_object('result_type', p_result_type, 'result_id', p_result_id, 'state', 'voided',
                                             'compensations', v_comp), p_request_key);
end;
$$;

create or replace function public.admin_correct_academic_profile_v1(
  p_user_id uuid, p_university_id uuid, p_faculty_id uuid, p_department_id uuid, p_level_id uuid,
  p_academic_period_id uuid, p_semester_id uuid, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_result jsonb;
begin
  perform private.require_request_key(p_request_key);
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;
  v_result := private.apply_academic_profile(p_user_id, v_uid, p_university_id, p_faculty_id, p_department_id, p_level_id,
                                             p_academic_period_id, p_semester_id, 'admin_correction', btrim(p_reason), p_request_key);
  perform private.audit(v_uid, 'correct_academic_profile', 'profile', p_user_id, p_request_key, p_reason);
  return private.envelope(jsonb_build_object('user_id', p_user_id, 'academic', v_result -> 'academic'), p_request_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles & entitlements (audited)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role_v1(p_user_id uuid, p_role text, p_granted boolean, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
begin
  perform private.require_request_key(p_request_key);
  if p_role not in ('student', 'admin') then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('role', 'invalid'));
  end if;
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    perform private.raise_error('NOT_FOUND');
  end if;
  if p_user_id = v_uid and p_role = 'admin' and not p_granted then
    perform private.raise_error('FORBIDDEN', 'You cannot revoke your own admin role.');
  end if;
  if p_granted then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, v_uid) on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform private.audit(v_uid, case when p_granted then 'grant_role' else 'revoke_role' end, 'user_role', p_user_id,
                        p_request_key, p_reason, jsonb_build_object('role', p_role));
  return private.envelope(jsonb_build_object('user_id', p_user_id,
    'roles', (select coalesce(jsonb_agg(role order by role), '[]'::jsonb) from public.user_roles where user_id = p_user_id)), p_request_key);
end;
$$;

create or replace function public.admin_grant_premium_v1(p_user_id uuid, p_ends_at timestamptz, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_ent public.entitlements;
begin
  perform private.require_request_key(p_request_key);
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;
  if p_ends_at is null or p_ends_at <= now() then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('ends_at', 'must be in the future'));
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    perform private.raise_error('NOT_FOUND');
  end if;
  insert into public.entitlements (user_id, feature, source, source_reference, starts_at, ends_at, granted_by, reason)
  values (p_user_id, 'premium', 'admin', 'admin:' || p_request_key::text, now(), p_ends_at, v_uid, btrim(p_reason))
  on conflict (source, source_reference) do nothing;
  select * into v_ent from public.entitlements where source = 'admin' and source_reference = 'admin:' || p_request_key::text;
  perform private.audit(v_uid, 'grant_premium', 'entitlement', v_ent.id, p_request_key, p_reason,
                        jsonb_build_object('user_id', p_user_id, 'ends_at', p_ends_at));
  return private.envelope(jsonb_build_object('entitlement_id', v_ent.id, 'user_id', v_ent.user_id, 'starts_at', v_ent.starts_at,
                                             'ends_at', v_ent.ends_at, 'premium', private.has_entitlement(p_user_id)), p_request_key);
end;
$$;

create or replace function public.admin_revoke_premium_v1(p_entitlement_id uuid, p_reason text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_ent public.entitlements;
begin
  perform private.require_request_key(p_request_key);
  if coalesce(length(btrim(p_reason)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('reason', 'required'));
  end if;
  update public.entitlements set revoked_at = coalesce(revoked_at, now()), revoked_by = coalesce(revoked_by, v_uid)
  where id = p_entitlement_id
  returning * into v_ent;
  if not found then
    perform private.raise_error('NOT_FOUND');
  end if;
  perform private.audit(v_uid, 'revoke_premium', 'entitlement', p_entitlement_id, p_request_key, p_reason);
  return private.envelope(jsonb_build_object('entitlement_id', v_ent.id, 'revoked_at', v_ent.revoked_at,
                                             'premium', private.has_entitlement(v_ent.user_id)), p_request_key);
end;
$$;

-- Verified payment webhook adapter entry point (server-only; service_role). Deduplicates provider
-- event ids and tolerates out-of-order updates by keeping the latest window per source reference.
create or replace function private.verified_entitlement_upsert(
  p_provider text, p_event_id text, p_payload_hash text, p_user_id uuid, p_source_reference text,
  p_starts_at timestamptz, p_ends_at timestamptz, p_revoked boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_ent public.entitlements;
begin
  if p_provider not in ('paystack', 'flutterwave', 'app_store', 'play_store') then
    raise exception 'unsupported provider %', p_provider;
  end if;
  insert into private.webhook_receipts (provider, event_id, payload_hash) values (p_provider, p_event_id, p_payload_hash)
  on conflict do nothing;
  v_inserted := found;
  if not v_inserted then
    return jsonb_build_object('duplicate', true);
  end if;

  insert into public.entitlements (user_id, feature, source, source_reference, starts_at, ends_at, revoked_at)
  values (p_user_id, 'premium', p_provider, p_source_reference, p_starts_at, p_ends_at, case when p_revoked then now() end)
  on conflict (source, source_reference) do update
    set starts_at = least(public.entitlements.starts_at, excluded.starts_at),
        ends_at = case when public.entitlements.ends_at is null or excluded.ends_at is null then null
                       else greatest(public.entitlements.ends_at, excluded.ends_at) end,
        revoked_at = case when p_revoked then coalesce(public.entitlements.revoked_at, now()) else public.entitlements.revoked_at end
  returning * into v_ent;

  update private.webhook_receipts set state = 'processed', processed_at = now() where provider = p_provider and event_id = p_event_id;
  perform private.audit(null, 'webhook_entitlement', 'entitlement', v_ent.id, null, null,
                        jsonb_build_object('provider', p_provider, 'event_id', p_event_id));
  return jsonb_build_object('duplicate', false, 'entitlement_id', v_ent.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports triage & audit read
-- ---------------------------------------------------------------------------
create or replace function public.admin_triage_report_v1(p_report_id uuid, p_state text, p_resolution text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_report public.content_reports;
begin
  perform private.require_request_key(p_request_key);
  if p_state not in ('triaged', 'resolved', 'dismissed') then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('state', 'invalid'));
  end if;
  if p_state in ('resolved', 'dismissed') and coalesce(length(btrim(p_resolution)), 0) = 0 then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('resolution', 'required'));
  end if;
  update public.content_reports
     set state = p_state, resolution = coalesce(nullif(btrim(p_resolution), ''), resolution),
         resolved_by = case when p_state in ('resolved', 'dismissed') then v_uid else resolved_by end,
         resolved_at = case when p_state in ('resolved', 'dismissed') then now() else resolved_at end
   where id = p_report_id
  returning * into v_report;
  if not found then
    perform private.raise_error('NOT_FOUND');
  end if;
  perform private.audit(v_uid, 'triage_report', 'content_report', p_report_id, p_request_key, p_resolution,
                        jsonb_build_object('state', p_state));
  return private.envelope(jsonb_build_object('report_id', v_report.id, 'state', v_report.state,
                                             'resolved_at', v_report.resolved_at), p_request_key);
end;
$$;

create or replace function public.admin_list_audit_v1(p_entity_type text default null, p_before timestamptz default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
begin
  return private.envelope(jsonb_build_object('items', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
      select a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.reason, a.safe_metadata, a.created_at
      from private.audit_log a
      where (p_entity_type is null or a.entity_type = p_entity_type) and (p_before is null or a.created_at < p_before)
      order by a.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)) x), '[]'::jsonb)));
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker (pg_cron): sweep due state, reconcile reservations, dispatch outbox
-- ---------------------------------------------------------------------------
create or replace function private.reconcile_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_more integer;
begin
  update public.battle_queue set state = 'expired', closed_at = now() where state = 'waiting' and expires_at <= now();
  delete from private.battle_slots s
  where (s.queue_id is not null and exists (select 1 from public.battle_queue q where q.id = s.queue_id and q.state <> 'waiting'))
     or (s.battle_id is not null and exists (select 1 from public.battles b where b.id = s.battle_id
                                             and b.state in ('finished', 'cancelled', 'voided')));
  get diagnostics v_count = row_count;
  -- Orphans past expiry whose battle never progressed (defensive; normal paths release on terminal state).
  delete from private.battle_slots s
  where s.expires_at < now() - interval '1 hour'
    and (s.battle_id is null or exists (select 1 from public.battles b where b.id = s.battle_id
                                        and (b.ends_at is null or b.ends_at < now() - interval '1 hour')));
  get diagnostics v_more = row_count;
  return v_count + v_more;
end;
$$;

create or replace function private.run_sweep()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_battles integer := 0;
  v_attempts integer := 0;
  v_matched integer := 0;
  v_released integer := 0;
  v_sent integer := 0;
begin
  for r in
    select distinct q.offering_id from public.battle_queue q
    where q.state = 'waiting' and q.expires_at > now()
    group by q.offering_id having count(distinct q.user_id) >= 2
  loop
    begin
      v_matched := v_matched + private.match_queue(r.offering_id);
    exception when others then
      raise warning 'scholau sweep: match_queue % failed: %', r.offering_id, sqlstate;
    end;
  end loop;

  for r in
    select b.id from public.battles b
    where (b.state = 'waiting' and b.invitation_expires_at <= now())
       or (b.state = 'ready' and b.ready_deadline <= now())
       or (b.state = 'countdown' and b.starts_at <= now())
       or (b.state in ('countdown', 'active') and b.ends_at <= now())
    order by coalesce(b.ends_at, b.ready_deadline, b.invitation_expires_at)
    limit 500
  loop
    begin
      perform private.advance_battle(r.id);
      v_battles := v_battles + 1;
    exception when others then
      raise warning 'scholau sweep: advance_battle % failed: %', r.id, sqlstate;
    end;
  end loop;

  for r in
    select a.id from public.assessment_attempts a
    where a.status = 'active' and a.expires_at is not null and a.expires_at <= now()
    order by a.expires_at
    limit 500
  loop
    begin
      perform private.finalize_attempt(r.id, 'expired');
      v_attempts := v_attempts + 1;
    exception when others then
      raise warning 'scholau sweep: finalize_attempt % failed: %', r.id, sqlstate;
    end;
  end loop;

  v_released := private.reconcile_reservations();
  v_sent := private.dispatch_outbox(500);

  return jsonb_build_object('matched', v_matched, 'battles_advanced', v_battles, 'attempts_finalized', v_attempts,
                            'slots_released', v_released, 'events_sent', v_sent, 'at', now());
end;
$$;

-- Retention housekeeping (D11 proposal; tune once the retention policy is approved).
create or replace function private.cleanup_retention()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.outbox where delivered_at is not null and delivered_at < now() - interval '7 days';
  delete from private.outbox where delivered_at is null and attempts >= 10 and created_at < now() - interval '30 days';
  delete from private.battle_invites i using public.battles b
   where b.id = i.battle_id and b.state <> 'waiting';
  update public.push_tokens set revoked_at = now(), updated_at = now()
   where revoked_at is null and updated_at < now() - interval '180 days';
end;
$$;
