-- ScholAu migration 3: assessments, attempts and learning progress.
-- Attempts snapshot fixed question versions, order, option order, scoring version, feedback mode
-- and deadline. Direct table access is denied; redacted RPCs return permitted data.

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  lesson_id uuid references public.lessons(id),
  kind text not null check (kind in ('review', 'practice', 'mock')),
  title text not null check (length(title) between 1 and 200),
  position integer not null default 1 check (position > 0),
  created_at timestamptz not null default now()
);

create table public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id),
  version integer not null check (version > 0),
  question_count integer not null check (question_count > 0),
  duration_seconds integer check (duration_seconds > 0),
  feedback_mode text not null check (feedback_mode in ('immediate', 'after_submit')),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  scoring_version integer not null default 1 check (scoring_version > 0),
  reviewed_by uuid references public.profiles(id),
  published_at timestamptz,
  retired_at timestamptz,
  retired_by uuid references public.profiles(id),
  retired_reason text,
  created_at timestamptz not null default now(),
  unique (assessment_id, version),
  unique (id, assessment_id),
  check (status <> 'published' or (published_at is not null and reviewed_by is not null)),
  check (status <> 'retired' or retired_at is not null)
);

create unique index one_published_assessment_version on public.assessment_versions(assessment_id) where status = 'published';

create table public.assessment_questions (
  assessment_version_id uuid not null references public.assessment_versions(id),
  question_version_id uuid not null references public.question_versions(id),
  position integer not null default 1 check (position > 0),
  primary key (assessment_version_id, question_version_id)
);

create trigger assessment_versions_immutable before insert or update or delete on public.assessment_versions
  for each row execute function private.guard_version_row();

create or replace function private.guard_assessment_version_child()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.assessment_versions where id = old.assessment_version_id;
    if v_status is not null and v_status <> 'draft' then
      raise exception 'questions of a published assessment version are immutable' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.assessment_versions where id = new.assessment_version_id;
    if v_status is not null and v_status <> 'draft' and not private.publishing_allowed() then
      raise exception 'questions of a published assessment version are immutable' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger assessment_questions_immutable before insert or update or delete on public.assessment_questions
  for each row execute function private.guard_assessment_version_child();

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  offering_id uuid not null references public.course_offerings(id),
  assessment_id uuid not null,
  assessment_version_id uuid not null,
  request_key uuid not null,
  status text not null default 'active' check (status in ('active', 'submitted', 'expired', 'voided')),
  started_at timestamptz not null,
  expires_at timestamptz,
  finalized_at timestamptz,
  scoring_version integer not null,
  feedback_mode text not null check (feedback_mode in ('immediate', 'after_submit')),
  correct_count integer check (correct_count >= 0),
  answered_count integer check (answered_count >= 0),
  total_count integer not null check (total_count > 0),
  revision integer not null default 0 check (revision >= 0),
  voided_reason text,
  foreign key (assessment_version_id, assessment_id) references public.assessment_versions(id, assessment_id),
  unique (user_id, request_key),
  check (expires_at is null or expires_at > started_at),
  check (correct_count is null or correct_count <= total_count),
  check ((status = 'active' and finalized_at is null) or (status <> 'active' and finalized_at is not null))
);

-- One active attempt per user per logical assessment.
create unique index one_active_attempt on public.assessment_attempts(user_id, assessment_id) where status = 'active';
create index attempts_by_owner on public.assessment_attempts(user_id, started_at desc);
create index attempts_due on public.assessment_attempts(expires_at) where status = 'active' and expires_at is not null;
create index attempts_assessment on public.assessment_attempts(user_id, assessment_id, finalized_at desc);

create table public.attempt_questions (
  attempt_id uuid not null references public.assessment_attempts(id),
  question_version_id uuid not null references public.question_versions(id),
  position integer not null check (position > 0),
  option_order uuid[] not null,
  primary key (attempt_id, question_version_id),
  unique (attempt_id, position)
);

create table public.attempt_answers (
  attempt_id uuid not null,
  question_version_id uuid not null,
  option_id uuid not null,
  answer_revision integer not null check (answer_revision > 0),
  received_at timestamptz not null,
  locked_at timestamptz,
  is_correct boolean,
  primary key (attempt_id, question_version_id),
  foreign key (attempt_id, question_version_id) references public.attempt_questions(attempt_id, question_version_id),
  foreign key (option_id, question_version_id) references public.question_options(id, question_version_id)
);

-- ---------------------------------------------------------------------------
-- Learning progress and qualifying activity (streaks)
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id uuid not null references public.profiles(id),
  lesson_id uuid not null references public.lessons(id),
  last_version_id uuid not null,
  state text not null check (state in ('started', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  foreign key (last_version_id, lesson_id) references public.lesson_versions(id, lesson_id),
  check ((state = 'completed' and completed_at is not null) or (state = 'started' and completed_at is null))
);

create index lesson_progress_recent on public.lesson_progress(user_id, updated_at desc);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('lesson_completed', 'assessment_completed', 'battle_completed')),
  source_id uuid not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, source_id)
);

create index activity_streak on public.activity_events(user_id, local_date desc);
