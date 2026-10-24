-- Structured teaching and private source synchronization.
create or replace function private.validate_lesson_blocks(p_blocks jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_errors text[] := '{}';
  v_block jsonb;
  v_i integer := 0;
  v_type text;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    return array['blocks must be a JSON array'];
  end if;
  if jsonb_array_length(p_blocks) = 0 then
    return array['blocks must not be empty'];
  end if;
  for v_block in select value from jsonb_array_elements(p_blocks) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_block) <> 'object' then
      v_errors := v_errors || format('block %s: must be an object', v_i);
      continue;
    end if;
    v_type := v_block ->> 'type';
    case v_type
      when 'paragraph' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: paragraph.text required', v_i);
        end if;
      when 'heading' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: heading.text required', v_i);
        end if;
        if v_block ? 'level' and (jsonb_typeof(v_block -> 'level') <> 'number'
           or (v_block ->> 'level')::numeric not in (2, 3, 4)) then
          v_errors := v_errors || format('block %s: heading.level must be 2, 3 or 4', v_i);
        end if;
      when 'list' then
        if jsonb_typeof(v_block -> 'items') is distinct from 'array' or jsonb_array_length(v_block -> 'items') = 0 then
          v_errors := v_errors || format('block %s: list.items must be a non-empty array', v_i);
        elsif exists (select 1 from jsonb_array_elements(v_block -> 'items') i where jsonb_typeof(i) <> 'string') then
          v_errors := v_errors || format('block %s: list.items must be strings', v_i);
        end if;
      when 'image' then
        if coalesce(length(v_block ->> 'path'), 0) = 0 or coalesce(length(v_block ->> 'alt'), 0) = 0 then
          v_errors := v_errors || format('block %s: image.path and image.alt required', v_i);
        elsif (v_block ->> 'path') ~ '^[a-z]+://' then
          v_errors := v_errors || format('block %s: image.path must be a lesson-assets storage path, not a URL', v_i);
        end if;
      when 'callout' then
        if coalesce(length(v_block ->> 'text'), 0) = 0 then
          v_errors := v_errors || format('block %s: callout.text required', v_i);
        end if;
        if v_block ? 'tone' and (v_block ->> 'tone') not in ('info', 'tip', 'warning', 'example') then
          v_errors := v_errors || format('block %s: callout.tone must be info, tip, warning or example', v_i);
        end if;
      when 'checkpoint' then
        if coalesce(length(v_block->>'question'),0) not between 1 and 2000
          or coalesce(length(v_block->>'explanation'),0) not between 1 and 4000 then
          v_errors := v_errors || format('block %s: checkpoint question and explanation required',v_i);
        end if;
        if jsonb_typeof(v_block->'options') is distinct from 'array' then
          v_errors := v_errors || format('block %s: checkpoint options required',v_i);
        elsif jsonb_array_length(v_block->'options') not between 2 and 6
          or exists(select 1 from jsonb_array_elements(v_block->'options') x where jsonb_typeof(x)<>'string' or length(x #>> '{}')=0)
          or jsonb_typeof(v_block->'correct_index') is distinct from 'number'
          or coalesce(v_block->>'correct_index','') !~ '^[0-5]$' then
          v_errors := v_errors || format('block %s: invalid checkpoint options or answer',v_i);
        elsif (v_block->>'correct_index')::integer >= jsonb_array_length(v_block->'options') then
          v_errors := v_errors || format('block %s: checkpoint answer out of range',v_i);
        end if;
      when 'code' then
        if coalesce(length(v_block ->> 'code'), 0) = 0 then
          v_errors := v_errors || format('block %s: code.code required', v_i);
        end if;
      else
        v_errors := v_errors || format('block %s: unsupported type %s', v_i, coalesce(v_type, '(missing)'));
    end case;
    if v_block::text ~* '<\s*(script|iframe|object|embed|style)' then
      v_errors := v_errors || format('block %s: raw HTML is not allowed', v_i);
    end if;
  end loop;
  return v_errors;
end;
$$;

-- R2 stores bytes; this catalog and the existing publication RPCs govern visibility.
create table private.course_materials (
  course_id uuid not null references public.courses(id),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  object_key text not null check (object_key ~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt)$'),
  filename text not null check (length(filename) between 1 and 240),
  bytes bigint not null check (bytes between 1 and 100000000),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (course_id, sha256),
  check (split_part(split_part(object_key, '/', 2), '.', 1) = sha256)
);
create table private.course_material_lesson_slots (
  course_id uuid not null references public.courses(id),
  sha256 text not null,
  logical_key text not null,
  module_position integer not null,
  lesson_position integer not null,
  primary key(course_id, logical_key),
  unique(course_id, module_position, lesson_position)
);
create table private.course_material_sync (
  course_id uuid primary key references public.courses(id),
  digest text not null,
  lesson_versions uuid[] not null,
  question_versions uuid[] not null,
  assessment_versions uuid[] not null,
  material_hashes text[] not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
revoke all on private.course_materials, private.course_material_lesson_slots, private.course_material_sync from public, anon, authenticated;
alter table private.course_materials enable row level security;
alter table private.course_material_lesson_slots enable row level security;
alter table private.course_material_sync enable row level security;

create function public.get_course_materials_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  return private.envelope(jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.sha256, 'filename', m.filename, 'bytes', m.bytes) order by m.filename, m.sha256)
    from private.course_materials m where m.course_id = v_offering.course_id and m.published
  ), '[]'::jsonb)));
