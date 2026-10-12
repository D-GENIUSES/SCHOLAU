-- ScholAu migration 6c: 1v1 battles (direct invite + queue), authoritative schedule, finalization.
-- See 20261012000600_rpc_foundation.sql for the error convention and lock order.
--
-- Rules (D04-D06, D13): rules snapshot per battle; one live slot per user (not a quota);
-- unlimited participation; no premium gate; every battle reaching its scheduled end is graded and
-- rewards both players outside the learning cap; pre-start cancel / early forfeit = no XP;
-- disconnect alone never forfeits. Deadlines are fixed server timestamps; late workers never
-- extend answer eligibility. Results never reveal battle answer keys (D10).

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function private.active_battle_rules()
returns public.battle_rules
language sql
stable
set search_path = ''
as $$
  select * from public.battle_rules r
  where r.published_at is not null and r.published_at <= now()
  order by r.version desc limit 1
$$;

create or replace function private.battle_pool_size(p_course_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.questions q
  join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
  where q.course_id = p_course_id and q.pool = 'battle' and 'battle' = any (qv.usage)
$$;

create or replace function private.battle_event(p_battle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
begin
  select * into b from public.battles where id = p_battle_id;
  perform private.enqueue_event('battle:' || b.id::text, 'state',
    jsonb_build_object('battle_id', b.id, 'state', b.state, 'revision', b.revision,
                       'ready_deadline', b.ready_deadline, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
                       'server_time', now()),
    'battle:' || b.id::text || ':' || b.revision::text);
end;
$$;

-- Releases stale reservations for one user (terminal battle, closed/expired queue entry).
create or replace function private.release_stale_slot(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.battle_slots s
  where s.user_id = p_user_id
    and (
      (s.battle_id is not null and exists (select 1 from public.battles b where b.id = s.battle_id
                                           and b.state in ('finished', 'cancelled', 'voided')))
      or (s.queue_id is not null and exists (select 1 from public.battle_queue q where q.id = s.queue_id
                                             and (q.state <> 'waiting' or q.expires_at <= now())))
    );
end;
$$;

-- Claims the single live slot or raises SLOT_BUSY (with ids so the client can resume).
create or replace function private.claim_slot(p_user_id uuid, p_queue_id uuid, p_battle_id uuid, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot private.battle_slots;
begin
  perform private.release_stale_slot(p_user_id);
  insert into private.battle_slots (user_id, queue_id, battle_id, expires_at)
  values (p_user_id, p_queue_id, p_battle_id, p_expires_at)
  on conflict (user_id) do nothing;
  if not found then
    select * into v_slot from private.battle_slots where user_id = p_user_id;
    perform private.raise_error('SLOT_BUSY', null,
      jsonb_strip_nulls(jsonb_build_object('battle_id', v_slot.battle_id, 'queue_id', v_slot.queue_id)));
  end if;
end;
$$;

create or replace function private.cancel_battle(p_battle_id uuid, p_reason text, p_result_kind text default 'cancelled')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.battles
     set state = 'cancelled', result_kind = p_result_kind, cancel_reason = p_reason, finalized_at = now(),
         winner_user_id = null, revision = revision + 1
   where id = p_battle_id and state in ('waiting', 'ready', 'countdown', 'active');
  if found then
    delete from private.battle_slots where battle_id = p_battle_id;
    delete from private.battle_invites where battle_id = p_battle_id;
    perform private.battle_event(p_battle_id);
  end if;
end;
$$;

-- Grades and finalizes a battle whose scheduled end has passed. Awards XP once per participant
-- (uncapped), writes activity and notifications. Safe under worker/client concurrency.
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

  for r in select bp.user_id from public.battle_participants bp where bp.battle_id = p_battle_id order by bp.user_id loop
    if v_winner is null then
      v_code := 'battle_draw'; v_xp := v_rules.draw_xp;
    elsif v_winner = r.user_id then
      v_code := 'battle_win'; v_xp := v_rules.win_xp;
    else
      v_code := 'battle_loss'; v_xp := v_rules.loss_xp;
    end if;
    insert into public.activity_events (user_id, kind, source_id, local_date)
    values (r.user_id, 'battle_completed', p_battle_id, private.lagos_date())
    on conflict do nothing;
    v_awarded := private.award_points(r.user_id, v_code, 'battle', p_battle_id, 'battle:' || p_battle_id::text, v_xp);
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

-- Applies any due time-based transition. Idempotent; never extends deadlines.
create or replace function private.advance_battle(p_battle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
begin
  select * into b from public.battles where id = p_battle_id for update;
  if not found then
    return null;
  end if;
  if b.state = 'waiting' and b.invitation_expires_at is not null and b.invitation_expires_at <= now() then
    perform private.cancel_battle(p_battle_id, 'invite_expired');
  elsif b.state = 'ready' and b.ready_deadline is not null and b.ready_deadline <= now() then
    perform private.cancel_battle(p_battle_id, 'ready_timeout');
  elsif b.state in ('countdown', 'active') and b.ends_at <= now() then
    perform private.finalize_battle(p_battle_id);
  elsif b.state = 'countdown' and b.starts_at <= now() then
    update public.battles set state = 'active', revision = revision + 1 where id = p_battle_id;
    perform private.battle_event(p_battle_id);
  end if;
  select state into b.state from public.battles where id = p_battle_id;
  return b.state;
end;
$$;

-- Commits the countdown and the complete per-question schedule (TR-07). Caller holds battle lock.
create or replace function private.schedule_battle(p_battle_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
  v_rules public.battle_rules;
  v_course uuid;
  v_starts timestamptz;
  v_count integer;
begin
  select * into b from public.battles where id = p_battle_id for update;
  select * into v_rules from public.battle_rules where id = b.rules_id;
  select course_id into v_course from public.course_offerings where id = b.offering_id;

  v_starts := now() + make_interval(secs => v_rules.countdown_seconds);

  insert into public.battle_questions (battle_id, position, question_version_id, opened_at, deadline, option_order)
  select p_battle_id, s.n, s.qv_id,
         v_starts + make_interval(secs => (s.n - 1) * b.seconds_per_round),
         v_starts + make_interval(secs => s.n * b.seconds_per_round),
         (select array_agg(o.id order by random()) from public.question_options o where o.question_version_id = s.qv_id)
  from (
    select x.qv_id, row_number() over (order by random())::integer as n
    from (
      select qv.id as qv_id
      from public.questions q
      join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
      where q.course_id = v_course and q.pool = 'battle' and 'battle' = any (qv.usage)
      order by random()
      limit b.round_count
    ) x
  ) s;
  get diagnostics v_count = row_count;

  if v_count < b.round_count then
    delete from public.battle_questions where battle_id = p_battle_id;
    perform private.cancel_battle(p_battle_id, 'content_unavailable');
    return false;
  end if;

  update public.battles
     set state = 'countdown', starts_at = v_starts,
         ends_at = v_starts + make_interval(secs => b.round_count * b.seconds_per_round),
         revision = revision + 1
   where id = p_battle_id
  returning * into b;

  update public.battle_participants set activated_at = now() where battle_id = p_battle_id;
  update private.battle_slots set expires_at = b.ends_at + interval '10 minutes' where battle_id = p_battle_id;
  perform private.battle_event(p_battle_id);
  return true;
end;
$$;

create or replace function private.create_matched_battle(p_q1 public.battle_queue, p_q2 public.battle_queue)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules public.battle_rules := private.active_battle_rules();
  v_battle_id uuid;
  v_ready timestamptz := now() + make_interval(secs => v_rules.ready_seconds);
begin
  insert into public.battles (offering_id, rules_id, mode, state, created_by, ready_deadline, round_count, seconds_per_round)
  values (p_q1.offering_id, v_rules.id, 'queue', 'ready', p_q1.user_id, v_ready, v_rules.round_count, v_rules.seconds_per_round)
  returning id into v_battle_id;

  insert into public.battle_participants (battle_id, user_id, seat) values
    (v_battle_id, p_q1.user_id, 1),
    (v_battle_id, p_q2.user_id, 2);

  update public.battle_queue set state = 'matched', matched_battle_id = v_battle_id, closed_at = now()
  where id in (p_q1.id, p_q2.id);

  update private.battle_slots
     set queue_id = null, battle_id = v_battle_id, expires_at = v_ready + interval '10 minutes'
   where user_id in (p_q1.user_id, p_q2.user_id);

  perform private.enqueue_event('user:' || p_q1.user_id::text, 'battle_matched',
    jsonb_build_object('battle_id', v_battle_id, 'queue_id', p_q1.id), 'battle_matched:' || p_q1.id::text);
  perform private.enqueue_event('user:' || p_q2.user_id::text, 'battle_matched',
    jsonb_build_object('battle_id', v_battle_id, 'queue_id', p_q2.id), 'battle_matched:' || p_q2.id::text);
  perform private.battle_event(v_battle_id);
  return v_battle_id;
end;
$$;

-- Pairs waiting queue entries of one offering (oldest first). Serialized per offering.
create or replace function private.match_queue(p_offering_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q1 public.battle_queue;
  v_q2 public.battle_queue;
  v_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('scholau.queue:' || p_offering_id::text, 0));
  loop
    select * into v_q1 from public.battle_queue q
    where q.offering_id = p_offering_id and q.state = 'waiting' and q.expires_at > now()
    order by q.queued_at, q.id
    limit 1
    for update skip locked;
    exit when not found;

    select * into v_q2 from public.battle_queue q
    where q.offering_id = p_offering_id and q.state = 'waiting' and q.expires_at > now()
      and q.user_id <> v_q1.user_id and q.id <> v_q1.id
    order by q.queued_at, q.id
    limit 1
    for update skip locked;
    exit when not found;

    perform private.create_matched_battle(v_q1, v_q2);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Redacted participant view of a battle (no future prompts, no opponent choices during play,
-- never correct option ids).
create or replace function private.battle_payload(p_battle_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with b as (select * from public.battles where id = p_battle_id),
  me as (select * from public.battle_participants where battle_id = p_battle_id and user_id = p_user_id),
  cur as (
    select bq.* from public.battle_questions bq, b
    where bq.battle_id = p_battle_id and b.state in ('countdown', 'active')
      and bq.opened_at <= now() and now() < bq.deadline
  )
  select jsonb_build_object(
    'battle_id', b.id,
    'mode', b.mode,
    'state', b.state,
    'revision', b.revision,
    'offering_id', b.offering_id,
    'course', (select jsonb_build_object('id', c.id, 'code', c.code, 'title', c.title)
               from public.course_offerings o join public.courses c on c.id = o.course_id where o.id = b.offering_id),
    'round_count', b.round_count,
    'seconds_per_round', b.seconds_per_round,
    'invitation_expires_at', b.invitation_expires_at,
    'ready_deadline', b.ready_deadline,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'finalized_at', b.finalized_at,
    'result_kind', b.result_kind,
    'cancel_reason', b.cancel_reason,
    'invite_token', case when b.state = 'waiting' and b.created_by = p_user_id
                         then (select i.token from private.battle_invites i where i.battle_id = b.id) end,
    'me', (select jsonb_build_object('seat', me.seat, 'ready', me.ready_at is not null, 'forfeited', me.forfeited_at is not null)
           from me),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', bp.seat,
        'display_name', p.display_name,
        'avatar_path', p.avatar_path,
        'is_me', bp.user_id = p_user_id,
        'ready', bp.ready_at is not null,
        'forfeited', bp.forfeited_at is not null,
        'correct_count', case when b.state in ('finished', 'voided') then bp.correct_count end
      ) order by bp.seat)
      from public.battle_participants bp join public.profiles p on p.id = bp.user_id
      where bp.battle_id = b.id), '[]'::jsonb),
    'current_question', (
      select jsonb_build_object(
        'position', cur.position,
        'prompt', qv.prompt,
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by ord.n)
                    from unnest(cur.option_order) with ordinality as ord(option_id, n)
                    join public.question_options o on o.id = ord.option_id),
        'opened_at', cur.opened_at,
        'deadline', cur.deadline,
        'my_option_id', (select ba.option_id from public.battle_answers ba
                         where ba.battle_id = b.id and ba.user_id = p_user_id and ba.position = cur.position))
      from cur join public.question_versions qv on qv.id = cur.question_version_id),
    'next_question_at', (select min(bq.opened_at) from public.battle_questions bq
                         where bq.battle_id = b.id and b.state in ('countdown', 'active') and bq.opened_at > now()),
    'my_answered_positions', coalesce((select jsonb_agg(ba.position order by ba.position) from public.battle_answers ba
                                       where ba.battle_id = b.id and ba.user_id = p_user_id), '[]'::jsonb),
    'rounds', case when b.state in ('finished', 'voided') then coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', bq.position,
        'prompt', qv.prompt,
        'my_option_id', mine.option_id,
        'my_is_correct', coalesce(mine.is_correct, false),
        'opponent_is_correct', coalesce(theirs.is_correct, false)
      ) order by bq.position)
      from public.battle_questions bq
      join public.question_versions qv on qv.id = bq.question_version_id
      left join public.battle_answers mine on mine.battle_id = bq.battle_id and mine.position = bq.position and mine.user_id = p_user_id
      left join public.battle_answers theirs on theirs.battle_id = bq.battle_id and theirs.position = bq.position and theirs.user_id <> p_user_id
      where bq.battle_id = b.id), '[]'::jsonb) end,
    'outcome', case when b.state in ('finished', 'voided') then jsonb_build_object(
      'result', case when b.result_kind = 'draw' then 'draw' when b.winner_user_id = p_user_id then 'win' else 'loss' end,
      'xp_awarded', coalesce((select sum(l.amount) from public.points_ledger l
                              where l.user_id = p_user_id and l.source_id = b.id), 0))
      when b.state = 'cancelled' then jsonb_build_object('result', 'cancelled', 'xp_awarded', 0) end
  )
  from b
