-- Material ingestion: R2-backed uploads, Gemini worker jobs, flashcards, fill-in-gap battles.

-- Extend course material object keys (images).
alter table private.course_materials drop constraint if exists course_materials_object_key_check;
alter table private.course_materials add constraint course_materials_object_key_check
  check (object_key ~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$');

alter table public.lesson_versions add column if not exists flashcards jsonb not null default '[]'::jsonb;

alter table public.question_versions drop constraint if exists question_versions_answer_format_check;
alter table public.question_versions add constraint question_versions_answer_format_check
  check (answer_format in ('standard', 'worked_solution', 'fill_in_gap'));

alter table private.question_answer_keys add column if not exists gap_answers jsonb;

create table private.material_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id),
  course_id uuid not null references public.courses(id),
  uploaded_by uuid not null references auth.users(id),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  filename text not null check (length(filename) between 1 and 240),
  object_key text not null,
  bytes bigint not null check (bytes between 1 and 100000000),
  mime_type text not null,
  topic_mode text not null check (topic_mode in ('existing_module', 'new_module', 'auto_segment')),
  module_title text,
  module_position integer,
  confirmed_outline jsonb,
  battle_mix jsonb not null default '{"standard":0.3,"worked_solution":0.3,"fill_in_gap":0.4}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'succeeded', 'failed', 'duplicate_file')),
  force_reprocess boolean not null default false,
  lease_owner text,
  lease_until timestamptz,
  attempts smallint not null default 0,
  error text,
  stats jsonb not null default '{}'::jsonb,
  request_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index material_ingestion_jobs_status_idx on private.material_ingestion_jobs (status, created_at);
create unique index material_ingestion_jobs_course_sha_success
  on private.material_ingestion_jobs (course_id, sha256) where status = 'succeeded' and not force_reprocess;

create table private.material_ingestion_evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.material_ingestion_jobs(id) on delete cascade,
  logical_key text,
  content_fingerprint text not null,
  source_reference text,
  source_text text,
  created_at timestamptz not null default now()
);
create index material_ingestion_evidence_fp_idx on private.material_ingestion_evidence (content_fingerprint);

revoke all on private.material_ingestion_jobs, private.material_ingestion_evidence from public, anon, authenticated;
alter table private.material_ingestion_jobs enable row level security;
alter table private.material_ingestion_evidence enable row level security;

create or replace function private.can_manage_ingestion_for_offering(p_uid uuid, p_offering_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id = p_uid and r.role = 'admin')
    or exists(
      select 1 from public.lecturer_course_assignments a
      join public.lecturer_applications la on la.user_id = a.user_id and la.status = 'approved'
      where a.user_id = p_uid and a.offering_id = p_offering_id
    );
$$;

create or replace function public.create_material_ingestion_job_v1(
  p_offering_id uuid,
  p_sha256 text,
  p_filename text,
  p_object_key text,
  p_bytes bigint,
  p_mime_type text,
  p_topic_mode text,
  p_module_title text,
  p_module_position integer,
  p_confirmed_outline jsonb,
  p_battle_mix jsonb,
  p_force_reprocess boolean,
  p_request_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_dup private.material_ingestion_jobs;
  v_job private.material_ingestion_jobs;
begin
  if not private.can_manage_ingestion_for_offering(v_uid, p_offering_id) then
    perform private.raise_error('FORBIDDEN');
  end if;
  select * into v_offering from public.course_offerings where id = p_offering_id and status = 'published';
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if coalesce(p_sha256,'') !~ '^[a-f0-9]{64}$' then perform private.raise_error('VALIDATION_FAILED'); end if;
  if coalesce(p_object_key,'') !~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt|jpg|jpeg|png|webp)$' then
    perform private.raise_error('VALIDATION_FAILED', 'Invalid object key.');
  end if;
  perform private.require_request_key(p_request_key);

  if coalesce(p_force_reprocess, false) = false then
    select * into v_dup from private.material_ingestion_jobs
      where course_id = v_offering.course_id and sha256 = p_sha256 and status = 'succeeded' limit 1;
    if found then
      return private.envelope(jsonb_build_object(
        'duplicate_file', true, 'job_id', v_dup.id, 'message', 'This file was already processed for this course.'));
    end if;
  end if;

  insert into private.course_materials (course_id, sha256, object_key, filename, bytes, published)
    values (v_offering.course_id, p_sha256, p_object_key, p_filename, p_bytes, false)
  on conflict (course_id, sha256) do update set object_key = excluded.object_key, filename = excluded.filename,
    bytes = excluded.bytes, updated_at = now();

  insert into private.material_ingestion_jobs (
    offering_id, course_id, uploaded_by, sha256, filename, object_key, bytes, mime_type,
    topic_mode, module_title, module_position, confirmed_outline, battle_mix, force_reprocess, request_key
  ) values (
    p_offering_id, v_offering.course_id, v_uid, p_sha256, p_filename, p_object_key, p_bytes, p_mime_type,
    p_topic_mode, nullif(btrim(p_module_title), ''), p_module_position, p_confirmed_outline,
    coalesce(p_battle_mix, '{"standard":0.3,"worked_solution":0.3,"fill_in_gap":0.4}'::jsonb),
    coalesce(p_force_reprocess, false), p_request_key
  ) returning * into v_job;

  perform private.wake_ingestion_worker();
  return private.envelope(jsonb_build_object('job_id', v_job.id, 'duplicate_file', false, 'status', v_job.status));
