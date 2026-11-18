-- Lecturer-created rooms scope course quizzes and course challenges to joined students.
begin;

create table private.lecturer_classrooms (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id),
  created_by uuid not null references public.profiles(id),
  title text not null check (length(title) between 1 and 120),
  offering_ids uuid[] not null check (cardinality(offering_ids) > 0),
  join_open boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lecturer_classrooms_owner on private.lecturer_classrooms(created_by, archived_at, created_at desc);
create index lecturer_classrooms_offering on private.lecturer_classrooms(offering_id, created_at desc);

create table private.lecturer_classroom_members (
  classroom_id uuid not null references private.lecturer_classrooms(id),
  user_id uuid not null references public.profiles(id),
  offering_id uuid not null references public.course_offerings(id),
  joined_at timestamptz not null default now(),
  primary key (classroom_id, user_id)
);
create index lecturer_classroom_members_user on private.lecturer_classroom_members(user_id, joined_at desc);

alter table private.lecturer_classrooms enable row level security;
alter table private.lecturer_classroom_members enable row level security;
revoke all on private.lecturer_classrooms, private.lecturer_classroom_members from public, anon, authenticated;

alter table private.lecturer_course_quizzes
  add column classroom_id uuid references private.lecturer_classrooms(id);
create index lecturer_course_quizzes_classroom on private.lecturer_course_quizzes(classroom_id, created_at desc)
  where classroom_id is not null;
alter table private.course_challenges
  add column classroom_id uuid references private.lecturer_classrooms(id);
create index course_challenges_classroom on private.course_challenges(classroom_id, created_at desc)
  where classroom_id is not null;

create function private.classroom_teacher(p_classroom_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.lecturer_classrooms c
    where c.id = p_classroom_id and private.challenge_teacher(c.offering_id, p_user_id)
  )
$$;

create function private.classroom_member_exists(p_classroom_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.lecturer_classroom_members m
    where m.classroom_id = p_classroom_id and m.user_id = p_user_id
  )
$$;

create function private.classroom_student_access(p_classroom_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.lecturer_classrooms c
    join private.lecturer_classroom_members m on m.classroom_id = c.id and m.user_id = p_user_id
    where c.id = p_classroom_id and c.archived_at is null
      and m.offering_id = any(c.offering_ids)
      and private.challenge_student(m.offering_id, p_user_id)
  )
$$;

create function private.classroom_attempt_access(p_classroom_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_classroom_id is null or private.classroom_student_access(p_classroom_id, p_user_id)
$$;

create function private.classroom_challenge_student(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.course_challenges c
    where c.id = p_challenge_id and (
      (c.classroom_id is null and private.challenge_student(c.offering_id, p_user_id))
      or (c.classroom_id is not null and private.classroom_student_access(c.classroom_id, p_user_id))
    )
  )
$$;

create function private.classroom_summary(c private.lecturer_classrooms)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'offering_id', c.offering_id, 'title', c.title,
    'offering_ids', to_jsonb(c.offering_ids), 'programmes', coalesce((
      select jsonb_agg(d.name order by d.name)
      from unnest(c.offering_ids) selected(id)
      join public.course_offerings o on o.id = selected.id
      join public.departments d on d.id = o.department_id
    ), '[]'::jsonb),
    'join_open', c.join_open, 'archived_at', c.archived_at,
    'member_count', (select count(*)::int from private.lecturer_classroom_members m where m.classroom_id = c.id),
    'course', (select jsonb_build_object('code', co.code, 'title', co.title, 'semester', s.label, 'period', ap.label)
      from public.course_offerings o join public.courses co on co.id = o.course_id
      join public.semesters s on s.id = o.semester_id
      join public.academic_periods ap on ap.id = s.academic_period_id where o.id = c.offering_id),
    'created_at', c.created_at
  )
$$;

create or replace function private.quiz_student_can_access(p_quiz_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.lecturer_course_quizzes q
    where q.id = p_quiz_id
      and private.quiz_class_student(q.offering_id, p_user_id)
      and private.quiz_audience_eligible(p_quiz_id, p_user_id)
      and (q.classroom_id is null or private.classroom_student_access(q.classroom_id, p_user_id))
  )
