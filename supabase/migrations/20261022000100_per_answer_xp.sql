-- Per-answer XP from rollout onward. Existing balances and immutable history are preserved.
-- Attempts remain idempotent; lesson/review rewards and battle eligibility limits stay unchanged.
begin;
create or replace function private.award_mastery_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.assessment_attempts;
  content public.assessments;
  v_type text; v_id uuid; v_max integer; v_target integer; v_old integer; v_delta integer;
  v_rule text; v_mastered timestamptz; v_inserted integer;
begin
  select * into a from public.assessment_attempts where id = p_attempt_id;
  if a.status <> 'submitted' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || a.user_id::text, 0));
  if exists (select 1 from public.points_ledger where user_id = a.user_id and event_key = 'mastery:' || a.id::text) then return; end if;
  select * into content from public.assessments where id = a.assessment_id;
  if content.kind = 'review' and content.lesson_id is not null and a.xp_review_stage is not null then
    select mastered_at into v_mastered from private.topic_mastery where user_id = a.user_id and lesson_id = content.lesson_id;
    if v_mastered is null or now() < v_mastered + make_interval(days => (array[1,7,30])[a.xp_review_stage])
       or (a.xp_review_stage > 1 and not exists (select 1 from private.review_awards
           where user_id = a.user_id and lesson_id = content.lesson_id and stage = a.xp_review_stage-1)) then
      perform private.raise_error('VALIDATION_FAILED', 'This review is not due yet.');
    end if;
    v_delta := 0;
    if a.correct_count * 5 >= a.total_count * 4 then
      insert into private.review_awards(user_id,lesson_id,stage,attempt_id)
        values(a.user_id,content.lesson_id,a.xp_review_stage,a.id) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then v_delta := 10; end if;
      if (select count(*) from private.review_awards where user_id=a.user_id and lesson_id=content.lesson_id)=3 then
        perform private.grant_xp_badge(a.user_id,'long_term_recall');
      end if;
    end if;
    perform private.award_points(a.user_id,'review_correct','review',a.id,'mastery:' || a.id::text,v_delta);
    return;
  end if;
  if content.kind = 'review' then
    if content.lesson_id is null then return; end if;
    v_type := 'lesson'; v_id := content.lesson_id; v_max := 20; v_rule := 'lesson_complete';
    perform private.grant_xp_badge(a.user_id,'first_steps');
    if a.correct_count * 5 >= a.total_count * 4 then
      insert into private.topic_mastery(user_id,lesson_id) values(a.user_id,content.lesson_id) on conflict do nothing;
      perform private.grant_xp_badge(a.user_id,'topic_mastered');
    end if;
  elsif content.kind = 'practice' then
    v_type := 'practice'; v_id := content.id; v_max := a.total_count; v_rule := 'practice_first';
    if a.correct_count = a.total_count then perform private.grant_xp_badge(a.user_id,'perfect_practice'); end if;
  elsif content.kind = 'mock' then
    v_type := 'mock'; v_id := content.id; v_max := a.total_count; v_rule := 'mock_first';
    if a.correct_count * 5 >= a.total_count * 4 then perform private.grant_xp_badge(a.user_id,'exam_ready'); end if;
  else return;
  end if;
  -- Each submitted practice/mock earns one XP per correct answer, once per attempt.
  if content.kind in ('practice', 'mock') then
    perform private.award_points(a.user_id,v_rule,v_type,a.id,'mastery:' || a.id::text,coalesce(a.correct_count,0));
    return;
  end if;
  insert into private.xp_bests(user_id,activity_type,activity_id) values(a.user_id,v_type,v_id) on conflict do nothing;
  select earned into v_old from private.xp_bests where user_id=a.user_id and activity_type=v_type and activity_id=v_id for update;
  v_target := floor(v_max::numeric * coalesce(a.correct_count,0) / a.total_count)::integer;
  v_delta := greatest(v_target-v_old,0);
  perform private.award_points(a.user_id,v_rule,v_type,a.id,'mastery:' || a.id::text,v_delta);
  update private.xp_bests set earned=greatest(earned,v_target) where user_id=a.user_id and activity_type=v_type and activity_id=v_id;