end;
$$;

create or replace function public.get_material_ingestion_job_v1(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_job private.material_ingestion_jobs;
begin
  select * into v_job from private.material_ingestion_jobs where id = p_job_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if v_job.uploaded_by <> v_uid and not exists(select 1 from public.user_roles r where r.user_id = v_uid and r.role = 'admin') then
    perform private.raise_error('FORBIDDEN');
  end if;
  return private.envelope(jsonb_build_object(
    'id', v_job.id, 'status', v_job.status, 'filename', v_job.filename, 'sha256', v_job.sha256,
    'stats', v_job.stats, 'error', v_job.error, 'created_at', v_job.created_at, 'updated_at', v_job.updated_at));
end;
$$;

create or replace function public.claim_material_ingestion_jobs_v1(p_limit integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_jobs jsonb := '[]'::jsonb;
  v_job private.material_ingestion_jobs;
  v_n integer := greatest(1, least(coalesce(p_limit, 1), 5));
begin
  if current_setting('role', true) <> 'service_role' then perform private.raise_error('FORBIDDEN'); end if;
  for v_job in
    select * from private.material_ingestion_jobs
    where status = 'pending' and (lease_until is null or lease_until < now())
    order by created_at for update skip locked limit v_n
  loop
    update private.material_ingestion_jobs set status = 'processing', lease_owner = 'worker',
      lease_until = now() + interval '10 minutes', attempts = attempts + 1, updated_at = now()
    where id = v_job.id;
    v_jobs := v_jobs || to_jsonb(v_job);
  end loop;
  return jsonb_build_object('jobs', v_jobs);
end;
$$;

create or replace function public.finish_material_ingestion_job_v1(
  p_job_id uuid, p_status text, p_stats jsonb, p_error text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role', true) <> 'service_role' then perform private.raise_error('FORBIDDEN'); end if;
  if p_status not in ('succeeded', 'failed', 'duplicate_file') then perform private.raise_error('VALIDATION_FAILED'); end if;
  update private.material_ingestion_jobs set status = p_status, stats = coalesce(p_stats, '{}'::jsonb),
    error = nullif(btrim(p_error), ''), lease_owner = null, lease_until = null, updated_at = now()
  where id = p_job_id;
end;
$$;

-- Flashcards validator
create or replace function private.validate_lesson_flashcards(p_cards jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare v_errors text[] := '{}'; v_i integer := 0; v_card jsonb;
begin
  if p_cards is null then return '{}'; end if;
  if jsonb_typeof(p_cards) <> 'array' then return array['flashcards must be an array']; end if;
  if jsonb_array_length(p_cards) > 30 then return array['flashcards max 30']; end if;
  for v_card in select value from jsonb_array_elements(p_cards) loop
    v_i := v_i + 1;
    if coalesce(length(v_card->>'front'),0) not between 1 and 500
      or coalesce(length(v_card->>'back'),0) not between 1 and 520 then
      v_errors := v_errors || format('flashcard %s: front/back length invalid', v_i);
    end if;
  end loop;
  return v_errors;
end;
$$;

-- Patch lesson import to accept flashcards
create or replace function public.admin_import_lessons_v1(p_rows jsonb, p_dry_run boolean default true, p_request_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
  v_row jsonb; v_i integer; v_pass integer;
  v_errors jsonb := '[]'::jsonb; v_created jsonb := '[]'::jsonb;
  v_course uuid; v_block_errors text[]; v_fc_errors text[];
  v_module public.modules; v_lesson public.lessons; v_latest public.lesson_versions;
  v_version_id uuid; v_version integer; v_seen text[];
  v_mpos integer; v_lpos integer; v_minutes integer; v_result jsonb;
  v_flashcards jsonb;
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
    v_i := 0; v_seen := '{}';
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_i := v_i + 1;
      v_course := (select c.id from public.courses c where c.code = v_row ->> 'course_code');
      begin v_mpos := (v_row ->> 'module_position')::integer; v_lpos := (v_row ->> 'lesson_position')::integer;
        v_minutes := (v_row ->> 'estimated_minutes')::integer; exception when others then v_mpos := null; v_lpos := null; v_minutes := null; end;
      v_flashcards := coalesce(v_row -> 'flashcards', '[]'::jsonb);
      if v_pass = 1 then
        if v_course is null then v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'course_code', 'message', 'unknown course code'); end if;
        if v_mpos is null or v_mpos < 1 then v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'module_position', 'message', 'positive integer required'); end if;
        if v_lpos is null or v_lpos < 1 then v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'lesson_position', 'message', 'positive integer required'); end if;
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
        v_fc_errors := private.validate_lesson_flashcards(v_flashcards);
        if cardinality(v_fc_errors) > 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'flashcards', 'message', array_to_string(v_fc_errors, '; '));
        end if;
        if coalesce(length(btrim(v_row ->> 'source_reference')), 0) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'source_reference', 'message', 'required');
        end if;
      else
        insert into public.modules (course_id, title, position) values (v_course, btrim(v_row ->> 'module_title'), v_mpos)
        on conflict (course_id, position) do update set title = excluded.title returning * into v_module;
        insert into public.lessons (course_id, module_id, position) values (v_course, v_module.id, v_lpos)
        on conflict (module_id, position) do update set position = excluded.position returning * into v_lesson;
        select * into v_latest from public.lesson_versions where lesson_id = v_lesson.id order by version desc limit 1 for update;
        if found and v_latest.status = 'draft' then
          v_version_id := v_latest.id; v_version := v_latest.version;
          update public.lesson_versions set title = btrim(v_row ->> 'title'), objective = btrim(v_row ->> 'objective'),
            blocks = v_row -> 'blocks', flashcards = v_flashcards, estimated_minutes = v_minutes,
            source_reference = btrim(v_row ->> 'source_reference'), reviewed_by = null where id = v_version_id;
        else
          v_version := coalesce(v_latest.version, 0) + 1;
          insert into public.lesson_versions (lesson_id, version, title, objective, blocks, flashcards, estimated_minutes, source_reference)
          values (v_lesson.id, v_version, btrim(v_row ->> 'title'), btrim(v_row ->> 'objective'), v_row -> 'blocks', v_flashcards,
                  v_minutes, btrim(v_row ->> 'source_reference')) returning id into v_version_id;
        end if;
        v_created := v_created || jsonb_build_object('row', v_i, 'module_id', v_module.id, 'lesson_id', v_lesson.id,
          'lesson_version_id', v_version_id, 'version', v_version);
      end if;
    end loop;
  end loop;
  v_result := jsonb_build_object('dry_run', coalesce(p_dry_run, true), 'valid', jsonb_array_length(v_errors) = 0,
    'row_count', jsonb_array_length(p_rows), 'error_count', jsonb_array_length(v_errors), 'errors', v_errors,
    'imported', jsonb_array_length(v_created) > 0, 'created', v_created);
  if not coalesce(p_dry_run, true) and jsonb_array_length(v_errors) = 0 then
    perform private.audit(v_uid, 'import_lessons', 'lesson_import', null, p_request_key, null, v_result);
  end if;
  return private.envelope(v_result, p_request_key);
