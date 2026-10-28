create or replace function public.complete_lesson_v1(p_lesson_version_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_version public.lesson_versions;
  v_course uuid;
  v_progress public.lesson_progress;
  v_awarded integer := 0;
  v_already boolean := false;
  v_first boolean := false;
  v_had_activity_today boolean := false;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into v_version from public.lesson_versions where id = p_lesson_version_id;
  if not found or v_version.status <> 'published' then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  select course_id into v_course from public.lessons where id = v_version.lesson_id;
  perform private.require_course_enrollment(v_uid, v_course);

  -- Serialize completions for this learner, including two different lessons in two tabs.
  perform 1 from public.profiles where id = v_uid for update;
  select exists (select 1 from public.activity_events where user_id = v_uid and local_date = private.lagos_date()) into v_had_activity_today;

  insert into public.lesson_progress (user_id, lesson_id, last_version_id, state)
  values (v_uid, v_version.lesson_id, v_version.id, 'started')
  on conflict (user_id, lesson_id) do nothing;
  select * into v_progress from public.lesson_progress
  where user_id = v_uid and lesson_id = v_version.lesson_id for update;

  if v_progress.state = 'completed' then
    v_already := true;
  else
    select not exists (select 1 from public.lesson_progress where user_id = v_uid and state = 'completed') into v_first;
    update public.lesson_progress
       set state = 'completed', completed_at = now(), last_version_id = v_version.id, updated_at = now()
     where user_id = v_uid and lesson_id = v_version.lesson_id
    returning * into v_progress;

    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (v_uid, 'lesson_completed', v_version.lesson_id, private.lagos_date())
    on conflict do nothing;

    -- Reading completion records progress; XP requires the knowledge check.
  end if;

  return private.envelope(jsonb_build_object(
    'lesson_id', v_version.lesson_id,
    'state', v_progress.state,
    'completed_at', v_progress.completed_at,
    'already_completed', v_already,
    'first_lesson_completed', v_first,
    'streak_advanced', not v_already and not v_had_activity_today,
    'xp_awarded', v_awarded,
    'xp_capped', exists (select 1 from public.points_ledger l where l.user_id = v_uid
                         and l.event_key = 'lesson:' || v_version.lesson_id::text and l.cap_applied),
    'xp_total', (select total from public.user_points where user_id = v_uid),
    'streak', private.streak(v_uid)
  ), p_request_key);
end;
$$;

