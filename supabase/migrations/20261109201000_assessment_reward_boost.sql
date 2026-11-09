-- Award boosted XP and new badges on future practice and mock submissions.
begin;

alter table private.xp_badges drop constraint xp_badges_code_check;
alter table private.xp_badges add constraint xp_badges_code_check check (code in (
  'first_steps', 'topic_mastered', 'perfect_practice', 'exam_ready', 'long_term_recall',
  'first_quiz', 'quiz_ace', 'first_mock', 'perfect_mock'
));

create or replace function private.award_mastery_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a public.assessment_attempts;
  content public.assessments;
  v_type text; v_id uuid; v_max integer; v_target integer; v_old integer; v_delta integer;
  v_rule text; v_mastered timestamptz; v_inserted integer;
begin
  select * into a from public.assessment_attempts where id = p_attempt_id;
  if not found or a.status <> 'submitted' then return; end if;
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
    perform private.grant_xp_badge(a.user_id,'first_quiz');
    if a.correct_count * 5 >= a.total_count * 4 then
      perform private.grant_xp_badge(a.user_id,'quiz_ace');
    end if;
    if a.correct_count = a.total_count then perform private.grant_xp_badge(a.user_id,'perfect_practice'); end if;
  elsif content.kind = 'mock' then
    v_type := 'mock'; v_id := content.id; v_max := a.total_count; v_rule := 'mock_first';
    perform private.grant_xp_badge(a.user_id,'first_mock');
    if a.correct_count * 5 >= a.total_count * 4 then perform private.grant_xp_badge(a.user_id,'exam_ready'); end if;
    if a.correct_count = a.total_count then perform private.grant_xp_badge(a.user_id,'perfect_mock'); end if;
  else return;
  end if;
  -- Score rewards are calculated from the final server-graded counts.
  if content.kind in ('practice', 'mock') then
    v_delta := coalesce(a.correct_count,0) * case when content.kind = 'mock' then 3 else 2 end;
    if a.correct_count * 5 >= a.total_count * 4 then
      v_delta := v_delta + case when content.kind = 'mock' then 15 else 5 end;
    end if;
    perform private.award_points(a.user_id,v_rule,v_type,a.id,'mastery:' || a.id::text,v_delta);
    return;
  end if;
  insert into private.xp_bests(user_id,activity_type,activity_id) values(a.user_id,v_type,v_id) on conflict do nothing;
  select earned into v_old from private.xp_bests where user_id=a.user_id and activity_type=v_type and activity_id=v_id for update;
  v_target := floor(v_max::numeric * coalesce(a.correct_count,0) / a.total_count)::integer;
  v_delta := greatest(v_target-v_old,0);
  perform private.award_points(a.user_id,v_rule,v_type,a.id,'mastery:' || a.id::text,v_delta);
  update private.xp_bests set earned=greatest(earned,v_target) where user_id=a.user_id and activity_type=v_type and activity_id=v_id;
end $$;

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
               when p_source_type='practice' then '2 XP per correct answer, plus 5 XP for scoring at least 80%.'
               when p_source_type='mock' then '3 XP per correct answer, plus 15 XP for scoring at least 80%.'
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