end;
$$;

create or replace function public.get_lesson_v1(p_lesson_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); v_lesson public.lessons; v_version public.lesson_versions;
  v_offering uuid; v_prev uuid; v_next uuid;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  v_offering := private.require_course_enrollment(v_uid, v_lesson.course_id);
  select * into v_version from public.lesson_versions where lesson_id = p_lesson_id and status = 'published';
  if not found then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  with ordered as (
    select l.id, lag(l.id) over w as prev_id, lead(l.id) over w as next_id
    from public.lessons l join public.modules m on m.id = l.module_id
    where l.course_id = v_lesson.course_id
      and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')
    window w as (order by m.position, l.position)
  ) select prev_id, next_id into v_prev, v_next from ordered where id = p_lesson_id;
  return private.envelope(jsonb_build_object(
    'lesson_id', v_lesson.id, 'lesson_version_id', v_version.id, 'version', v_version.version,
    'offering_id', v_offering, 'course_id', v_lesson.course_id,
    'module', (select jsonb_build_object('id', m.id, 'title', m.title, 'position', m.position) from public.modules m where m.id = v_lesson.module_id),
    'position', v_lesson.position, 'title', v_version.title, 'objective', v_version.objective,
    'estimated_minutes', v_version.estimated_minutes, 'blocks', v_version.blocks, 'flashcards', v_version.flashcards,
    'previous_lesson_id', v_prev, 'next_lesson_id', v_next,
    'progress', (select jsonb_build_object('state', lp.state, 'started_at', lp.started_at, 'completed_at', lp.completed_at)
      from public.lesson_progress lp where lp.user_id = v_uid and lp.lesson_id = p_lesson_id),
    'review', (select jsonb_build_object('assessment_id', a.id, 'assessment_version_id', av.id, 'title', a.title)
      from public.assessments a join public.assessment_versions av on av.assessment_id = a.id and av.status = 'published'
      where a.lesson_id = p_lesson_id and a.kind = 'review' order by a.position limit 1)
  ));
