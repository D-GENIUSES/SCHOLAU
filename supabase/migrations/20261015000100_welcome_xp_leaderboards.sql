-- New accounts receive a single welcome award. Existing accounts are not backfilled.
alter table private.point_rules drop constraint point_rules_code_check;
alter table private.point_rules add constraint point_rules_code_check check
  (code in ('lesson_complete','review_correct','practice_first','mock_first','battle_win','battle_draw','battle_loss','signup_welcome'));
alter table public.points_ledger drop constraint points_ledger_source_type_check;
alter table public.points_ledger add constraint points_ledger_source_type_check check
  (source_type in ('lesson','review','practice','mock','battle','correction','signup'));

insert into private.point_rules(code,version,amount,daily_cap,policy,effective_from)
values('signup_welcome',1,10,null,'{"system":"mastery_v2","once_per_account":true}',now());

create or replace function private.award_points(
  p_user_id uuid, p_rule_code text, p_source_type text, p_source_id uuid, p_event_key text,
  p_requested integer default null, p_at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule private.point_rules;
  v_date date := private.lagos_date(p_at);
  v_requested integer;
  v_amount integer;
  v_id uuid;
begin
  if exists (select 1 from public.points_ledger l where l.user_id = p_user_id and l.event_key = p_event_key) then
    return 0;
  end if;

  select * into v_rule from private.point_rules r
  where r.code = p_rule_code and r.effective_from <= p_at and (r.effective_until is null or r.effective_until > p_at)
  order by r.version desc limit 1;
  if not found then
    raise exception 'no active point rule for %', p_rule_code;
  end if;

  v_requested := greatest(coalesce(p_requested, v_rule.amount), 0);
  v_amount := v_requested;


  insert into public.points_ledger (user_id, source_type, source_id, event_key, rule_id, requested_amount, amount,
                                    cap_applied, local_date, reason)
  values (p_user_id, p_source_type, p_source_id, p_event_key, v_rule.id, v_requested, v_amount,
          false, v_date,
          case when p_source_type='signup' then 'Welcome to ScholAu! Your one-time 10 XP signup reward.'
               when p_source_type='battle' and v_amount=0 and exists(select 1 from private.battle_xp_counts where user_id=p_user_id and local_date=v_date and completed>10)
                 then 'Daily battle XP limit reached.'
               when p_source_type='battle' and v_amount=0 and exists(select 1 from private.battle_opponent_counts where user_id=p_user_id and local_date=v_date and completed>2
                 and opponent_id in (select user_id from public.battle_participants where battle_id=p_source_id and user_id<>p_user_id))
                 then 'Opponent battle XP limit reached.'
               when p_source_type='battle' then 'Correct answers plus match result bonus.'
               when p_source_type='review' and v_amount>0 then 'Scheduled review completed at 80% or higher.'
               when p_source_type='review' then 'Review threshold not met or this stage was already rewarded.'
               when v_amount=0 then 'Best score unchanged. Improve your best score to earn more XP.'
               else 'Initial achievement or personal-best improvement.' end)
  on conflict (user_id, event_key) do nothing
  returning id into v_id;

  if v_id is null then
    return 0;
  end if;


  if v_amount <> 0 then
    insert into public.user_points (user_id, total) values (p_user_id, v_amount)
    on conflict (user_id) do update set total = public.user_points.total + excluded.total, updated_at = now();
  end if;
  return v_amount;
end;
$$;

create or replace function private.create_user_points()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_points(user_id) values(new.id) on conflict do nothing;
  perform private.award_points(new.id,'signup_welcome','signup',new.id,'signup:welcome',10);
  return new;
end;
$$;
revoke all on function private.create_user_points() from public,anon,authenticated;
-- Signed-in students can compare XP. Existing filtering and privacy rules remain in force.
revoke all on function public.get_leaderboard_v1(text,uuid,text,integer) from public,anon;
grant execute on function public.get_leaderboard_v1(text,uuid,text,integer) to authenticated;

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

  -- Last unfinished lesson in an actively enrolled course, else first uncompleted lesson.
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
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null)
  ));
end;
$$;
