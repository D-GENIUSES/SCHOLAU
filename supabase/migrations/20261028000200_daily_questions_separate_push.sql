-- One daily question per delivery window, each as its own inbox row and web push.
-- Questions rotate by user/day/slot and are not repeated until the eligible pool is exhausted.
begin;

create or replace function private.daily_question_eligible(
  p_user_id uuid,
  p_question_version_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.question_versions qv
    join public.questions q on q.id = qv.question_id and q.pool = 'learning'
    join public.assessment_questions aq on aq.question_version_id = qv.id
    join public.assessment_versions av on av.id = aq.assessment_version_id and av.status = 'published'
    join public.assessments a on a.id = av.assessment_id and a.course_id = q.course_id
    join public.course_offerings o on o.course_id = q.course_id and o.status = 'published'
    join public.enrollments e on e.offering_id = o.id and e.user_id = p_user_id and e.ended_at is null
    where qv.id = p_question_version_id and qv.status = 'published'
  );
$$;

create or replace function private.prepare_daily_questions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  local_now timestamp;
  slot integer;
  q record;
  n integer := 0;
  v_seed text;
  v_expires timestamptz;
begin
  for p in
    select u.id, coalesce(pref.timezone, 'Africa/Lagos') as timezone
    from public.profiles u
    left join private.notification_preferences pref on pref.user_id = u.id
    where u.deactivated_at is null and coalesce(pref.academic, true)
  loop
    local_now := p_now at time zone p.timezone;
    slot := floor((extract(hour from local_now) - 8) / 4)::integer;
    if slot not between 0 and 2 then
      continue;
    end if;

    perform pg_advisory_xact_lock(hashtextextended('daily-questions:' || p.id, 0));

    if exists (
      select 1 from public.notifications
      where event_key = 'daily_questions:' || p.id || ':' || local_now::date || ':' || slot
    ) then
      continue;
    end if;

    v_seed := p.id::text || ':' || local_now::date::text || ':' || slot::text;
    v_expires := ((local_now::date + time '08:00') + make_interval(hours => (slot + 1) * 4)) at time zone p.timezone;

    select
      qv.id as question_version_id,
      left(qv.prompt, 500) as prompt,
      min(av.id) as assessment_version_id
    into q
    from public.question_versions qv
    join public.questions qst on qst.id = qv.question_id
    join public.assessment_questions aq on aq.question_version_id = qv.id
    join public.assessment_versions av on av.id = aq.assessment_version_id and av.status = 'published'
    join public.assessments a on a.id = av.assessment_id and a.course_id = qst.course_id
    join public.course_offerings o on o.course_id = qst.course_id and o.status = 'published'
    join public.enrollments e on e.offering_id = o.id and e.user_id = p.id and e.ended_at is null
    where qv.status = 'published'
      and qst.pool = 'learning'
      and not exists (
        select 1 from public.notifications prev
        where prev.user_id = p.id
          and prev.kind = 'daily_questions'
          and (
            prev.context->>'question_version_id' = qv.id::text
            or (prev.context ? 'question_ids' and prev.context->'question_ids' @> jsonb_build_array(qv.id))
          )
      )
      and not exists (
        select 1 from public.notifications prev
        where prev.user_id = p.id
          and prev.kind = 'daily_questions'
          and prev.context->>'date' = local_now::date::text
          and (
            prev.context->>'question_version_id' = qv.id::text
            or (prev.context ? 'question_ids' and prev.context->'question_ids' @> jsonb_build_array(qv.id))
          )
      )
    group by qv.id, qv.prompt
    order by md5(v_seed || qv.id::text)
    limit 1;

    if q.question_version_id is null then
      select
        qv.id as question_version_id,
        left(qv.prompt, 500) as prompt,
        min(av.id) as assessment_version_id
      into q
      from public.question_versions qv
      join public.questions qst on qst.id = qv.question_id
      join public.assessment_questions aq on aq.question_version_id = qv.id
      join public.assessment_versions av on av.id = aq.assessment_version_id and av.status = 'published'
      join public.assessments a on a.id = av.assessment_id and a.course_id = qst.course_id
      join public.course_offerings o on o.course_id = qst.course_id and o.status = 'published'
      join public.enrollments e on e.offering_id = o.id and e.user_id = p.id and e.ended_at is null
      where qv.status = 'published'
        and qst.pool = 'learning'
        and not exists (
          select 1 from public.notifications prev
          where prev.user_id = p.id
            and prev.kind = 'daily_questions'
            and prev.context->>'date' = local_now::date::text
            and (
              prev.context->>'question_version_id' = qv.id::text
              or (prev.context ? 'question_ids' and prev.context->'question_ids' @> jsonb_build_array(qv.id))
            )
        )
      group by qv.id, qv.prompt
      order by md5(v_seed || qv.id::text)
      limit 1;
    end if;

    if q.question_version_id is not null then
      perform private.notification_event(
        p.id,
        'daily_questions',
        q.prompt,
        '/study/assessments/' || q.assessment_version_id,
        'daily_questions:' || p.id || ':' || local_now::date || ':' || slot,
        'academic',
        jsonb_build_object(
          'date', local_now::date,
          'slot', slot,
          'question_version_id', q.question_version_id,
          'assessment_version_id', q.assessment_version_id
        ),
        v_expires,
        'Daily question'
      );
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