$$;

create or replace function private.quiz_summary(q private.lecturer_course_quizzes) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', q.id, 'offering_id', q.offering_id, 'title', q.title, 'instructions', q.instructions,
    'duration_minutes', q.duration_minutes, 'state', private.quiz_display_state(q),
    'opens_at', q.opens_at, 'closes_at', q.closes_at, 'revision', q.revision,
    'question_count', jsonb_array_length(q.questions), 'max_attempts', coalesce((q.settings->>'max_attempts')::int, 1),
    'feedback_mode', coalesce(q.settings->>'feedback_mode', 'after_submit'),
    'audience_mode', coalesce(q.settings->'audience'->>'mode', 'all_programmes'),
    'audience_offering_ids', coalesce(q.settings->'audience'->'offering_ids', '[]'::jsonb),
    'audience_programmes', coalesce((select jsonb_agg(d.name order by d.name)
      from private.quiz_audience_offering_ids(q) ids(id)
      join public.course_offerings o on o.id = ids.id join public.departments d on d.id = o.department_id), '[]'::jsonb),
    'classroom_id', q.classroom_id
  )
$$;

create or replace function private.challenge_summary(c private.course_challenges)
returns jsonb language sql volatile set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'offering_id', c.offering_id, 'title', c.title,
    'instructions', c.instructions, 'duration_minutes', c.duration_minutes,
    'state', private.challenge_state(c), 'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'revision', c.revision, 'question_count', jsonb_array_length(c.questions), 'classroom_id', c.classroom_id)
$$;

create function public.create_classroom_v1(p_offering_id uuid, p_title text, p_offering_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; ids uuid[];
begin
  if not private.challenge_teacher(p_offering_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if not exists(select 1 from public.course_offerings where id = p_offering_id and status = 'published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  if coalesce(length(btrim(p_title)), 0) not between 1 and 120 then perform private.raise_error('VALIDATION_FAILED', 'Enter a room name.'); end if;
  select array_agg(distinct chosen order by chosen) into ids from unnest(coalesce(p_offering_ids, '{}'::uuid[])) chosen;
  if cardinality(ids) is null or cardinality(ids) = 0 or exists (
    select 1 from unnest(ids) selected(id)
    where not exists(select 1 from private.shared_course_offerings(p_offering_id) sibling(id) where sibling.id = selected.id)
  ) then perform private.raise_error('VALIDATION_FAILED', 'Choose one or more programmes that offer this course.'); end if;
  insert into private.lecturer_classrooms(offering_id, created_by, title, offering_ids)
  values(p_offering_id, u, btrim(p_title), ids) returning * into c;
  perform private.audit(u, 'create_classroom', 'lecturer_classroom', c.id, null);
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c)));
end
$$;

create function public.list_classrooms_v1(p_archived boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('classroom', private.classroom_summary(c),
    'teacher', private.classroom_teacher(c.id, u), 'member', private.classroom_member_exists(c.id, u))
    order by c.created_at desc, c.id), '[]'::jsonb) into items
  from private.lecturer_classrooms c
  where (c.archived_at is not null) = coalesce(p_archived, false)
    and (private.classroom_teacher(c.id, u) or private.classroom_student_access(c.id, u));
  return private.envelope(jsonb_build_object('items', items));
end
$$;

create function public.get_classroom_invite_v1(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; eligible boolean;
begin
  select * into c from private.lecturer_classrooms where id = p_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  eligible := exists(
    select 1 from unnest(c.offering_ids) selected(id)
    where private.challenge_student(selected.id, u)
  );
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c),
    'is_member', private.classroom_member_exists(c.id, u), 'is_eligible', eligible,
    'can_join', c.archived_at is null and c.join_open and eligible));
end
$$;

