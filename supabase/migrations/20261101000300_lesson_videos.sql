-- Lecturer-approved YouTube clips for a lesson. Students receive approved rows only.
-- The web player embeds youtube-nocookie after a tap; this table stores no player markup.

create table public.lesson_videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null check (length(btrim(title)) between 1 and 140),
  start_seconds integer not null default 0 check (start_seconds between 0 and 86400),
  end_seconds integer check (end_seconds is null or (end_seconds > start_seconds and end_seconds <= 86400)),
  position integer not null check (position between 1 and 12),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, youtube_id, start_seconds)
);
create index lesson_videos_lesson on public.lesson_videos(lesson_id, status, position);
alter table public.lesson_videos enable row level security;
revoke all on public.lesson_videos from public, anon, authenticated;

create function private.can_manage_lesson_videos(p_user uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles where user_id = p_user and role = 'admin')
    or exists (
      select 1
      from public.lecturer_course_assignments a
      join public.user_roles r on r.user_id = a.user_id and r.role = 'lecturer'
      join public.course_offerings o on o.id = a.offering_id and o.course_id = p_course
      where a.user_id = p_user
    );
$$;
revoke all on function private.can_manage_lesson_videos(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_lesson_v1(p_lesson_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user(); v_lesson public.lessons; v_version public.lesson_versions;
  v_offering uuid; v_prev uuid; v_next uuid; v_manage boolean;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  select e.offering_id into v_offering
  from public.enrollments e
  join public.course_offerings o on o.id = e.offering_id
  where e.user_id = v_uid and e.ended_at is null and o.course_id = v_lesson.course_id and o.status = 'published'
  order by e.enrolled_at desc
  limit 1;
  v_manage := private.can_manage_lesson_videos(v_uid, v_lesson.course_id);
  if v_offering is null and v_manage then
    select id into v_offering from public.course_offerings
    where course_id = v_lesson.course_id and status = 'published'
    order by id limit 1;
  end if;
  if v_offering is null then perform private.raise_error('NOT_ENROLLED'); end if;
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
      where a.lesson_id = p_lesson_id and a.kind = 'review' order by a.position limit 1),
    'can_manage_videos', v_manage,
    'videos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'title', v.title, 'youtube_id', v.youtube_id,
        'start_seconds', v.start_seconds, 'end_seconds', v.end_seconds
      ) order by v.position, v.created_at)
      from public.lesson_videos v
      where v.lesson_id = p_lesson_id and v.status = 'approved'
    ), '[]'::jsonb),
    'pending_videos', case when v_manage then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'title', v.title, 'youtube_id', v.youtube_id,
        'start_seconds', v.start_seconds, 'end_seconds', v.end_seconds
      ) order by v.created_at)
      from public.lesson_videos v
      where v.lesson_id = p_lesson_id and v.status = 'pending'
    ), '[]'::jsonb) else '[]'::jsonb end
  ));
end;
$$;

create function public.submit_lesson_video_v1(
  p_lesson_id uuid, p_youtube_id text, p_title text, p_start_seconds integer, p_end_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_course uuid;
  v_id uuid;
  v_position integer;
begin
  select course_id into v_course from public.lessons where id = p_lesson_id;
  if v_course is null then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  if not private.can_manage_lesson_videos(v_uid, v_course) then perform private.raise_error('FORBIDDEN'); end if;
  if p_youtube_id is null or p_youtube_id !~ '^[A-Za-z0-9_-]{11}$' then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a YouTube video id.');
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 140 then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a clip title.');
  end if;
  if p_start_seconds is null or p_start_seconds < 0 or p_start_seconds > 86400
     or (p_end_seconds is not null and (p_end_seconds <= p_start_seconds or p_end_seconds > 86400)) then
    perform private.raise_error('VALIDATION_FAILED', 'Check the clip start and end times.');
  end if;
  if (select count(*) from public.lesson_videos where lesson_id = p_lesson_id and status <> 'rejected') >= 12 then
    perform private.raise_error('VALIDATION_FAILED', 'This lesson already has 12 clips.');
  end if;
  select count(*) + 1 into v_position
  from public.lesson_videos where lesson_id = p_lesson_id and status <> 'rejected';
  update public.lesson_videos
  set title = btrim(p_title), end_seconds = p_end_seconds, status = 'pending',
      reviewed_by = null, reviewed_at = null, submitted_by = v_uid
  where lesson_id = p_lesson_id and youtube_id = p_youtube_id and start_seconds = p_start_seconds and status = 'rejected'
  returning id into v_id;
  if found then return private.envelope(jsonb_build_object('id', v_id)); end if;
  begin
    insert into public.lesson_videos (lesson_id, youtube_id, title, start_seconds, end_seconds, position, submitted_by)
    values (p_lesson_id, p_youtube_id, btrim(p_title), p_start_seconds, p_end_seconds, v_position, v_uid)
    returning id into v_id;
  exception when unique_violation then
    perform private.raise_error('VALIDATION_FAILED', 'That clip is already on this lesson.');
  end;
  return private.envelope(jsonb_build_object('id', v_id));
end;
$$;

create function public.review_lesson_video_v1(p_video_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_video public.lesson_videos;
  v_course uuid;
begin
  select * into v_video from public.lesson_videos where id = p_video_id;
  if not found then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  select course_id into v_course from public.lessons where id = v_video.lesson_id;
  if not private.can_manage_lesson_videos(v_uid, v_course) then perform private.raise_error('FORBIDDEN'); end if;
  if p_decision not in ('approved', 'rejected') or v_video.status <> 'pending' then
    perform private.raise_error('VALIDATION_FAILED', 'This clip is not waiting for approval.');
  end if;
  update public.lesson_videos
  set status = p_decision, reviewed_by = v_uid, reviewed_at = now()
  where id = p_video_id;
  return private.envelope(jsonb_build_object('id', p_video_id, 'status', p_decision));
end;
$$;

revoke all on function public.submit_lesson_video_v1(uuid, text, text, integer, integer),
  public.review_lesson_video_v1(uuid, text) from public, anon;
grant execute on function public.submit_lesson_video_v1(uuid, text, text, integer, integer),
  public.review_lesson_video_v1(uuid, text) to authenticated;