create or replace function private.prepare_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle public.battles;
begin
  if new.kind = 'battle_invitation' then
    select * into v_battle from public.battles
    where 'battle_invited:' || id::text = new.event_key;
    new.category := 'activity';
    new.title := 'Battle invitation';
    if v_battle.id is not null then
      new.context := jsonb_build_object('battle_id', v_battle.id);
    end if;
  elsif new.kind = 'lecturer_application' then
    new.category := 'account';
    new.title := 'Lecturer application';
  elsif new.kind = 'daily_questions' then
    new.category := 'academic';
    new.title := coalesce(nullif(btrim(new.title), ''), 'Daily question');
  end if;
  new.expires_at := coalesce(new.created_at, now()) + interval '24 hours';
  return new;
end;
$$;

create or replace function private.push_relevant(n public.notifications)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_qv uuid;
begin
  if n.kind = 'daily_questions' then
    v_tz := coalesce((select timezone from private.notification_preferences where user_id = n.user_id), 'Africa/Lagos');
    if n.context->>'date' is distinct from (now() at time zone v_tz)::date::text then
      return false;
    end if;
    if n.context ? 'question_version_id' then
      begin
        v_qv := (n.context->>'question_version_id')::uuid;
      exception when invalid_text_representation then
        return false;
      end;
      return private.daily_question_eligible(n.user_id, v_qv);
    end if;
    if n.context ? 'question_ids' then
      return (
        select count(distinct qv.id) = jsonb_array_length(n.context->'question_ids')
        from public.question_versions qv
        where n.context->'question_ids' @> jsonb_build_array(qv.id)
          and private.daily_question_eligible(n.user_id, qv.id)
      );
    end if;
    return false;
  end if;

  if n.context ? 'course_id' and not exists(select 1 from public.course_offerings o join public.enrollments e on e.offering_id=o.id
    where o.course_id=(n.context->>'course_id')::uuid and o.status='published' and e.user_id=n.user_id and e.ended_at is null) then return false; end if;
  if n.context ? 'battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'battle_id')::uuid and b.invited_user_id=n.user_id and b.state='waiting' and b.invitation_expires_at>now() and private.can_view_public_profile(n.user_id,b.created_by)) then return false; end if;
  if n.context ? 'accepted_battle_id' and not exists(select 1 from public.battles b where b.id=(n.context->>'accepted_battle_id')::uuid and b.created_by=n.user_id and b.state='ready' and b.ready_deadline>now()) then return false; end if;
  if n.context ? 'friend_low' and not exists(select 1 from public.friendships f where f.user_low=(n.context->>'friend_low')::uuid and f.user_high=(n.context->>'friend_high')::uuid and f.state=n.context->>'friend_state') then return false; end if;
  if n.context ? 'admin_only' and not exists(select 1 from public.user_roles where user_id=n.user_id and role='admin') then return false; end if;
  if n.context ? 'assignment_id' and not exists(select 1 from public.lecturer_course_assignments where user_id=n.user_id and offering_id=(n.context->>'assignment_id')::uuid) then return false; end if;
  if n.context ? 'lesson_id' and not exists(select 1 from public.lessons l join public.lesson_versions v on v.lesson_id=l.id and v.status='published' join public.course_offerings o on o.course_id=l.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where l.id=(n.context->>'lesson_id')::uuid and e.user_id=n.user_id) then return false; end if;
  if n.context ? 'assessment_id' and not exists(select 1 from public.assessments a join public.assessment_versions v on v.assessment_id=a.id and v.status='published' join public.course_offerings o on o.course_id=a.course_id and o.status='published' join public.enrollments e on e.offering_id=o.id and e.ended_at is null where a.id=(n.context->>'assessment_id')::uuid and e.user_id=n.user_id) then return false; end if;
  if n.context->>'audience'='offering' and not exists(select 1 from public.enrollments where user_id=n.user_id and offering_id=(n.context->>'audience_id')::uuid and ended_at is null) then return false; end if;
  if n.context->>'audience'='role' and not exists(select 1 from public.user_roles where user_id=n.user_id and role=n.context->>'audience_id') then return false; end if;
  if n.kind='study_reminder' and ((now() at time zone coalesce((select timezone from private.notification_preferences where user_id=n.user_id),'Africa/Lagos'))::date::text is distinct from n.context->>'date'
    or exists(select 1 from public.activity_events e where e.user_id=n.user_id and (e.created_at at time zone (select timezone from private.notification_preferences where user_id=n.user_id))::date=(n.context->>'date')::date)) then return false; end if;
  return true;
