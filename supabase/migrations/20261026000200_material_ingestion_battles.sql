-- Fill-in-gap battles, service-role ingestion import, battle text answers.

create or replace function public.service_ingestion_import_v1(
  p_job_id uuid, p_lessons jsonb, p_questions jsonb, p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_job private.material_ingestion_jobs;
  v_l jsonb; v_q jsonb;
  v_admin uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), current_setting('role', true)) <> 'service_role'
     and current_setting('role', true) <> 'service_role' then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_job from private.material_ingestion_jobs where id = p_job_id and status = 'processing';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select r.user_id into v_admin from public.user_roles r where r.role = 'admin' order by r.user_id limit 1;
  if v_admin is null then perform private.raise_error('VALIDATION_FAILED', 'No administrator account for ingestion import.'); end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_l := public.admin_import_lessons_v1(p_lessons, false, p_request_key);
  v_q := public.admin_import_questions_v1(p_questions, false, p_request_key);
  perform private.audit(v_job.uploaded_by, 'ingestion_import', 'course', v_job.course_id, p_request_key, null,
    jsonb_build_object('job_id', p_job_id, 'lessons', v_l, 'questions', v_q));
  return jsonb_build_object('lessons', v_l, 'questions', v_q);
end;
$$;

revoke all on function public.service_ingestion_import_v1(uuid,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.service_ingestion_import_v1(uuid,jsonb,jsonb,uuid) to service_role;

drop function if exists public.apply_ingestion_import_v1(uuid,jsonb,jsonb,uuid);

-- Extend question import for fill_in_gap (patch validation + write path)
create or replace function public.admin_import_questions_v1(p_rows jsonb, p_dry_run boolean default true, p_request_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
  v_row jsonb; v_i integer; v_course uuid; v_key text; v_pool text; v_usage text[];
  v_options jsonb; v_correct text; v_lesson uuid; v_question public.questions; v_latest public.question_versions;
  v_version_id uuid; v_version integer; v_opt jsonb; v_n integer; v_correct_id uuid; v_pass integer;
  v_errors jsonb := '[]'::jsonb; v_created jsonb := '[]'::jsonb; v_seen text[] := '{}';
  v_format text; v_gaps jsonb;
  v_result jsonb;
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

  for v_pass in 1..2 loop
    exit when v_pass = 2 and (coalesce(p_dry_run, true) or jsonb_array_length(v_errors) > 0);
    v_i := 0;
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_i := v_i + 1;
      v_course := (select c.id from public.courses c where c.code = v_row ->> 'course_code');
      v_key := btrim(coalesce(v_row ->> 'logical_question_key', ''));
      v_pool := lower(btrim(coalesce(v_row ->> 'pool', '')));
      v_format := coalesce(nullif(v_row->>'answer_format',''), 'standard');
      v_gaps := coalesce(v_row->'gaps', '[]'::jsonb);
      if jsonb_typeof(v_row -> 'usage') = 'array' then
        v_usage := array(select lower(btrim(x)) from jsonb_array_elements_text(v_row -> 'usage') x where btrim(x) <> '');
      else
        v_usage := array(select lower(btrim(x)) from regexp_split_to_table(coalesce(v_row ->> 'usage', ''), '[|;,]') x where btrim(x) <> '');
      end if;
      if jsonb_typeof(v_row -> 'options') = 'array' then
        select coalesce(jsonb_agg(jsonb_build_object(
                 'label', upper(coalesce(nullif(btrim(o.value ->> 'label'), ''), chr(64 + o.n::integer))),
                 'body', btrim(coalesce(o.value ->> 'body', o.value #>> '{}')), 'steps', coalesce(o.value->'steps','[]'::jsonb)) order by o.n), '[]'::jsonb)
          into v_options from jsonb_array_elements(v_row -> 'options') with ordinality as o(value, n);
      else
        select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'body', btrim(v_row ->> x.col)) order by x.label), '[]'::jsonb)
          into v_options
          from (values ('A','option_a'),('B','option_b'),('C','option_c'),('D','option_d'),('E','option_e'),('F','option_f')) x(label,col)
          where coalesce(btrim(v_row ->> x.col), '') <> '';
      end if;
      v_correct := upper(btrim(coalesce(v_row ->> 'correct_option', '')));
      begin v_lesson := nullif(v_row ->> 'lesson_id', '')::uuid; exception when others then v_lesson := null; end;

      if v_pass = 1 then
        if v_format not in ('standard','worked_solution','fill_in_gap') then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'answer_format', 'message', 'invalid format');
        end if;
        if v_pool = 'battle' and v_format <> 'fill_in_gap' and jsonb_array_length(v_options) <> 4 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'Battles require exactly four options');
        end if;
        if v_format = 'fill_in_gap' then
          if jsonb_typeof(v_gaps) <> 'array' or jsonb_array_length(v_gaps) < 1 then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'gaps', 'message', 'gaps required');
          elsif not exists (
            select 1 from jsonb_array_elements(v_gaps) g
            where jsonb_typeof(g->'accepted_answers') = 'array' and jsonb_array_length(g->'accepted_answers') >= 1
          ) then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'gaps', 'message', 'accepted_answers required');
          end if;
        else
          if jsonb_array_length(v_options) < 2 or jsonb_array_length(v_options) > 6 then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'options', 'message', 'between 2 and 6 options required');
          elsif not exists (select 1 from jsonb_array_elements(v_options) o where o ->> 'label' = v_correct) then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'correct_option', 'message', 'must match option label');
          end if;
        end if;
        if v_course is null then v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'course_code', 'message', 'unknown course'); end if;
        if v_key = '' then v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'logical_question_key', 'message', 'required'); end if;
        if coalesce(length(btrim(v_row->>'prompt')),0) not between 1 and 2000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'prompt', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row->>'explanation')),0) not between 1 and 4000 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'explanation', 'message', 'required');
        end if;
        if coalesce(length(btrim(v_row->>'source_reference')),0) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'source_reference', 'message', 'required');
        end if;
      else
        insert into public.questions (course_id, lesson_id, pool, logical_key)
        values (v_course, v_lesson, v_pool, v_key)
        on conflict (course_id, logical_key) do update set lesson_id = coalesce(excluded.lesson_id, public.questions.lesson_id)
        returning * into v_question;
        select * into v_latest from public.question_versions where question_id = v_question.id order by version desc limit 1 for update;
        if found and v_latest.status = 'draft' then
          v_version_id := v_latest.id; v_version := v_latest.version;
          delete from private.question_answer_keys where question_version_id = v_version_id;
          delete from public.question_options where question_version_id = v_version_id;
          update public.question_versions set prompt = btrim(v_row->>'prompt'), difficulty = v_row->>'difficulty', usage = v_usage,
            source_reference = btrim(v_row->>'source_reference'), answer_format = v_format,
            battle_seconds = nullif(v_row->>'battle_seconds','')::smallint,
            battle_reading_seconds = nullif(v_row->>'battle_reading_seconds','')::smallint, reviewed_by = null
          where id = v_version_id;
        else
          v_version := coalesce(v_latest.version, 0) + 1;
          insert into public.question_versions (question_id, version, prompt, difficulty, usage, source_reference, answer_format, battle_seconds, battle_reading_seconds)
          values (v_question.id, v_version, btrim(v_row->>'prompt'), v_row->>'difficulty', v_usage, btrim(v_row->>'source_reference'), v_format,
            nullif(v_row->>'battle_seconds','')::smallint, nullif(v_row->>'battle_reading_seconds','')::smallint)
          returning id into v_version_id;
        end if;
        if v_format = 'fill_in_gap' then
          insert into private.question_answer_keys (question_version_id, correct_option_id, explanation, gap_answers)
          values (v_version_id, null, btrim(v_row->>'explanation'), v_gaps);
        else
          v_n := 0; v_correct_id := null;
          for v_opt in select value from jsonb_array_elements(v_options) loop
            v_n := v_n + 1;
            if v_opt->>'label' = v_correct then
              insert into public.question_options (question_version_id, label, body, position)
              values (v_version_id, v_opt->>'label', v_opt->>'body', v_n) returning id into v_correct_id;
            else
              insert into public.question_options (question_version_id, label, body, position)
              values (v_version_id, v_opt->>'label', v_opt->>'body', v_n);
            end if;
          end loop;
          insert into private.question_answer_keys (question_version_id, correct_option_id, explanation)
          values (v_version_id, v_correct_id, btrim(v_row->>'explanation'));
        end if;
        v_created := v_created || jsonb_build_object('row', v_i, 'question_id', v_question.id, 'question_version_id', v_version_id, 'version', v_version);
      end if;
    end loop;
  end loop;
  v_result := jsonb_build_object('dry_run', coalesce(p_dry_run, true), 'valid', jsonb_array_length(v_errors) = 0,
    'row_count', jsonb_array_length(p_rows), 'errors', v_errors, 'created', v_created);
  if not coalesce(p_dry_run, true) and jsonb_array_length(v_errors) = 0 then
    perform private.audit(v_uid, 'import_questions', 'question_import', null, p_request_key, null, v_result);
  end if;
  return private.envelope(v_result, p_request_key);
