begin;

create or replace function public.publish_lecturer_quiz_v1(p_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_user();
  q private.lecturer_course_quizzes;
begin
  select * into q from private.lecturer_course_quizzes where id = p_id for update;
  if not found or not private.challenge_teacher(q.offering_id, u) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if q.status = 'published' then
    return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
  end if;
  if q.status <> 'draft' then perform private.raise_error('INVALID_STATE'); end if;
  if q.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if jsonb_array_length(q.questions) not between 1 and 100 then
    perform private.raise_error('VALIDATION_FAILED', 'Add at least one question.');
  end if;
  if q.opens_at is null or q.closes_at is null or q.closes_at <= q.opens_at then
    perform private.raise_error('VALIDATION_FAILED', 'Set when the quiz opens and closes.');
  end if;
  if q.closes_at <= clock_timestamp() then
    perform private.raise_error('VALIDATION_FAILED', 'Close time must be in the future.');
  end if;
  if not exists(select 1 from public.course_offerings where id = q.offering_id and status = 'published') then
    perform private.raise_error('CONTENT_UNAVAILABLE');
  end if;
  update private.lecturer_course_quizzes set status = 'published', revision = revision + 1 where id = p_id returning * into q;
  insert into public.notifications(user_id, kind, title, body, safe_target, event_key, category, context, expires_at)
  select
    e.user_id,
    'course_quiz',
    c.title,
    'New class quiz in ' || c.title || ': ' || q.title,
    '/course-quizzes/' || q.id::text,
    'course-quiz:' || q.id::text || ':' || e.user_id::text,
    'academic',
    jsonb_build_object('offering_id', q.offering_id, 'quiz_id', q.id),
    greatest(q.closes_at, clock_timestamp() + interval '24 hours')
  from public.enrollments e
  join public.course_offerings o on o.id = q.offering_id
  join public.courses c on c.id = o.course_id
  where e.offering_id = q.offering_id and e.ended_at is null and private.challenge_student(q.offering_id, e.user_id)
  on conflict (event_key) do nothing;
  perform private.audit(u, 'publish_lecturer_quiz', 'lecturer_quiz', q.id, null);
  return private.envelope(jsonb_build_object('quiz', private.quiz_summary(q)));
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
  elsif new.kind = 'course_quiz' then
    new.category := 'academic';
    new.title := coalesce(nullif(btrim(new.title), ''), 'Class quiz');
  end if;
  if new.kind = 'course_quiz' then
    new.expires_at := coalesce(new.expires_at, coalesce(new.created_at, now()) + interval '24 hours');
  else
    new.expires_at := least(
      coalesce(new.expires_at, coalesce(new.created_at, now()) + interval '24 hours'),
      coalesce(new.created_at, now()) + interval '24 hours'
    );
  end if;
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
  if n.context ? 'offering_id' and not private.challenge_student((n.context->>'offering_id')::uuid, n.user_id) then return false; end if;
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

create or replace function public.get_home_summary_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles;
  v_continue jsonb;
  v_cap integer;
begin
  select * into v_profile from public.profiles where id = v_uid;

  select jsonb_build_object('kind', 'resume', 'lesson_id', l.id, 'lesson_version_id', lv.id, 'title', lv.title,
                            'estimated_minutes', lv.estimated_minutes, 'course_id', l.course_id, 'course_title', c.title,
                            'offering_id', e.offering_id)
    into v_continue
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
    join public.courses c on c.id = l.course_id
    join public.course_offerings o on o.course_id = l.course_id and o.status = 'published'
    join public.enrollments e on e.offering_id = o.id and e.user_id = v_uid and e.ended_at is null
   where lp.user_id = v_uid and lp.state = 'started'
   order by lp.updated_at desc
   limit 1;

  if v_continue is null then
    select jsonb_build_object('kind', 'next', 'lesson_id', l.id, 'lesson_version_id', lv.id, 'title', lv.title,
                              'estimated_minutes', lv.estimated_minutes, 'course_id', l.course_id, 'course_title', c.title,
                              'offering_id', e.offering_id)
      into v_continue
      from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id and o.status = 'published'
      join public.courses c on c.id = o.course_id
      join public.lessons l on l.course_id = o.course_id
      join public.modules m on m.id = l.module_id
      join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
     where e.user_id = v_uid and e.ended_at is null
       and not exists (select 1 from public.lesson_progress lp
                       where lp.user_id = v_uid and lp.lesson_id = l.id and lp.state = 'completed')
     order by e.enrolled_at desc, m.position, l.position
     limit 1;
  end if;

  select r.daily_cap into v_cap from private.point_rules r
  where r.code = 'lesson_complete' and r.effective_from <= now() and (r.effective_until is null or r.effective_until > now())
  order by r.version desc limit 1;

  return private.envelope(jsonb_build_object(
    'display_name', v_profile.display_name,
    'welcome_xp_awarded', exists(select 1 from public.points_ledger where user_id=v_uid and event_key='signup:welcome' and amount=10),
    'needs_onboarding', v_profile.university_id is null,
    'xp_total', coalesce((select total from public.user_points where user_id = v_uid), 0),
    'learning_xp_today', coalesce((select sum(amount) from public.points_ledger where user_id=v_uid and local_date=private.lagos_date() and source_type in ('lesson','review','practice','mock')),0),
    'learning_xp_daily_cap', v_cap,
    'streak', private.streak(v_uid),
    'premium', private.has_entitlement(v_uid),
    'continue_learning', v_continue,
    'enrolled_courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'offering_id', o.id, 'course_id', c.id, 'code', c.code, 'title', c.title,
        'lessons_total', (select count(*) from public.lessons l where l.course_id = c.id
                          and exists (select 1 from public.lesson_versions lv where lv.lesson_id = l.id and lv.status = 'published')),
        'lessons_completed', (select count(*) from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
                              where lp.user_id = v_uid and l.course_id = c.id and lp.state = 'completed')
      ) order by e.enrolled_at desc)
      from public.enrollments e
      join public.course_offerings o on o.id = e.offering_id and o.status = 'published'
      join public.courses c on c.id = o.course_id
      where e.user_id = v_uid and e.ended_at is null), '[]'::jsonb),
    'recent_activity', coalesce((
      select jsonb_agg(x.item order by x.created_at desc) from (
        select jsonb_build_object('kind', a.kind, 'source_id', a.source_id, 'local_date', a.local_date, 'created_at', a.created_at,
                                  'xp', coalesce((select sum(l.amount) from public.points_ledger l
                                                  where l.user_id = v_uid and l.source_id = a.source_id), 0)) as item,
               a.created_at
        from public.activity_events a where a.user_id = v_uid
        order by a.created_at desc limit 10) x), '[]'::jsonb),
    'live_battle', (select jsonb_build_object('battle_id', s.battle_id, 'queue_id', s.queue_id, 'expires_at', s.expires_at)
                    from private.battle_slots s where s.user_id = v_uid),
    'unread_notifications', (
      select count(*) from public.notifications n
      where n.user_id = v_uid and n.read_at is null and n.expires_at > clock_timestamp()
    )
  ));
end;
$$;

commit;