end;
$$;

create or replace function public.claim_push_jobs_v1(p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j private.push_jobs;
  result jsonb := '[]';
begin
  if not exists(select 1 from private.push_control where enabled) then
    return result;
  end if;
  for j in
    select * from private.push_jobs
    where (state = 'pending' and available_at <= now())
       or (state = 'sending' and lease_until < now())
    order by
      case
        when exists(select 1 from public.notifications n where n.id = private.push_jobs.notification_id and n.kind = 'study_reminder') then 0
        when exists(select 1 from public.notifications n where n.id = private.push_jobs.notification_id and n.kind = 'daily_questions') then 1
        when exists(select 1 from public.notifications n where n.id = private.push_jobs.notification_id and n.kind = 'leaderboard_overtaken') then 2
        else 3
      end,
      available_at,
      id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 20), 1), 20)
  loop
    if j.attempts >= 8 then
      update private.push_jobs set state = 'failed', last_code = 'attempt_limit', updated_at = now() where id = j.id;
      continue;
    end if;
    update private.push_jobs
      set state = 'sending', lease = gen_random_uuid(), lease_until = now() + interval '2 minutes',
          attempts = attempts + 1, updated_at = now()
      where id = j.id
      returning * into j;
    result := result || jsonb_build_array(jsonb_build_object('id', j.id, 'lease', j.lease));
  end loop;
  return result;
end;
$$;

create or replace function public.authorize_push_job_v1(p_id uuid, p_lease uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j private.push_jobs;
  n public.notifications;
  t public.push_tokens;
  p private.notification_preferences;
  next_at timestamptz;
  gate private.push_delivery_windows;
  v_immediate boolean;
begin
  select * into j from private.push_jobs where id = p_id and lease = p_lease and state = 'sending' and lease_until > now() for update;
  if not found then return null; end if;
  select * into n from public.notifications where id = j.notification_id;
  select * into t from public.push_tokens where id = j.token_id;
  insert into private.notification_preferences(user_id) values (j.user_id) on conflict do nothing;
  select * into p from private.notification_preferences where user_id = j.user_id;
  if not private.push_allowed(j.user_id) then
    update private.push_jobs set state = 'pending', available_at = now() + interval '1 minute', lease = null, lease_until = null,
      attempts = greatest(attempts - 1, 0), updated_at = now() where id = j.id;
    return null;
  end if;
  if n.expires_at <= now() then
    update private.push_jobs set state = 'expired', updated_at = now() where id = j.id;
    return null;
  end if;
  if n.read_at is not null or t.revoked_at is not null or t.consented_at > n.created_at or not private.valid_push_subscription(t.delivery_config)
    or not exists(select 1 from public.profiles where id = j.user_id and deactivated_at is null)
    or not coalesce((to_jsonb(p)->>n.category)::boolean, false) or not private.push_relevant(n) then
    update private.push_jobs set state = 'skipped', updated_at = now(), last_code = 'no_longer_eligible' where id = j.id;
    return null;
  end if;
  v_immediate := n.kind in ('battle_invitation', 'battle_accepted', 'daily_questions', 'study_reminder');
  insert into private.push_delivery_windows(token_id) values (j.token_id) on conflict do nothing;
  select * into gate from private.push_delivery_windows where token_id = j.token_id for update;
  next_at := private.push_next_time(
    greatest(now(), case when v_immediate or gate.job_id = j.id then now() else gate.next_at end,
      case when n.kind = 'course_content' then n.created_at + interval '5 minutes' else now() end),
    p.timezone, p.quiet_start, p.quiet_end);
  if next_at > now() then
    update private.push_jobs set state = case when next_at >= n.expires_at then 'expired' else 'pending' end,
      available_at = next_at, lease = null, lease_until = null, attempts = greatest(attempts - 1, 0), updated_at = now()
      where id = j.id;
    return null;
  end if;
  update private.push_delivery_windows
    set next_at = now() + interval '30 minutes', job_id = j.id
    where token_id = j.token_id and n.kind not in ('battle_invitation', 'battle_accepted', 'daily_questions', 'study_reminder');
  return jsonb_build_object(
    'subscription', t.delivery_config,
    'attempts', j.attempts,
    'expires_at', n.expires_at,
    'payload', jsonb_build_object(
      'id', n.id,
      'kind', n.kind,
      'title', n.title,
      'body', n.body,
      'target', coalesce(n.safe_target, '/notification-settings'),
      'expires_at', n.expires_at,
      'device_key', t.device_key
    )
  );
end;
$$;

revoke all on function private.daily_question_eligible(uuid, uuid), private.prepare_daily_questions(timestamptz) from public, anon, authenticated;

commit;
