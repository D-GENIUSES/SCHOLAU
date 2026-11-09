create table private.lecturer_quiz_integrity_events (
  attempt_id uuid not null references private.lecturer_course_quiz_attempts(id) on delete cascade,
  event_id uuid not null,
  kind text not null check (kind in (
    'app_hidden', 'focus_lost', 'possible_split_screen', 'fullscreen_exit',
    'screenshot_shortcut', 'recording_shortcut', 'casting_shortcut'
  )),
  received_at timestamptz not null default clock_timestamp(),
  primary key (attempt_id, event_id)
);

alter table private.lecturer_quiz_integrity_events enable row level security;
revoke all on private.lecturer_quiz_integrity_events from public, anon, authenticated;

create function public.report_lecturer_quiz_integrity_v1(p_attempt_id uuid, p_event_id uuid, p_kind text)
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
  if not private.challenge_student(quiz.offering_id, actor) then perform private.raise_error('FORBIDDEN'); end if;

  received := clock_timestamp();
  select count(*) into flags from private.lecturer_quiz_integrity_events where attempt_id = attempt.id;
  -- Give queued browser events a brief delivery window after submission or expiry.
  if quiz.status <> 'published' or received > least(attempt.expires_at, attempt.submitted_at) + interval '1 minute'
    or flags >= 100 then return jsonb_build_object('closed', true); end if;

  insert into private.lecturer_quiz_integrity_events(attempt_id, event_id, kind, received_at)
  select attempt.id, p_event_id, p_kind, received
  where not exists (
    select 1 from private.lecturer_quiz_integrity_events e where e.attempt_id = attempt.id
      and (e.kind = p_kind or (e.kind in ('app_hidden','focus_lost') and p_kind in ('app_hidden','focus_lost')))
      and e.received_at > received - interval '2 seconds'
  )
  on conflict (attempt_id, event_id) do nothing;
  return jsonb_build_object('closed', false);
end;
$$;

create function public.get_lecturer_quiz_integrity_v1(p_quiz_id uuid, p_students uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  offering uuid;
begin
  select offering_id into offering from private.lecturer_course_quizzes where id = p_quiz_id;
  if offering is null or not private.challenge_teacher(offering, actor) then perform private.raise_error('FORBIDDEN'); end if;
  if p_students is null or cardinality(p_students) > 50 then perform private.raise_error('VALIDATION_FAILED'); end if;

  return jsonb_build_object('items', coalesce((
    select jsonb_agg(to_jsonb(flags) order by user_id, attempt_number, kind)
    from (
      select a.user_id, a.attempt_number, e.kind, count(*)::integer as count
      from private.lecturer_course_quiz_attempts a
      join private.lecturer_quiz_integrity_events e on e.attempt_id = a.id
      where a.quiz_id = p_quiz_id and a.user_id = any(p_students)
      group by a.user_id, a.attempt_number, e.kind
    ) flags
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.report_lecturer_quiz_integrity_v1(uuid, uuid, text),
  public.get_lecturer_quiz_integrity_v1(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.report_lecturer_quiz_integrity_v1(uuid, uuid, text),
  public.get_lecturer_quiz_integrity_v1(uuid, uuid[]) to authenticated;
