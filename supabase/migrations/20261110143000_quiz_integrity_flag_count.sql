-- Return the running integrity flag count so the student chrome can show Flag N/3.

create or replace function public.report_lecturer_quiz_integrity_v1(p_attempt_id uuid, p_event_id uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  attempt private.lecturer_course_quiz_attempts;
  quiz private.lecturer_course_quizzes;
  received timestamptz;
  flags integer;
begin
  if p_event_id is null or p_kind is null or p_kind not in (
    'app_hidden', 'focus_lost', 'possible_split_screen', 'fullscreen_exit',
    'screenshot_shortcut', 'recording_shortcut', 'casting_shortcut'
  ) then perform private.raise_error('VALIDATION_FAILED'); end if;

  select * into attempt from private.lecturer_course_quiz_attempts
  where id = p_attempt_id and user_id = actor for update;
  if not found then perform private.raise_error('FORBIDDEN'); end if;
  select * into quiz from private.lecturer_course_quizzes where id = attempt.quiz_id;
  if not private.quiz_class_student(quiz.offering_id, actor) then perform private.raise_error('FORBIDDEN'); end if;

  received := clock_timestamp();
  select count(*) into flags from private.lecturer_quiz_integrity_events where attempt_id = attempt.id;
  if quiz.status <> 'published' or received > least(attempt.expires_at, attempt.submitted_at) + interval '1 minute'
    or flags >= 100 then
    return jsonb_build_object('closed', true, 'flags', flags);
  end if;

  insert into private.lecturer_quiz_integrity_events(attempt_id, event_id, kind, received_at)
  select attempt.id, p_event_id, p_kind, received
  where not exists (
    select 1 from private.lecturer_quiz_integrity_events e where e.attempt_id = attempt.id
      and (e.kind = p_kind or (e.kind in ('app_hidden','focus_lost') and p_kind in ('app_hidden','focus_lost')))
      and e.received_at > received - interval '2 seconds'
  )
  on conflict (attempt_id, event_id) do nothing;

  select count(*) into flags from private.lecturer_quiz_integrity_events where attempt_id = attempt.id;
  return jsonb_build_object('closed', false, 'flags', flags);
end;
$$;