create function public.join_classroom_v1(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; joined_offering uuid;
begin
  select * into c from private.lecturer_classrooms where id = p_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if private.classroom_member_exists(c.id, u) then
    if not private.classroom_student_access(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
    return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c), 'already_member', true));
  end if;
  if c.archived_at is not null or not c.join_open then perform private.raise_error('INVALID_STATE', 'This room is closed to new members.'); end if;
  select selected.id into joined_offering from unnest(c.offering_ids) selected(id)
  where private.challenge_student(selected.id, u) order by selected.id limit 1;
  if joined_offering is null then perform private.raise_error('FORBIDDEN', 'You must be enrolled in an eligible programme to join this room.'); end if;
  insert into private.lecturer_classroom_members(classroom_id, user_id, offering_id)
  values(c.id, u, joined_offering) on conflict (classroom_id, user_id) do nothing;
  perform private.audit(u, 'join_classroom', 'lecturer_classroom', c.id, null);
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c), 'already_member', false));
end
$$;

create function public.set_classroom_join_open_v1(p_id uuid, p_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms;
begin
  select * into c from private.lecturer_classrooms where id = p_id for update;
  if not found or not private.classroom_teacher(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if c.archived_at is not null then perform private.raise_error('INVALID_STATE', 'Archived rooms cannot be reopened.'); end if;
  update private.lecturer_classrooms set join_open = coalesce(p_open, false), updated_at = now()
  where id = p_id returning * into c;
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c)));
end
$$;

create function public.archive_classroom_v1(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms;
begin
  select * into c from private.lecturer_classrooms where id = p_id for update;
  if not found or not private.classroom_teacher(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
  update private.lecturer_classrooms set archived_at = coalesce(archived_at, now()), join_open = false, updated_at = now()
  where id = p_id returning * into c;
  perform private.audit(u, 'archive_classroom', 'lecturer_classroom', c.id, null);
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c)));
end
$$;

create function public.get_classroom_v1(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; teacher boolean; quizzes jsonb; challenges jsonb;
begin
  select * into c from private.lecturer_classrooms where id = p_id;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  teacher := private.classroom_teacher(c.id, u);
  if not teacher and not private.classroom_student_access(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select coalesce(jsonb_agg(private.quiz_summary(q) order by q.created_at desc, q.id), '[]'::jsonb)
    into quizzes from private.lecturer_course_quizzes q
    where q.classroom_id = c.id and (teacher or q.status = 'published');
  select coalesce(jsonb_agg(private.challenge_summary(ch) order by ch.created_at desc, ch.id), '[]'::jsonb)
    into challenges from private.course_challenges ch
    where ch.classroom_id = c.id and (teacher or ch.status = 'published');
  return private.envelope(jsonb_build_object('classroom', private.classroom_summary(c), 'teacher', teacher,
    'quizzes', quizzes, 'challenges', challenges));
end
$$;

create function public.classroom_members_v1(p_id uuid, p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); items jsonb; total integer;
begin
  if not private.classroom_teacher(p_id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select count(*)::int into total from private.lecturer_classroom_members m where m.classroom_id = p_id;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'name', p.display_name,
    'department', d.name, 'joined_at', m.joined_at) order by p.display_name, p.id), '[]'::jsonb)
    into items from (
      select * from private.lecturer_classroom_members where classroom_id = p_id
      order by joined_at, user_id limit 20 offset greatest(0, coalesce(p_offset, 0))
    ) m join public.profiles p on p.id = m.user_id
    join public.course_offerings o on o.id = m.offering_id
    join public.departments d on d.id = o.department_id;
  return private.envelope(jsonb_build_object('items', items, 'total', total));
end
$$;

create function public.save_classroom_lecturer_quiz_v1(p_id uuid, p_classroom_id uuid, p_revision integer, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; q private.lecturer_course_quizzes; result jsonb; audience jsonb;
begin
  select * into c from private.lecturer_classrooms where id = p_classroom_id for share;
  if not found or c.archived_at is not null or not private.classroom_teacher(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
  if c.offering_id is distinct from (p_data->>'offering_id')::uuid and p_data ? 'offering_id' then perform private.raise_error('FORBIDDEN'); end if;
  select * into q from private.lecturer_course_quizzes where id = p_id for update;
  if found and (q.classroom_id is distinct from c.id or q.offering_id is distinct from c.offering_id) then perform private.raise_error('FORBIDDEN'); end if;
  audience := private.quiz_audience_normalize(c.offering_id, p_data->'audience');
  if audience->>'mode' = 'selected_programmes' and exists(
    select 1 from jsonb_array_elements_text(audience->'offering_ids') selected(value)
    where value::uuid <> all(c.offering_ids)
  ) then perform private.raise_error('VALIDATION_FAILED', 'Quiz programmes must be within this room.'); end if;
  select public.save_lecturer_quiz_v1(p_id, c.offering_id, p_revision, p_data) into result;
  update private.lecturer_course_quizzes set classroom_id = c.id where id = p_id returning * into q;
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q), 'questions', q.questions));
end
$$;

