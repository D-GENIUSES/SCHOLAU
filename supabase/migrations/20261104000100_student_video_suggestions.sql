-- Allow enrolled students to suggest educational YouTube clips, while preserving lecturer/admin review.
-- A suggestion never appears in published lesson videos until approved.

create or replace function public.submit_lesson_video_v1(
  p_lesson_id uuid, p_youtube_id text, p_title text, p_start_seconds integer, p_end_seconds integer
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_course uuid;
  v_can_manage boolean;
  v_id uuid;
  v_position integer;
begin
  select course_id into v_course from public.lessons where id = p_lesson_id;
  if v_course is null or not exists (
    select 1 from public.lesson_versions lv
    where lv.lesson_id = p_lesson_id and lv.status = 'published'
  ) then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;

  v_can_manage := private.can_manage_lesson_videos(v_uid, v_course);
  if not v_can_manage and not exists (
    select 1 from public.enrollments e
    join public.course_offerings o on o.id = e.offering_id
    where e.user_id = v_uid and e.ended_at is null and o.course_id = v_course and o.status = 'published'
  ) then perform private.raise_error('FORBIDDEN'); end if;

  if p_youtube_id is null or p_youtube_id !~ '^[A-Za-z0-9_-]{11}$' then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a valid YouTube video id.');
  end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 140 then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a descriptive video title.');
  end if;
  if p_start_seconds is null or p_start_seconds < 0 or p_start_seconds > 86400
     or (p_end_seconds is not null and (p_end_seconds <= p_start_seconds or p_end_seconds > 86400)) then
    perform private.raise_error('VALIDATION_FAILED', 'Check the clip start and end times.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('scholau.videos:' || p_lesson_id::text, 0));
  if (select count(*) from public.lesson_videos
      where lesson_id = p_lesson_id and status <> 'rejected') >= 12 then
    perform private.raise_error('VALIDATION_FAILED', 'This lesson already has 12 video suggestions or videos.');
  end if;
  if not v_can_manage and (select count(*) from public.lesson_videos
      where lesson_id = p_lesson_id and submitted_by = v_uid and status = 'pending') >= 3 then
    perform private.raise_error('VALIDATION_FAILED', 'You already have three suggestions awaiting review.');
  end if;

  select count(*) + 1 into v_position
  from public.lesson_videos where lesson_id = p_lesson_id and status <> 'rejected';
  -- Rejected suggestions remain reviewer-owned history; do not silently revive them.
  begin
    insert into public.lesson_videos
      (lesson_id, youtube_id, title, start_seconds, end_seconds, position, submitted_by, status)
    values
      (p_lesson_id, p_youtube_id, btrim(p_title), p_start_seconds, p_end_seconds, v_position, v_uid, 'pending')
    returning id into v_id;
  exception when unique_violation then
    perform private.raise_error('VALIDATION_FAILED', 'This video has already been suggested for this lesson.');
  end;
  return private.envelope(jsonb_build_object('id', v_id, 'status', 'pending'));
end;
$$;

create or replace function public.review_lesson_video_v1(p_video_id uuid, p_decision text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_video public.lesson_videos;
  v_course uuid;
begin
  select * into v_video from public.lesson_videos where id = p_video_id for update;
  if not found then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
  select course_id into v_course from public.lessons where id = v_video.lesson_id;
  if not private.can_manage_lesson_videos(v_uid, v_course) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if p_decision not in ('approved', 'rejected') or v_video.status <> 'pending' then
    perform private.raise_error('VALIDATION_FAILED', 'This video is not awaiting review.');
  end if;
  -- Independent moderation for lecturer submissions; admins may curate their own verified videos.
  if p_decision = 'approved' and v_video.submitted_by = v_uid and not exists (
    select 1 from public.user_roles where user_id = v_uid and role = 'admin'
  ) then perform private.raise_error('FORBIDDEN', 'Another lecturer or an administrator must approve your submission.'); end if;

  update public.lesson_videos
     set status = p_decision, reviewed_by = v_uid, reviewed_at = now()
   where id = p_video_id;
  return private.envelope(jsonb_build_object('id', p_video_id, 'status', p_decision));
end;
$$;