$$;

create or replace function private.lock_participant_battle(p_uid uuid, p_battle_id uuid)
returns public.battles
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.battles;
begin
  select * into b from public.battles where id = p_battle_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Battle not found.');
  end if;
  if not exists (select 1 from public.battle_participants where battle_id = p_battle_id and user_id = p_uid) then
    perform private.raise_error('FORBIDDEN');
  end if;
  return b;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public battle RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_direct_battle_v1(p_offering_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_rules public.battle_rules;
  v_battle public.battles;
  v_token text;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_battle from public.battles where created_by = v_uid and request_key = p_request_key;
  if found then
    return private.envelope(private.battle_payload(v_battle.id, v_uid), p_request_key);
  end if;

  v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
  v_rules := private.active_battle_rules();
  if v_rules.id is null then
    perform private.raise_error('CONTENT_UNAVAILABLE', 'Battles are not configured.');
  end if;
  if private.battle_pool_size(v_offering.course_id) < v_rules.round_count then
    perform private.raise_error('CONTENT_UNAVAILABLE', 'This course does not have enough battle questions yet.');
  end if;
  if (select count(*) from public.battles where created_by = v_uid and created_at > now() - interval '10 minutes') >= 20 then
    perform private.raise_error('RATE_LIMITED');
  end if;

  insert into public.battles (offering_id, rules_id, mode, state, created_by, request_key, invitation_expires_at,
                              round_count, seconds_per_round)
  values (p_offering_id, v_rules.id, 'direct', 'waiting', v_uid, p_request_key,
          now() + make_interval(secs => v_rules.invite_seconds), v_rules.round_count, v_rules.seconds_per_round)
  returning * into v_battle;

  insert into public.battle_participants (battle_id, user_id, seat) values (v_battle.id, v_uid, 1);
  perform private.claim_slot(v_uid, null, v_battle.id, v_battle.invitation_expires_at);

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.battle_invites (battle_id, token) values (v_battle.id, v_token);

  perform private.battle_event(v_battle.id);
  return private.envelope(private.battle_payload(v_battle.id, v_uid), p_request_key);
end;
$$;

create or replace function public.accept_battle_v1(p_invite_token text, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_battle_id uuid;
  b public.battles;
  v_rules public.battle_rules;
  v_creator uuid;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select battle_id into v_battle_id from private.battle_invites where token = p_invite_token;
  if v_battle_id is null then
    perform private.raise_error('QUEUE_EXPIRED', 'This invitation is invalid or has expired.');
  end if;

  select * into b from public.battles where id = v_battle_id for update;
  if exists (select 1 from public.battle_participants where battle_id = b.id and user_id = v_uid) then
    if b.created_by = v_uid then
      perform private.raise_error('FORBIDDEN', 'You cannot accept your own invitation.');
    end if;
    return private.envelope(private.battle_payload(b.id, v_uid), p_request_key);
  end if;

  perform private.advance_battle(b.id);
  select * into b from public.battles where id = v_battle_id;
  if b.state = 'cancelled' then
    perform private.raise_error('QUEUE_EXPIRED', 'This invitation has expired.');
  end if;
  if b.state <> 'waiting' or (select count(*) from public.battle_participants where battle_id = b.id) >= 2 then
    perform private.raise_error('BATTLE_FULL');
  end if;

  perform private.require_offering_enrollment(v_uid, b.offering_id);
  select * into v_rules from public.battle_rules where id = b.rules_id;

  perform private.claim_slot(v_uid, null, b.id, now() + make_interval(secs => v_rules.ready_seconds) + interval '10 minutes');
  insert into public.battle_participants (battle_id, user_id, seat) values (b.id, v_uid, 2);

  update public.battles
     set state = 'ready', ready_deadline = now() + make_interval(secs => v_rules.ready_seconds), revision = revision + 1
   where id = b.id
  returning * into b;
  update private.battle_slots set expires_at = b.ready_deadline + interval '10 minutes' where battle_id = b.id;

  select created_by into v_creator from public.battles where id = b.id;
  insert into public.notifications (user_id, kind, body, safe_target, event_key)
  values (v_creator, 'battle_accepted', 'Your challenge was accepted. Get ready!', '/battles/' || b.id::text,
          'battle_accepted:' || b.id::text)
  on conflict (event_key) do nothing;

  perform private.battle_event(b.id);
  return private.envelope(private.battle_payload(b.id, v_uid), p_request_key);
end;
$$;

create or replace function public.join_queue_v1(p_offering_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_offering public.course_offerings;
  v_rules public.battle_rules;
  v_queue public.battle_queue;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_queue from public.battle_queue where user_id = v_uid and request_key = p_request_key;
  if not found then
    v_offering := private.require_offering_enrollment(v_uid, p_offering_id);
    v_rules := private.active_battle_rules();
    if v_rules.id is null then
      perform private.raise_error('CONTENT_UNAVAILABLE', 'Battles are not configured.');
    end if;
    if private.battle_pool_size(v_offering.course_id) < v_rules.round_count then
      perform private.raise_error('CONTENT_UNAVAILABLE', 'This course does not have enough battle questions yet.');
    end if;
    if (select count(*) from public.battle_queue where user_id = v_uid and queued_at > now() - interval '10 minutes') >= 30 then
      perform private.raise_error('RATE_LIMITED');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('scholau.queue:' || p_offering_id::text, 0));
    update public.battle_queue set state = 'expired', closed_at = now()
    where user_id = v_uid and state = 'waiting' and expires_at <= now();

    perform private.release_stale_slot(v_uid);
    begin
      insert into public.battle_queue (user_id, offering_id, request_key, expires_at)
      values (v_uid, p_offering_id, p_request_key, now() + make_interval(secs => v_rules.queue_seconds))
      returning * into v_queue;
    exception when unique_violation then
      perform private.raise_error('SLOT_BUSY', 'You are already waiting in a queue.',
        (select jsonb_build_object('queue_id', q.id) from public.battle_queue q where q.user_id = v_uid and q.state = 'waiting'));
    end;
    perform private.claim_slot(v_uid, v_queue.id, null, v_queue.expires_at);

    perform private.match_queue(p_offering_id);
    select * into v_queue from public.battle_queue where id = v_queue.id;
  end if;

  return private.envelope(jsonb_build_object(
    'queue_id', v_queue.id, 'offering_id', v_queue.offering_id, 'state', v_queue.state,
    'queued_at', v_queue.queued_at, 'expires_at', v_queue.expires_at, 'battle_id', v_queue.matched_battle_id), p_request_key);
end;
$$;

create or replace function public.leave_queue_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_queue public.battle_queue;
begin
  select * into v_queue from public.battle_queue where user_id = v_uid and state = 'waiting' for update;
  if found then
    update public.battle_queue set state = case when expires_at <= now() then 'expired' else 'cancelled' end, closed_at = now()
    where id = v_queue.id returning * into v_queue;
    delete from private.battle_slots where queue_id = v_queue.id;
  else
    select * into v_queue from public.battle_queue where user_id = v_uid order by queued_at desc limit 1;
  end if;
  return private.envelope(jsonb_build_object('queue_id', v_queue.id, 'state', v_queue.state,
                                             'battle_id', v_queue.matched_battle_id));
end;
$$;

create or replace function public.get_my_live_battle_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_slot private.battle_slots;
  v_queue public.battle_queue;
begin
  select * into v_slot from private.battle_slots where user_id = v_uid;
  if found and v_slot.battle_id is not null then
    perform private.advance_battle(v_slot.battle_id);
  elsif found and v_slot.queue_id is not null then
    update public.battle_queue set state = 'expired', closed_at = now()
    where id = v_slot.queue_id and state = 'waiting' and expires_at <= now();
  end if;
  perform private.release_stale_slot(v_uid);
  select * into v_slot from private.battle_slots where user_id = v_uid;
  if v_slot.queue_id is not null then
    select * into v_queue from public.battle_queue where id = v_slot.queue_id;
  end if;
  return private.envelope(jsonb_build_object(
    'queue', case when v_queue.id is null then null else jsonb_build_object(
      'queue_id', v_queue.id, 'offering_id', v_queue.offering_id, 'state', v_queue.state,
      'queued_at', v_queue.queued_at, 'expires_at', v_queue.expires_at) end,
    'battle', case when v_slot.battle_id is null then null
                   else private.battle_payload(v_slot.battle_id, v_uid) end));
end;
$$;

create or replace function public.ready_battle_v1(p_battle_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  b public.battles;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  b := private.lock_participant_battle(v_uid, p_battle_id);
  perform private.advance_battle(p_battle_id);
  select * into b from public.battles where id = p_battle_id;

  if b.state in ('countdown', 'active', 'finished') then
    return private.envelope(private.battle_payload(p_battle_id, v_uid), p_request_key);
  elsif b.state = 'cancelled' then
    if b.cancel_reason = 'ready_timeout' then
      perform private.raise_error('DEADLINE_PASSED', 'The ready window has closed.');
    end if;
    perform private.raise_error('INVALID_STATE', 'This battle was cancelled.');
  elsif b.state <> 'ready' then
    perform private.raise_error('INVALID_STATE', 'Waiting for an opponent to join.');
  end if;

  update public.battle_participants set ready_at = coalesce(ready_at, now())
  where battle_id = p_battle_id and user_id = v_uid;

  if (select count(*) from public.battle_participants where battle_id = p_battle_id and ready_at is not null) = 2 then
    perform private.schedule_battle(p_battle_id);
  else
    update public.battles set revision = revision + 1 where id = p_battle_id;
    perform private.battle_event(p_battle_id);
  end if;
  return private.envelope(private.battle_payload(p_battle_id, v_uid), p_request_key);
end;
$$;

create or replace function public.get_battle_state_v1(p_battle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not exists (select 1 from public.battles where id = p_battle_id) then
    perform private.raise_error('NOT_FOUND', 'Battle not found.');
  end if;
  if not exists (select 1 from public.battle_participants where battle_id = p_battle_id and user_id = v_uid) then
    perform private.raise_error('FORBIDDEN');
  end if;
  -- Opportunistic catch-up for due transitions (scheduler may be late).
  perform private.advance_battle(p_battle_id);
  return private.envelope(private.battle_payload(p_battle_id, v_uid));
end;
$$;

create or replace function public.submit_battle_answer_v1(p_battle_id uuid, p_position integer, p_option_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  b public.battles;
  v_part public.battle_participants;
  v_q public.battle_questions;
  v_prior public.battle_answers;
  v_correct boolean;
  v_inserted boolean;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);

  select * into v_prior from public.battle_answers where user_id = v_uid and request_key = p_request_key;
  if found then
    if v_prior.battle_id <> p_battle_id or v_prior.position <> p_position then
      perform private.raise_error('VALIDATION_FAILED', 'Request key reused for a different answer.',
        jsonb_build_object('request_key', 'reused'));
    end if;
    return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', true,
                                               'option_id', v_prior.option_id, 'received_at', v_prior.received_at), p_request_key);
  end if;

  -- FOR SHARE: concurrent answers proceed; the finalizer's FOR UPDATE waits, then sees committed answers.
  select * into b from public.battles where id = p_battle_id for share;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Battle not found.');
  end if;
  select * into v_part from public.battle_participants where battle_id = p_battle_id and user_id = v_uid;
  if not found then
    perform private.raise_error('FORBIDDEN');
  end if;
  if b.state not in ('countdown', 'active') or v_part.forfeited_at is not null then
    perform private.raise_error('DEADLINE_PASSED', 'This battle is not accepting answers.');
  end if;

  select * into v_q from public.battle_questions where battle_id = p_battle_id and position = p_position;
  if not found then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('position', 'invalid'));
  end if;
  if now() < v_q.opened_at then
    perform private.raise_error('INVALID_STATE', 'This question is not open yet.');
  end if;
  if now() >= v_q.deadline then
    perform private.raise_error('DEADLINE_PASSED', 'Time is up for this question.');
  end if;
  if p_option_id is null or not (p_option_id = any (v_q.option_order)) then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('option_id', 'option_not_in_question'));
  end if;

  select p_option_id = k.correct_option_id into v_correct
  from private.question_answer_keys k where k.question_version_id = v_q.question_version_id;

  insert into public.battle_answers (battle_id, user_id, position, question_version_id, option_id, request_key, received_at, is_correct)
  values (p_battle_id, v_uid, p_position, v_q.question_version_id, p_option_id, p_request_key, now(), coalesce(v_correct, false))
  on conflict (battle_id, user_id, position) do nothing;
  v_inserted := found;

  if not v_inserted then
    select * into v_prior from public.battle_answers where battle_id = p_battle_id and user_id = v_uid and position = p_position;
    return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', false,
                                               'already_answered', true, 'option_id', v_prior.option_id,
                                               'received_at', v_prior.received_at), p_request_key);
  end if;

  return private.envelope(jsonb_build_object('battle_id', p_battle_id, 'position', p_position, 'accepted', true,
                                             'option_id', p_option_id, 'received_at', now()), p_request_key);