create function public.save_classroom_course_challenge_v1(p_id uuid, p_classroom_id uuid, p_revision integer, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); c private.lecturer_classrooms; ch private.course_challenges; result jsonb;
begin
  select * into c from private.lecturer_classrooms where id = p_classroom_id for share;
  if not found or c.archived_at is not null or not private.classroom_teacher(c.id, u) then perform private.raise_error('FORBIDDEN'); end if;
  select * into ch from private.course_challenges where id = p_id for update;
  if found and (ch.classroom_id is distinct from c.id or ch.offering_id is distinct from c.offering_id) then perform private.raise_error('FORBIDDEN'); end if;
  select public.save_course_challenge_v1(p_id, c.offering_id, p_revision, p_data) into result;
  update private.course_challenges set classroom_id = c.id where id = p_id returning * into ch;
  return private.envelope(jsonb_build_object('challenge', private.challenge_summary(ch), 'questions', ch.questions));
end
$$;

-- Room-only activities stay out of the existing course-wide lists.
do $$ declare definition text; original text;
begin
  select pg_get_functiondef('public.list_course_quizzes_v1(uuid,integer)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition, 'teacher and q.offering_id = p_offering_id', 'teacher and q.classroom_id is null and q.offering_id = p_offering_id');
  definition := replace(definition, 'not teacher' || E'\n        and q.status', 'not teacher' || E'\n        and q.classroom_id is null' || E'\n        and q.status');
  if definition = original then raise exception 'Could not hide classroom quizzes from course list'; end if;
  execute definition;

  select pg_get_functiondef('public.list_course_challenges_v1(uuid,integer)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition, 'where c.offering_id=p_offering_id', 'where c.offering_id=p_offering_id and c.classroom_id is null');
  if definition = original then raise exception 'Could not hide classroom challenges from course list'; end if;
  execute definition;

  -- Existing attempts keep their retry path only while their room membership is still valid.
  select pg_get_functiondef('public.get_course_quiz_v1(uuid)'::regprocedure) into definition;
  definition := replace(definition,
    'or exists(select 1 from private.lecturer_course_quiz_attempts where quiz_id = p_id and user_id = u)',
    'or (exists(select 1 from private.lecturer_course_quiz_attempts where quiz_id = p_id and user_id = u) and private.classroom_attempt_access(q.classroom_id, u))');
  if position('classroom_attempt_access' in definition) = 0 then raise exception 'Could not protect classroom quiz history access'; end if;
  execute definition;

  select pg_get_functiondef('public.save_lecturer_quiz_answer_v1(uuid,integer,integer,integer)'::regprocedure) into definition;
  definition := replace(definition,
    'or exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u)',
    'or (exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u) and private.classroom_attempt_access(q.classroom_id, u))');
  if position('classroom_attempt_access' in definition) = 0 then raise exception 'Could not protect classroom quiz answers'; end if;
  execute definition;

  select pg_get_functiondef('public.submit_lecturer_quiz_attempt_v1(uuid,integer)'::regprocedure) into definition;
  definition := replace(definition,
    'or exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u)',
    'or (exists(select 1 from private.lecturer_course_quiz_attempts old_attempt where old_attempt.quiz_id=p_quiz_id and old_attempt.user_id=u) and private.classroom_attempt_access(q.classroom_id, u))');
  if position('classroom_attempt_access' in definition) = 0 then raise exception 'Could not protect classroom quiz submissions'; end if;
  execute definition;

  -- A published classroom quiz notifies only students who have joined that room.
  select pg_get_functiondef('public.publish_lecturer_quiz_v1(uuid,integer)'::regprocedure) into definition;
  original := definition;
  definition := replace(definition, 'and private.quiz_audience_eligible(q.id,e.user_id)',
    'and private.quiz_audience_eligible(q.id,e.user_id) and (q.classroom_id is null or private.classroom_student_access(q.classroom_id,e.user_id))');
  if definition = original then raise exception 'Could not restrict classroom quiz notifications'; end if;
  execute definition;

  -- Keep quiz roster/export limited to actual room members, including when a
  -- room audience is narrower than the course roster.
  select pg_get_functiondef('public.lecturer_quiz_roster_v1(uuid,uuid,text,integer)'::regprocedure) into definition;
  definition := replace(definition,
    'and private.quiz_audience_eligible(p_quiz_id,e.user_id)',
    'and private.quiz_audience_eligible(p_quiz_id,e.user_id) and (q.classroom_id is null or private.classroom_member_exists(q.classroom_id,e.user_id))');
  if position('classroom_member_exists' in definition) = 0 then raise exception 'Could not scope classroom quiz roster'; end if;
  execute definition;

  select pg_get_functiondef('public.export_lecturer_quiz_results_v1(uuid)'::regprocedure) into definition;
  definition := replace(definition,
    'and private.quiz_audience_eligible(p_quiz_id,e.user_id)',
    'and private.quiz_audience_eligible(p_quiz_id,e.user_id) and (q.classroom_id is null or private.classroom_member_exists(q.classroom_id,e.user_id))');
  if position('classroom_member_exists' in definition) = 0 then raise exception 'Could not scope classroom quiz export'; end if;
  execute definition;

  select pg_get_functiondef('public.get_course_challenge_v1(uuid,uuid)'::regprocedure) into definition;
  definition := replace(definition, 'private.challenge_student(c.offering_id,u)', 'private.classroom_challenge_student(p_id,u)');
  definition := replace(definition,
    'or exists(select 1 from private.course_challenge_attempts where challenge_id=p_id and user_id=u)',
    'or (exists(select 1 from private.course_challenge_attempts where challenge_id=p_id and user_id=u) and private.classroom_attempt_access(c.classroom_id,u))');
  if position('classroom_challenge_student' in definition) = 0 then raise exception 'Could not protect classroom challenge detail'; end if;
  execute definition;

  select pg_get_functiondef('public.join_course_challenge_v1(uuid)'::regprocedure) into definition;
  definition := replace(definition, 'private.challenge_student(c.offering_id,u)', 'private.classroom_challenge_student(p_id,u)');
  if position('classroom_challenge_student' in definition) = 0 then raise exception 'Could not protect classroom challenge join'; end if;
  execute definition;

  select pg_get_functiondef('public.answer_course_challenge_v1(uuid,integer,integer,integer)'::regprocedure) into definition;
  definition := replace(definition, 'private.challenge_student(c.offering_id,u)', 'private.classroom_challenge_student(p_id,u)');
  if position('classroom_challenge_student' in definition) = 0 then raise exception 'Could not protect classroom challenge answers'; end if;
  execute definition;

  select pg_get_functiondef('public.submit_course_challenge_v1(uuid,integer)'::regprocedure) into definition;
  definition := replace(definition, 'private.challenge_student(c.offering_id,u)', 'private.classroom_challenge_student(p_id,u)');
  if position('classroom_challenge_student' in definition) = 0 then raise exception 'Could not protect classroom challenge submissions'; end if;
  execute definition;

  select pg_get_functiondef('public.course_challenge_roster_v1(uuid,uuid,text,integer)'::regprocedure) into definition;
  definition := replace(definition,
    'not(private.challenge_student(p_offering_id,u) or exists(select 1 from private.course_challenge_attempts where challenge_id=p_challenge_id and user_id=u))',
    'not(private.classroom_challenge_student(p_challenge_id,u) or (exists(select 1 from private.course_challenge_attempts where challenge_id=p_challenge_id and user_id=u) and private.classroom_attempt_access(c.classroom_id,u)))');
  definition := replace(definition,
    'where (teacher and exists(select 1 from public.enrollments e where e.user_id=p.id and e.offering_id=p_offering_id and e.ended_at is null)) or r.user_id is not null',
    'where (teacher and ((c.classroom_id is null and exists(select 1 from public.enrollments e where e.user_id=p.id and e.offering_id=p_offering_id and e.ended_at is null)) or (c.classroom_id is not null and private.classroom_member_exists(c.classroom_id,p.id)))) or r.user_id is not null');
  if position('classroom_member_exists' in definition) = 0 then raise exception 'Could not scope classroom challenge roster'; end if;
  execute definition;
end $$;

-- Keep the existing challenge API shape; only its audience and detail list change for room-linked rows.
create or replace function public.publish_course_challenge_v1(p_id uuid,p_revision integer,p_starts_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; start_time timestamptz;
begin
 select * into c from private.course_challenges where id=p_id for update;
 if not found or not private.challenge_teacher(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if c.status='published' then return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c))); end if;
 if c.status<>'draft' then perform private.raise_error('INVALID_STATE'); end if;
 if c.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 if jsonb_array_length(c.questions) not between 1 and 100 then perform private.raise_error('VALIDATION_FAILED','Add at least one question.'); end if;
 if not exists(select 1 from public.course_offerings where id=c.offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 start_time:=coalesce(p_starts_at,clock_timestamp());
 if p_starts_at is not null and p_starts_at<clock_timestamp() then perform private.raise_error('VALIDATION_FAILED','Choose a future start time.'); end if;
 update private.course_challenges set status='published',starts_at=start_time,ends_at=start_time+make_interval(mins=>duration_minutes),revision=revision+1 where id=p_id returning * into c;
 insert into public.notifications(user_id,kind,body,safe_target,event_key)
 select m.user_id,'course_challenge','New course challenge: '||c.title,'/challenges/'||c.id::text,
   'course-challenge:'||c.id::text||':'||m.user_id::text
 from private.lecturer_classroom_members m
 where c.classroom_id is not null and m.classroom_id=c.classroom_id
   and private.classroom_student_access(c.classroom_id,m.user_id)
 on conflict(event_key) do nothing;
 if c.classroom_id is null then
  insert into public.notifications(user_id,kind,body,safe_target,event_key)
  select e.user_id,'course_challenge','New course challenge: '||c.title,'/challenges/'||c.id::text,'course-challenge:'||c.id::text||':'||e.user_id::text
  from public.enrollments e where e.offering_id=c.offering_id and e.ended_at is null and private.challenge_student(c.offering_id,e.user_id)
  on conflict(event_key) do nothing;
 end if;
 perform private.audit(u,'publish_course_challenge','course_challenge',c.id,null);
 return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c)));