end $$;

-- Returns a key only after checking the exact offering and caller, never a caller-supplied path.
create function public.get_course_material_access_v1(p_offering_id uuid, p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_material private.course_materials;
begin
  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  select * into v_material from private.course_materials
    where course_id = v_offering.course_id and sha256 = p_sha256 and published;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  return private.envelope(jsonb_build_object('object_key', v_material.object_key, 'filename', v_material.filename));
end $$;

-- One transaction per course. Importers keep answer keys private and preserve version history.
create function public.admin_sync_course_materials_v1(p_bundle jsonb, p_dry_run boolean default true, p_publish boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
  v_course uuid;
  v_digest text;
  v_previous private.course_material_sync;
  v_material jsonb;
  v_row jsonb;
  v_lessons jsonb := '[]';
  v_questions jsonb := p_bundle->'questions';
  v_result jsonb;
  v_lresult jsonb;
  v_qresult jsonb;
  v_lids uuid[] := '{}';
  v_qids uuid[] := '{}';
  v_aids uuid[] := '{}';
  v_learning uuid[];
  v_hashes text[];
  v_module integer;
  v_position integer;
  v_kind text;
  v_assessment uuid;
  v_id uuid;
  v_key uuid := gen_random_uuid();
begin
  if p_dry_run is null or p_publish is null or jsonb_typeof(p_bundle) is distinct from 'object'
    or jsonb_typeof(p_bundle->'materials') is distinct from 'array'
    or jsonb_typeof(p_bundle->'lessons') is distinct from 'array'
    or jsonb_typeof(v_questions) is distinct from 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'A course bundle with materials, lessons and questions is required.');
  end if;
  if jsonb_array_length(p_bundle->'materials') not between 1 and 100
    or jsonb_array_length(p_bundle->'lessons') not between 1 and 100
    or jsonb_array_length(v_questions) not between 1 and 500 then
    perform private.raise_error('VALIDATION_FAILED', 'Bundle size is outside supported limits.');
  end if;
  select id into v_course from public.courses where code = p_bundle->>'course_code';
  if v_course is null then perform private.raise_error('VALIDATION_FAILED', 'Unknown course code.'); end if;
  perform pg_advisory_xact_lock(hashtextextended('course-material-sync:' || v_course::text, 0));
  v_digest := encode(sha256(convert_to(p_bundle::text, 'UTF8')), 'hex');
  select * into v_previous from private.course_material_sync where course_id = v_course;

  select array_agg(x->>'sha256') into v_hashes from jsonb_array_elements(p_bundle->'materials') x;
  if cardinality(v_hashes) <> (select count(distinct x) from unnest(v_hashes) x) then
    perform private.raise_error('VALIDATION_FAILED', 'Duplicate material hash.');
  end if;
  for v_material in select value from jsonb_array_elements(p_bundle->'materials') loop
    if coalesce(v_material->>'sha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(v_material->>'object_key','') !~ '^course-materials/[a-f0-9]{64}\.(pdf|docx|pptx|txt)$'
      or split_part(split_part(v_material->>'object_key','/',2),'.',1) <> v_material->>'sha256'
      or coalesce(length(v_material->>'filename'),0) not between 1 and 240
      or coalesce(v_material->>'bytes','') !~ '^[0-9]{1,9}$'
      or (v_material->>'bytes')::bigint not between 1 and 100000000 then
      perform private.raise_error('VALIDATION_FAILED', 'Invalid material metadata.');
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(v_questions) x where x->>'course_code' is distinct from p_bundle->>'course_code') then
    perform private.raise_error('VALIDATION_FAILED', 'Questions must belong to this course.');
  end if;
  if exists(select 1 from jsonb_array_elements(p_bundle->'lessons') x where not coalesce(x->>'source_sha256' = any(v_hashes),false))
    or exists(select 1 from jsonb_array_elements(p_bundle->'lessons') x where coalesce(x->>'logical_key','') !~ '^[a-z0-9_-]{1,120}$')
    or (select count(distinct x->>'logical_key') from jsonb_array_elements(p_bundle->'lessons') x) <> jsonb_array_length(p_bundle->'lessons') then
    perform private.raise_error('VALIDATION_FAILED', 'Lessons need registered source hashes and unique logical keys.');
  end if;

  if exists(select 1 from jsonb_array_elements(p_bundle->'lessons') x where
      not exists(select 1 from jsonb_array_elements(x->'blocks') b where b->>'type'='checkpoint')
      or not exists(select 1 from jsonb_array_elements(x->'blocks') b where b->>'type'='callout' and b->>'tone'='example')
      or not exists(select 1 from jsonb_array_elements(x->'blocks') b where b->>'type'='paragraph' and length(b->>'text')>=80)) then
    perform private.raise_error('VALIDATION_FAILED', 'Each lesson needs an explanation, worked example and knowledge check.');
  end if;

  select min(module_position) into v_module from private.course_material_lesson_slots where course_id = v_course;
  if v_module is null then select coalesce(max(position),0)+1 into v_module from public.modules where course_id = v_course; end if;
  select coalesce(max(lesson_position),0) into v_position from private.course_material_lesson_slots where course_id = v_course;
  for v_row in select value from jsonb_array_elements(p_bundle->'lessons') loop
    v_material := (select to_jsonb(s) from private.course_material_lesson_slots s where course_id=v_course and logical_key=v_row->>'logical_key');
    if v_material is null then
      v_position := v_position + 1;
      v_material := jsonb_build_object('lesson_position', v_position);
    end if;
    v_lessons := v_lessons || (v_row - 'source_sha256' || jsonb_build_object(
      'course_code', p_bundle->>'course_code', 'module_title', 'Understand the essentials',
      'module_position', v_module, 'lesson_position', (v_material->>'lesson_position')::integer));
  end loop;
  v_lresult := public.admin_import_lessons_v1(v_lessons, true, null);
  v_qresult := public.admin_import_questions_v1(v_questions, true, null);
  if v_lresult->>'valid' <> 'true' or v_qresult->>'valid' <> 'true' then
    return private.envelope(jsonb_build_object('valid', false, 'lessons', v_lresult, 'questions', v_qresult));
  end if;
  if not exists(select 1 from jsonb_array_elements(v_questions) x where x->>'pool'='learning') then
    perform private.raise_error('VALIDATION_FAILED', 'At least one learning question is required.');
  end if;
  if p_dry_run then
    return private.envelope(jsonb_build_object('valid', true, 'dry_run', true, 'course_code', p_bundle->>'course_code',
      'materials', cardinality(v_hashes), 'lessons', jsonb_array_length(v_lessons), 'questions', jsonb_array_length(v_questions),
      'unchanged', coalesce(v_previous.digest = v_digest, false)));
  end if;
  if v_previous.digest = v_digest then
    if v_previous.published or not p_publish then
      return private.envelope(jsonb_build_object('valid', true, 'unchanged', true, 'published', v_previous.published));
    end if;
    v_lids := v_previous.lesson_versions; v_qids := v_previous.question_versions; v_aids := v_previous.assessment_versions;
  else
    -- Persist slots only when the full course transaction commits.
    for v_position in 0..jsonb_array_length(v_lessons)-1 loop
      insert into private.course_material_lesson_slots values(v_course,
        p_bundle->'lessons'->v_position->>'source_sha256', p_bundle->'lessons'->v_position->>'logical_key', v_module,
        (v_lessons->v_position->>'lesson_position')::integer) on conflict do nothing;
    end loop;
    v_lresult := public.admin_import_lessons_v1(v_lessons, false, v_key);
    v_qresult := public.admin_import_questions_v1(v_questions, false, v_key);
    select array_agg((x->>'lesson_version_id')::uuid) into v_lids from jsonb_array_elements(v_lresult->'created') x;
    select array_agg((x->>'question_version_id')::uuid) into v_qids from jsonb_array_elements(v_qresult->'created') x;
    select array_agg(qv.id order by q.logical_key) into v_learning from public.question_versions qv
      join public.questions q on q.id=qv.question_id where qv.id=any(v_qids) and q.pool='learning';
    foreach v_kind in array array['review','practice','mock'] loop
      v_assessment := null;
      if v_previous.course_id is not null then
        select a.id into v_assessment from public.assessments a join public.assessment_versions av on av.assessment_id=a.id
          where av.id=any(v_previous.assessment_versions) and a.kind=v_kind limit 1;
      end if;
      v_result := public.admin_upsert_assessment_draft_v1(v_assessment, v_course, v_kind,
        'Course materials: ' || initcap(v_kind), null, cardinality(v_learning),
        case when v_kind='mock' then cardinality(v_learning)*90 else null end, v_learning, gen_random_uuid());
      v_aids := array_append(v_aids, (v_result->>'assessment_version_id')::uuid);
    end loop;
  end if;
  if p_publish then
    foreach v_id in array v_qids loop perform public.admin_publish_v1('question_version', v_id, gen_random_uuid()); end loop;
    foreach v_id in array v_lids loop perform public.admin_publish_v1('lesson_version', v_id, gen_random_uuid()); end loop;
    foreach v_id in array v_aids loop perform public.admin_publish_v1('assessment_version', v_id, gen_random_uuid()); end loop;
  end if;
  for v_material in select value from jsonb_array_elements(p_bundle->'materials') loop
    insert into private.course_materials(course_id, sha256, object_key, filename, bytes, published)
      values(v_course, v_material->>'sha256', v_material->>'object_key', v_material->>'filename', (v_material->>'bytes')::bigint, p_publish)
    on conflict(course_id, sha256) do update set object_key=excluded.object_key, filename=excluded.filename,
      bytes=excluded.bytes, published=private.course_materials.published or excluded.published, updated_at=now();
  end loop;
  insert into private.course_material_sync values(v_course, v_digest, v_lids, v_qids, v_aids, v_hashes, p_publish, now())
    on conflict(course_id) do update set digest=excluded.digest, lesson_versions=excluded.lesson_versions,
      question_versions=excluded.question_versions, assessment_versions=excluded.assessment_versions,
      material_hashes=excluded.material_hashes, published=excluded.published, updated_at=now();
  perform private.audit(v_uid, 'sync_course_materials', 'course', v_course, v_key, null,
    jsonb_build_object('digest', v_digest, 'published', p_publish, 'materials', cardinality(v_hashes)));
  return private.envelope(jsonb_build_object('valid', true, 'published', p_publish, 'unchanged', false,
    'materials', cardinality(v_hashes), 'lessons', cardinality(v_lids), 'questions', cardinality(v_qids), 'assessments', cardinality(v_aids)));
end $$;

revoke all on function public.get_course_materials_v1(uuid), public.get_course_material_access_v1(uuid,text),
  public.admin_sync_course_materials_v1(jsonb,boolean,boolean) from public, anon, authenticated;
grant execute on function public.get_course_materials_v1(uuid), public.get_course_material_access_v1(uuid,text),
  public.admin_sync_course_materials_v1(jsonb,boolean,boolean) to authenticated;