end;
$$;

create or replace function public.forfeit_battle_v1(p_battle_id uuid, p_request_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  b public.battles;
  v_other uuid;
begin
  perform private.require_request_key(p_request_key);
  b := private.lock_participant_battle(v_uid, p_battle_id);
  perform private.advance_battle(p_battle_id);
  select * into b from public.battles where id = p_battle_id;

  if b.state in ('finished', 'cancelled', 'voided') then
    return private.envelope(private.battle_payload(p_battle_id, v_uid), p_request_key);
  end if;

  if b.state in ('waiting', 'ready') or (b.state in ('countdown', 'active') and now() < b.starts_at) then
    perform private.cancel_battle(p_battle_id, 'pre_start_cancel', 'cancelled');
  else
    update public.battle_participants set forfeited_at = now() where battle_id = p_battle_id and user_id = v_uid;
    perform private.cancel_battle(p_battle_id, 'early_forfeit', 'forfeit');
  end if;

  select user_id into v_other from public.battle_participants where battle_id = p_battle_id and user_id <> v_uid;
  if v_other is not null then
    insert into public.notifications (user_id, kind, body, safe_target, event_key)
    values (v_other, 'battle_cancelled', 'Your opponent left the battle. No XP was awarded.', '/battles/' || p_battle_id::text,
            'battle_cancelled:' || p_battle_id::text || ':' || v_other::text)
    on conflict (event_key) do nothing;
  end if;
  return private.envelope(private.battle_payload(p_battle_id, v_uid), p_request_key);
end;
$$;

create or replace function public.get_my_battles_v1(p_before timestamptz default null, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  select coalesce(jsonb_agg(x.item order by x.joined_at desc), '[]'::jsonb) into v_items
  from (
    select bp.joined_at, jsonb_build_object(
      'battle_id', b.id,
      'mode', b.mode,
      'state', b.state,
      'result_kind', b.result_kind,
      'cancel_reason', b.cancel_reason,
      'course', jsonb_build_object('code', c.code, 'title', c.title),
      'opponent', (select jsonb_build_object('display_name', p.display_name, 'avatar_path', p.avatar_path)
                   from public.battle_participants op join public.profiles p on p.id = op.user_id
                   where op.battle_id = b.id and op.user_id <> v_uid),
      'my_correct', case when b.state in ('finished', 'voided') then bp.correct_count end,
      'opponent_correct', case when b.state in ('finished', 'voided') then
                            (select op.correct_count from public.battle_participants op where op.battle_id = b.id and op.user_id <> v_uid) end,
      'outcome', case when b.state = 'finished' then
                        case when b.result_kind = 'draw' then 'draw' when b.winner_user_id = v_uid then 'win' else 'loss' end
                      when b.state = 'voided' then 'voided'
                      when b.state = 'cancelled' then 'cancelled'
                      else 'in_progress' end,
      'xp_awarded', coalesce((select sum(l.amount) from public.points_ledger l where l.user_id = v_uid and l.source_id = b.id), 0),
      'round_count', b.round_count,
      'created_at', b.created_at,
      'finalized_at', b.finalized_at,
      'joined_at', bp.joined_at) as item
    from public.battle_participants bp
    join public.battles b on b.id = bp.battle_id
    join public.course_offerings o on o.id = b.offering_id
    join public.courses c on c.id = o.course_id
    where bp.user_id = v_uid and (p_before is null or bp.joined_at < p_before)
    order by bp.joined_at desc
    limit v_limit
  ) x;

  return private.envelope(jsonb_build_object(
    'items', v_items,
    'next_before', case when jsonb_array_length(v_items) = v_limit
                        then v_items -> (v_limit - 1) ->> 'joined_at' end));
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard (lifetime XP; dense rank; stable (points desc, user_id) cursor)
-- ---------------------------------------------------------------------------
create or replace function public.get_leaderboard_v1(
  p_scope text default 'global', p_faculty_id uuid default null, p_cursor text default null, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_faculty uuid;
  v_cursor_total bigint;
  v_cursor_user uuid;
  v_rows jsonb;
  v_me jsonb;
begin
  if p_scope not in ('global', 'faculty') then
    perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('scope', 'must be global or faculty'));
  end if;
  if p_scope = 'faculty' then
    v_faculty := coalesce(p_faculty_id, (select faculty_id from public.profiles where id = v_uid));
    if v_faculty is null then
      perform private.raise_error('INVALID_PROFILE', 'Set your academic profile to see your faculty ranking.');
    end if;
  end if;
  if p_cursor is not null then
    begin
      v_cursor_total := split_part(p_cursor, ':', 1)::bigint;
      v_cursor_user := split_part(p_cursor, ':', 2)::uuid;
    exception when others then
      perform private.raise_error('VALIDATION_FAILED', null, jsonb_build_object('cursor', 'invalid'));
    end;
  end if;

  with eligible as (
    select p.id as user_id, p.display_name, p.avatar_path, coalesce(up.total, 0) as total
    from public.profiles p
    left join public.user_points up on up.user_id = p.id
    where p.deactivated_at is null and p.leaderboard_visible
      and not exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin')
      and (v_faculty is null or p.faculty_id = v_faculty)
  ), ranked as (
    select e.*, dense_rank() over (order by e.total desc) as rank from eligible e
  ), page as (
    select * from ranked r
    where v_cursor_total is null or r.total < v_cursor_total or (r.total = v_cursor_total and r.user_id > v_cursor_user)
    order by r.total desc, r.user_id
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', pg.rank, 'user_id', pg.user_id, 'display_name', pg.display_name, 'avatar_path', pg.avatar_path,
           'xp_total', pg.total, 'is_me', pg.user_id = v_uid) order by pg.total desc, pg.user_id), '[]'::jsonb),
         (select jsonb_build_object('rank', r.rank, 'xp_total', r.total) from ranked r where r.user_id = v_uid)
    into v_rows, v_me
  from page pg;

  return private.envelope(jsonb_build_object(
    'scope', p_scope,
    'faculty_id', v_faculty,
    'as_of', now(),
    'rows', v_rows,
    'me', v_me,
    'next_cursor', case when jsonb_array_length(v_rows) = v_limit
                        then (v_rows -> (v_limit - 1) ->> 'xp_total') || ':' || (v_rows -> (v_limit - 1) ->> 'user_id') end));
end;
$$;
