-- ScholAu migration 1: academic hierarchy, curriculum and identity.
-- All timestamps are timestamptz (UTC). Calendar dates used for streaks and daily caps are
-- derived server-side in Africa/Lagos.

create extension if not exists pgcrypto with schema extensions;

-- private: confidential/internal data, never exposed through the Data API (see config.toml).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- authz: small SECURITY DEFINER predicates used by RLS policies (storage/realtime/public tables).
-- Not exposed through the Data API; usage is granted so policies evaluated as the caller can run.
create schema if not exists authz;
revoke all on schema authz from public;
grant usage on schema authz to anon, authenticated, service_role;

-- New functions in public must not be auto-executable by API roles; each RPC is granted explicitly.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema authz revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.lagos_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$ select (p_at at time zone 'Africa/Lagos')::date $$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Academic hierarchy
-- ---------------------------------------------------------------------------
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  name text not null check (length(name) between 2 and 200),
  active boolean not null default true,
  unique (university_id, name),
  unique (id, university_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null,
  faculty_id uuid not null,
  name text not null check (length(name) between 2 and 200),
  active boolean not null default true,
  foreign key (faculty_id, university_id) references public.faculties(id, university_id),
  unique (faculty_id, name),
  unique (id, faculty_id, university_id),
  unique (id, university_id)
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  label text not null check (length(label) between 1 and 60),
  sort_order integer not null,
  active boolean not null default true,
  unique (university_id, label),
  unique (id, university_id)
);

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id),
  label text not null check (length(label) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  check (ends_on > starts_on),
  unique (university_id, label),
  unique (id, university_id)
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null,
  academic_period_id uuid not null,
  label text not null check (length(label) between 1 and 60),
  sort_order integer not null,
  active boolean not null default true,
  foreign key (academic_period_id, university_id) references public.academic_periods(id, university_id),
  unique (academic_period_id, label),
  unique (id, academic_period_id, university_id),
  unique (id, university_id)
);

create index faculties_university on public.faculties(university_id);
create index departments_faculty on public.departments(faculty_id);
create index levels_university on public.levels(university_id, sort_order);
create index periods_university on public.academic_periods(university_id, starts_on desc);
create index semesters_period on public.semesters(academic_period_id, sort_order);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(display_name) between 2 and 60),
  avatar_path text check (avatar_path is null or length(avatar_path) <= 300),
  university_id uuid,
  faculty_id uuid,
  department_id uuid,
  level_id uuid,
  academic_period_id uuid,
  semester_id uuid,
  academic_changed_at timestamptz,
  leaderboard_visible boolean not null default true,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (university_id is null and faculty_id is null and department_id is null and level_id is null
      and academic_period_id is null and semester_id is null)
    or
    (university_id is not null and faculty_id is not null and department_id is not null and level_id is not null
      and academic_period_id is not null and semester_id is not null)
  ),
  foreign key (department_id, faculty_id, university_id) references public.departments(id, faculty_id, university_id),
  foreign key (level_id, university_id) references public.levels(id, university_id),
  foreign key (semester_id, academic_period_id, university_id) references public.semesters(id, academic_period_id, university_id)
);

create index faculty_members on public.profiles(faculty_id, id) where leaderboard_visible and deactivated_at is null;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.user_roles (
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('student', 'admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  primary key (user_id, role)
);

create table public.academic_profile_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  academic_period_id uuid not null references public.academic_periods(id),
  before_profile jsonb,
  after_profile jsonb not null,
  kind text not null check (kind in ('initial', 'self_change', 'admin_correction')),
  actor_id uuid not null references public.profiles(id),
  reason text,
  request_key uuid,
  created_at timestamptz not null default now(),
  check (kind <> 'admin_correction' or (reason is not null and length(reason) > 0))
);

-- D09: one self change per academic period; a single initial setup per user.
create unique index one_self_change_per_period
  on public.academic_profile_changes(user_id, academic_period_id) where kind = 'self_change';
create unique index one_initial_profile
  on public.academic_profile_changes(user_id) where kind = 'initial';
create unique index academic_change_request
  on public.academic_profile_changes(actor_id, request_key) where request_key is not null;
create index academic_changes_user on public.academic_profile_changes(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 2 and 30),
  title text not null check (length(title) between 2 and 200),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  university_id uuid not null,
  department_id uuid not null,
  level_id uuid not null,
  semester_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now(),
  foreign key (department_id, university_id) references public.departments(id, university_id),
  foreign key (level_id, university_id) references public.levels(id, university_id),
  foreign key (semester_id, university_id) references public.semesters(id, university_id),
  unique (course_id, department_id, level_id, semester_id),
  unique (id, course_id)
);

create index offering_lookup on public.course_offerings(department_id, level_id, semester_id) where status = 'published';
create index offering_course on public.course_offerings(course_id);

create table public.enrollments (
  user_id uuid not null references public.profiles(id),
  offering_id uuid not null references public.course_offerings(id),
  enrolled_at timestamptz not null default now(),
  ended_at timestamptz,
  request_key uuid,
  primary key (user_id, offering_id),
  check (ended_at is null or ended_at >= enrolled_at)
);

create index enrollment_offering on public.enrollments(offering_id, user_id);
create index enrollment_active_user on public.enrollments(user_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- New auth user -> profile + student role
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if length(v_name) < 2 then
    v_name := btrim(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  if length(v_name) < 2 then
    v_name := 'Student';
  end if;
  v_name := left(v_name, 60);

  insert into public.profiles (id, display_name) values (new.id, v_name)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student')
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization predicates (used by RLS policies and RPCs)
-- ---------------------------------------------------------------------------
create or replace function authz.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = 'admin' and p.deactivated_at is null
  )
$$;

-- True when the caller has an active enrollment in a published offering of the course.
create or replace function authz.is_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.course_offerings o on o.id = e.offering_id
    join public.profiles p on p.id = e.user_id
    where e.user_id = auth.uid()
      and e.ended_at is null
      and o.course_id = p_course_id
      and o.status = 'published'
      and p.deactivated_at is null
  )
$$;

revoke all on function authz.is_admin() from public;
revoke all on function authz.is_enrolled_in_course(uuid) from public;
grant execute on function authz.is_admin() to anon, authenticated, service_role;
grant execute on function authz.is_enrolled_in_course(uuid) to anon, authenticated, service_role;