end;
$$;

alter table public.battle_answers drop constraint if exists battle_answers_option_id_question_version_id_fkey;
alter table public.battle_answers alter column option_id drop not null;
alter table public.battle_answers add column if not exists text_answer text;

create or replace function public.submit_battle_answer_v1(
  p_battle_id uuid, p_position integer, p_option_id uuid, p_request_key uuid, p_text_answer text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  b public.battles; v_part public.battle_participants; v_q public.battle_questions; v_prior public.battle_answers;
  v_correct boolean; v_inserted integer; v_format text; v_gaps jsonb;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into v_prior from public.battle_answers where user_id = v_uid and request_key = p_request_key;
  if found then
    if v_prior.battle_id <> p_battle_id or v_prior.position <> p_position then
      perform private.raise_error('VALIDATION_FAILED', 'Request key reused for a different answer.', jsonb_build_object('request_key', 'reused'));
    end if;
    return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', true,
      'option_id', v_prior.option_id, 'text_answer', v_prior.text_answer, 'received_at', v_prior.received_at), p_request_key);
  end if;
  select * into b from public.battles where id = p_battle_id for share;
  if not found then perform private.raise_error('NOT_FOUND', 'Battle not found.'); end if;
  select * into v_part from public.battle_participants where battle_id = p_battle_id and user_id = v_uid;
  if not found then perform private.raise_error('FORBIDDEN'); end if;
  if b.state not in ('countdown', 'active') or v_part.forfeited_at is not null then
    perform private.raise_error('DEADLINE_PASSED', 'This battle is not accepting answers.');
  end if;
  select * into v_q from public.battle_questions where battle_id = p_battle_id and position = p_position;
  if not found then perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('position', 'invalid')); end if;
  if now() < v_q.opened_at then perform private.raise_error('INVALID_STATE', 'This question is not open yet.'); end if;
  if now() >= v_q.deadline then perform private.raise_error('DEADLINE_PASSED', 'Time is up for this question.'); end if;

  select qv.answer_format into v_format from public.question_versions qv where qv.id = v_q.question_version_id;

  if v_format = 'fill_in_gap' then
    if coalesce(btrim(p_text_answer), '') = '' then
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('text_answer', 'required'));
    end if;
    select k.gap_answers into v_gaps from private.question_answer_keys k where k.question_version_id = v_q.question_version_id;
    v_correct := private.gap_answer_matches(p_text_answer, v_gaps);
    insert into public.battle_answers (battle_id, user_id, position, question_version_id, option_id, request_key, received_at, text_answer, is_correct)
    values (p_battle_id, v_uid, p_position, v_q.question_version_id, null, p_request_key, now(), btrim(p_text_answer), coalesce(v_correct, false))
    on conflict (battle_id, user_id, position) do nothing;
  else
    if p_option_id is null or not (p_option_id = any (v_q.option_order)) then
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('option_id', 'option_not_in_question'));
    end if;
    select p_option_id = k.correct_option_id into v_correct from private.question_answer_keys k where k.question_version_id = v_q.question_version_id;
    insert into public.battle_answers (battle_id, user_id, position, question_version_id, option_id, request_key, received_at, is_correct)
    values (p_battle_id, v_uid, p_position, v_q.question_version_id, p_option_id, p_request_key, now(), coalesce(v_correct, false))
    on conflict (battle_id, user_id, position) do nothing;
  end if;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into v_prior from public.battle_answers where battle_id = p_battle_id and user_id = v_uid and position = p_position;
    return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', false,
      'already_answered', true, 'option_id', v_prior.option_id, 'text_answer', v_prior.text_answer, 'received_at', v_prior.received_at), p_request_key);
  end if;
  return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', true,
    'option_id', p_option_id, 'text_answer', nullif(btrim(p_text_answer), ''), 'received_at', now()), p_request_key);
end;
$$;