end $$;

create or replace function private.finalize_battle(p_battle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
  v_rules public.battle_rules;
  v_c1 integer;
  v_c2 integer;
  v_u1 uuid;
  v_u2 uuid;
  v_winner uuid;
  v_kind text;
  r record;
  v_code text;
  v_xp integer;
  v_awarded integer;
begin
  select * into b from public.battles where id = p_battle_id for update;
  if not found then
    return null;
  end if;
  if b.state not in ('countdown', 'active') or b.ends_at is null or b.ends_at > now() then
    return b.state;
  end if;
  select * into v_rules from public.battle_rules where id = b.rules_id;

  -- Serialize XP for both participants before any award to avoid crossed-player deadlocks.
  for r in select user_id from public.battle_participants where battle_id=p_battle_id order by user_id loop
    perform pg_advisory_xact_lock(hashtextextended('scholau.xp:' || r.user_id::text,0));
  end loop;

  update public.battle_answers ba
     set is_correct = (ba.option_id = k.correct_option_id)
    from private.question_answer_keys k
   where ba.battle_id = p_battle_id and k.question_version_id = ba.question_version_id;

  update public.battle_participants bp
     set correct_count = (select count(*) from public.battle_answers ba
                          join public.battle_questions bq on bq.battle_id = ba.battle_id and bq.position = ba.position
                          where ba.battle_id = bp.battle_id and ba.user_id = bp.user_id and ba.is_correct
                            and ba.received_at < bq.deadline),
         activity_date = private.lagos_date()
   where bp.battle_id = p_battle_id;

  select user_id, correct_count into v_u1, v_c1 from public.battle_participants where battle_id = p_battle_id and seat = 1;
  select user_id, correct_count into v_u2, v_c2 from public.battle_participants where battle_id = p_battle_id and seat = 2;

  if v_c1 > v_c2 then
    v_winner := v_u1; v_kind := 'win';
  elsif v_c2 > v_c1 then
    v_winner := v_u2; v_kind := 'win';
  else
    v_winner := null; v_kind := 'draw';
  end if;

  update public.battles
     set state = 'finished', result_kind = v_kind, winner_user_id = v_winner, finalized_at = now(), revision = revision + 1
   where id = p_battle_id;

  for r in select bp.user_id, bp.correct_count from public.battle_participants bp where bp.battle_id = p_battle_id order by bp.user_id loop
    if v_winner is null then
      v_code := 'battle_draw'; v_xp := 2 * r.correct_count;
    elsif v_winner = r.user_id then
      v_code := 'battle_win'; v_xp := 2 * r.correct_count + 20;
    else
      v_code := 'battle_loss'; v_xp := 2 * r.correct_count;
    end if;
    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (r.user_id, 'battle_completed', p_battle_id, private.lagos_date())
    on conflict do nothing;
    v_awarded := private.award_mastery_battle(r.user_id, p_battle_id, v_code, v_xp);
    insert into public.notifications (user_id, kind, body, safe_target, event_key)
    values (r.user_id, 'battle_finished',
            case v_code when 'battle_win' then 'You won your battle' when 'battle_draw' then 'Your battle ended in a draw'
                        else 'Your battle is over' end || format(' (+%s XP).', v_awarded),
            '/battles/' || p_battle_id::text, 'battle_finished:' || p_battle_id::text || ':' || r.user_id::text)
    on conflict (event_key) do nothing;
  end loop;

  delete from private.battle_slots where battle_id = p_battle_id;
  delete from private.battle_invites where battle_id = p_battle_id;
  perform private.battle_event(p_battle_id);
  return 'finished';
end;
$$;

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
               when p_source_type in ('practice','mock') then 'One XP per correct answer.'
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
commit;
