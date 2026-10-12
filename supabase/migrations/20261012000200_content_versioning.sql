-- ScholAu migration 2: course content with stable logical identity and immutable published versions.
-- Published/retired versions are append-only: the only permitted change is published -> retired
-- (plus retirement metadata). Draft -> published happens only inside approved publishing functions,
-- which set the transaction-local GUC scholau.allow_publish = 'on'.

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  title text not null check (length(title) between 1 and 200),
  position integer not null check (position > 0),
  unique (course_id, position),
  unique (id, course_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  module_id uuid not null,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  foreign key (module_id, course_id) references public.modules(id, course_id),
  unique (module_id, position),
  unique (id, course_id)
);

create table public.lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id),
  version integer not null check (version > 0),
  title text not null check (length(title) between 1 and 200),
  objective text not null check (length(objective) between 1 and 1000),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  estimated_minutes integer not null check (estimated_minutes > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  source_reference text,
  reviewed_by uuid references public.profiles(id),
  published_at timestamptz,
  retired_at timestamptz,
  retired_by uuid references public.profiles(id),
  retired_reason text,
  created_at timestamptz not null default now(),
  unique (lesson_id, version),
  unique (id, lesson_id),
  check (status <> 'published' or (reviewed_by is not null and published_at is not null and source_reference is not null)),
  check (status <> 'retired' or retired_at is not null)
);

create unique index one_published_lesson_version on public.lesson_versions(lesson_id) where status = 'published';

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  lesson_id uuid references public.lessons(id),
  pool text not null check (pool in ('learning', 'battle')),
  logical_key text not null check (length(logical_key) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (course_id, logical_key)
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id),
  version integer not null check (version > 0),
  prompt text not null check (length(prompt) between 1 and 2000),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  usage text[] not null check (cardinality(usage) > 0 and usage <@ array['review', 'practice', 'mock', 'battle']::text[]),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  source_reference text,
  reviewed_by uuid references public.profiles(id),
  published_at timestamptz,
  retired_at timestamptz,
  retired_by uuid references public.profiles(id),
  retired_reason text,
  created_at timestamptz not null default now(),
  unique (question_id, version),
  check (status <> 'published' or (reviewed_by is not null and published_at is not null and source_reference is not null)),
  check (status <> 'retired' or retired_at is not null)
);

create unique index one_published_question_version on public.question_versions(question_id) where status = 'published';

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions(id),
  label text not null check (length(label) between 1 and 4),
  body text not null check (length(body) between 1 and 1000),
  position integer not null check (position > 0),
  unique (question_version_id, position),
  unique (question_version_id, label),
  unique (id, question_version_id)
);

create table private.question_answer_keys (
  question_version_id uuid primary key references public.question_versions(id),
  correct_option_id uuid not null,
  explanation text not null check (length(explanation) between 1 and 4000),
  foreign key (correct_option_id, question_version_id) references public.question_options(id, question_version_id)
);

create index modules_course on public.modules(course_id, position);
create index lessons_course on public.lessons(course_id, module_id, position);
create index lesson_versions_published on public.lesson_versions(lesson_id, version desc) where status = 'published';
create index question_sampling on public.questions(course_id, pool);
create index versions_published on public.question_versions(question_id, version desc) where status = 'published';
create index question_options_version on public.question_options(question_version_id, position);

-- ---------------------------------------------------------------------------
-- Immutability guards
-- ---------------------------------------------------------------------------
create or replace function private.publishing_allowed()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce(current_setting('scholau.allow_publish', true), '') = 'on' $$;

-- Generic guard for *_versions tables that have a status column.
create or replace function private.guard_version_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ignored text[] := array['status', 'retired_at', 'retired_by', 'retired_reason'];
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not private.publishing_allowed() then
      raise exception 'new % rows must be drafts; publish through admin_publish_v1', tg_table_name
        using errcode = 'check_violation';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status = 'draft' then
      if new.status <> 'draft' and not private.publishing_allowed() then
        raise exception '% status changes require the publishing workflow', tg_table_name
          using errcode = 'check_violation';
      end if;
      return new;
    end if;
    if old.status = 'published' and new.status = 'retired'
       and (to_jsonb(new) - v_ignored) = (to_jsonb(old) - v_ignored) then
      return new;
    end if;
    raise exception 'published % rows are immutable', tg_table_name using errcode = 'check_violation';
  else
    if old.status <> 'draft' then
      raise exception 'published % rows cannot be deleted', tg_table_name using errcode = 'check_violation';
    end if;
    return old;
  end if;
end;
$$;

-- Options and answer keys can only change while their question version is a draft.
create or replace function private.guard_question_version_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.question_versions where id = old.question_version_id;
    if v_status is not null and v_status <> 'draft' then
      raise exception 'options/keys of a published question version are immutable' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.question_versions where id = new.question_version_id;
    if v_status is not null and v_status <> 'draft' and not private.publishing_allowed() then
      raise exception 'options/keys of a published question version are immutable' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger lesson_versions_immutable before insert or update or delete on public.lesson_versions
  for each row execute function private.guard_version_row();
create trigger question_versions_immutable before insert or update or delete on public.question_versions
  for each row execute function private.guard_version_row();
create trigger question_options_immutable before insert or update or delete on public.question_options
  for each row execute function private.guard_question_version_child();
create trigger answer_keys_immutable before insert or update or delete on private.question_answer_keys
  for each row execute function private.guard_question_version_child();

-- Logical rows that published content depends on cannot be re-parented.
create or replace function private.guard_question_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.course_id, new.pool, new.logical_key) is distinct from (old.course_id, old.pool, old.logical_key)
     and exists (select 1 from public.question_versions v where v.question_id = old.id and v.status <> 'draft') then
    raise exception 'course/pool/key of a question with published versions is immutable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger questions_identity before update on public.questions
  for each row execute function private.guard_question_identity();

-- ---------------------------------------------------------------------------
-- Structured lesson block validation (paragraph, heading, list, image, callout, code)
-- Returns a list of human-readable problems; empty array means valid.
-- ---------------------------------------------------------------------------
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