end;
$$;

create or replace function private.normalize_gap_answer(p_text text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'));
$$;

create or replace function private.gap_answer_matches(p_submitted text, p_gaps jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare v_norm text := private.normalize_gap_answer(p_submitted); v_alias jsonb;
begin
  if p_gaps is null or jsonb_typeof(p_gaps) <> 'array' or jsonb_array_length(p_gaps) = 0 then return false; end if;
  for v_alias in select jsonb_array_elements(p_gaps->0->'accepted_answers') loop
    if private.normalize_gap_answer(v_alias #>> '{}') = v_norm then return true; end if;
  end loop;
  return false;
end;
$$;

-- Service-role apply ingestion import (lessons + questions drafts)
create or replace function public.apply_ingestion_import_v1(p_job_id uuid, p_lessons jsonb, p_questions jsonb, p_request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_job private.material_ingestion_jobs; v_l jsonb; v_q jsonb;
begin
  if current_setting('role', true) <> 'service_role' then perform private.raise_error('FORBIDDEN'); end if;
  select * into v_job from private.material_ingestion_jobs where id = p_job_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  perform set_config('request.jwt.claim.sub', v_job.uploaded_by::text, true);
  -- Import as admin via security definer bypass: use internal import with elevated path
  v_l := public.admin_import_lessons_v1(p_lessons, false, p_request_key);
  v_q := public.admin_import_questions_v1(p_questions, false, p_request_key);
  return jsonb_build_object('lessons', v_l, 'questions', v_q);
end;
$$;

-- Worker wake (best-effort; requires vault secrets ingestion_worker_url + ingestion_worker_secret)
create or replace function private.wake_ingestion_worker() returns void language plpgsql security definer set search_path = '' as $$
declare endpoint text; secret text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('scholau.ingestion.wake',0)) then return; end if;
  begin
    select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'ingestion_worker_url' limit 1;
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'ingestion_worker_secret' limit 1;
  exception when others then return;
  end;
  if endpoint is null or secret is null then return; end if;
  perform net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingestion-worker-secret', secret),
    body := '{}'::jsonb, timeout_milliseconds := 5000);
exception when others then raise warning 'Ingestion wake failed';
end;
$$;

revoke all on function public.create_material_ingestion_job_v1(uuid,text,text,text,bigint,text,text,text,integer,jsonb,jsonb,boolean,uuid),
  public.get_material_ingestion_job_v1(uuid), public.claim_material_ingestion_jobs_v1(integer),
  public.finish_material_ingestion_job_v1(uuid,text,jsonb,text), public.apply_ingestion_import_v1(uuid,jsonb,jsonb,uuid),
  private.wake_ingestion_worker(), private.can_manage_ingestion_for_offering(uuid,uuid)
  from public, anon;
grant execute on function public.create_material_ingestion_job_v1(uuid,text,text,text,bigint,text,text,text,integer,jsonb,jsonb,boolean,uuid),
  public.get_material_ingestion_job_v1(uuid)
  to authenticated;
grant execute on function public.claim_material_ingestion_jobs_v1(integer),
  public.finish_material_ingestion_job_v1(uuid,text,jsonb,text), public.apply_ingestion_import_v1(uuid,jsonb,jsonb,uuid)
  to service_role;