end $$;

revoke all on function private.classroom_teacher(uuid,uuid), private.classroom_member_exists(uuid,uuid),
  private.classroom_student_access(uuid,uuid), private.classroom_attempt_access(uuid,uuid),
  private.classroom_challenge_student(uuid,uuid), private.classroom_summary(private.lecturer_classrooms)
  from public, anon, authenticated;
revoke all on function public.create_classroom_v1(uuid,text,uuid[]), public.list_classrooms_v1(boolean),
  public.get_classroom_invite_v1(uuid), public.join_classroom_v1(uuid), public.set_classroom_join_open_v1(uuid,boolean),
  public.archive_classroom_v1(uuid), public.get_classroom_v1(uuid), public.classroom_members_v1(uuid,integer),
  public.save_classroom_lecturer_quiz_v1(uuid,uuid,integer,jsonb),
  public.save_classroom_course_challenge_v1(uuid,uuid,integer,jsonb) from public, anon;
grant execute on function public.create_classroom_v1(uuid,text,uuid[]), public.list_classrooms_v1(boolean),
  public.get_classroom_invite_v1(uuid), public.join_classroom_v1(uuid), public.set_classroom_join_open_v1(uuid,boolean),
  public.archive_classroom_v1(uuid), public.get_classroom_v1(uuid), public.classroom_members_v1(uuid,integer),
  public.save_classroom_lecturer_quiz_v1(uuid,uuid,integer,jsonb),
  public.save_classroom_course_challenge_v1(uuid,uuid,integer,jsonb) to authenticated;

commit;
