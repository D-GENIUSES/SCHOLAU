-- ScholAu migration 6a: RPC foundation (error convention, auth helpers, rewards, outbox).
--
-- =============================================================================================
-- ERROR CONVENTION (stable contract for web/native clients)
-- =============================================================================================
-- Every public *_v1 RPC fails by raising through private.raise_error(code, message, field_errors).
-- The transaction is rolled back, and PostgREST/supabase-js returns:
--
--   HTTP status : taken from the SQLSTATE "PTxxx" (e.g. PT403 -> 403)
--   error.code    = 'PT403'                          (SQLSTATE; transport detail only)
--   error.message = 'FORBIDDEN'                      (machine-readable ScholAu code)
--   error.details = '{"code":"FORBIDDEN","message":"...","retryable":false,"field_errors":{...}}'
--   error.hint    = human-readable message (same as details.message)
--
-- Clients should JSON.parse(error.details) to obtain the TRD shape
--   { code, message, retryable, field_errors? }
-- and branch on `code` only. No SQL diagnostics are ever placed in these fields.
--
--   code                 HTTP retryable meaning
--   UNAUTHENTICATED      401  no      no/invalid session
--   FORBIDDEN            403  no      authenticated but not allowed (ownership/role/scope)
--   INVALID_PROFILE      422  no      academic profile missing or invalid combination
--   NOT_ENROLLED         403  no      operation requires an active enrollment
--   CONTENT_UNAVAILABLE  404  no      content not published / insufficient question pool
--   ATTEMPT_ACTIVE       409  no      another active attempt exists (field_errors.attempt_id)
--   DEADLINE_PASSED      409  no      attempt/battle/question deadline elapsed
--   STALE_REVISION       409  yes     client revision older than server; refresh then retry
--   BATTLE_FULL          409  no      battle already has two participants / not joinable
--   QUEUE_EXPIRED        410  no      queue entry or invitation expired/cancelled
--   VERSION_UNSUPPORTED  426  no      client build/API version below app_config minimum
--   RATE_LIMITED         429  yes     too many requests; back off
-- Additional codes:
--   VALIDATION_FAILED    422  no      input validation; see field_errors
--   NOT_FOUND            404  no      unknown or inaccessible id
--   SLOT_BUSY            409  no      user already holds a live queue/battle slot
--                                     (field_errors.battle_id / field_errors.queue_id to resume)
--   INVALID_STATE        409  no      operation not valid in the current state
--   MAINTENANCE          503  yes     app_config maintenance flag set for the platform
--
-- Successful responses are jsonb objects that include `server_time` and, for mutations,
-- `request_id` (the echoed request key). Stateful objects include `revision`.
--
-- Client compatibility headers (optional, read from PostgREST request.headers):
--   x-client-platform: web | ios | android   x-client-build: integer   x-api-version: integer
--
-- LOCK ORDER (all functions acquire in this order to avoid deadlocks):
--   1. pg_advisory_xact_lock('scholau.queue:<offering>')   (queue matching only)
--   2. public.battles row (FOR UPDATE; answers take FOR SHARE and never upgrade)
--   3. public.battle_queue rows (oldest first)
--   4. private.battle_slots rows (ascending user_id)
--   5. public.profiles row (academic profile changes)
--   6. public.assessment_attempts row / public.lesson_progress row
--   7. private.daily_counters row (learning rewards only)
--   8. public.points_ledger insert, then public.user_points row (ascending user_id)
--   9. private.outbox insert
-- =============================================================================================

create or replace function private.raise_error(p_code text, p_message text default null, p_field_errors jsonb default null)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_status text;
  v_retry boolean;
  v_default text;
  v_message text;
  v_detail jsonb;
begin
  select t.status, t.retryable, t.msg into v_status, v_retry, v_default
  from (values
    ('UNAUTHENTICATED', '401', false, 'Please sign in to continue.'),
    ('FORBIDDEN', '403', false, 'You do not have permission to do that.'),
    ('INVALID_PROFILE', '422', false, 'Your academic profile is missing or invalid.'),
    ('NOT_ENROLLED', '403', false, 'Enroll in this course first.'),
    ('CONTENT_UNAVAILABLE', '404', false, 'This content is not available.'),
    ('ATTEMPT_ACTIVE', '409', false, 'You already have an active attempt.'),
    ('DEADLINE_PASSED', '409', false, 'The deadline has passed.'),
    ('STALE_REVISION', '409', true, 'Your data is out of date. Refresh and try again.'),
    ('BATTLE_FULL', '409', false, 'This battle can no longer be joined.'),
    ('QUEUE_EXPIRED', '410', false, 'This invitation or queue entry has expired.'),
    ('VERSION_UNSUPPORTED', '426', false, 'Please update the app to continue.'),
    ('RATE_LIMITED', '429', true, 'Too many requests. Please wait and try again.'),
    ('VALIDATION_FAILED', '422', false, 'Some fields are invalid.'),
    ('NOT_FOUND', '404', false, 'Not found.'),
    ('SLOT_BUSY', '409', false, 'You already have a live battle or queue entry.'),
    ('INVALID_STATE', '409', false, 'That action is not available right now.'),
    ('MAINTENANCE', '503', true, 'ScholAu is under maintenance. Please try again soon.')
  ) as t(code, status, retryable, msg)
  where t.code = p_code;

  if v_status is null then
    v_status := '500';
    v_retry := false;
    v_default := 'Something went wrong.';
  end if;

  v_message := coalesce(p_message, v_default);
  v_detail := jsonb_build_object('code', p_code, 'message', v_message, 'retryable', v_retry);
  if p_field_errors is not null then
    v_detail := v_detail || jsonb_build_object('field_errors', p_field_errors);
  end if;

  raise exception using
    errcode = 'PT' || v_status,
    message = p_code,
    detail = v_detail::text,
    hint = v_message;
end;
$$;

create or replace function private.envelope(p_body jsonb, p_request_key uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(p_body, '{}'::jsonb)
    || jsonb_build_object('server_time', now())
    || case when p_request_key is null then '{}'::jsonb else jsonb_build_object('request_id', p_request_key) end
$$;

-- Returns the caller id or raises UNAUTHENTICATED/FORBIDDEN (deactivated).
create or replace function private.require_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deactivated timestamptz;
begin
  if v_uid is null then
    perform private.raise_error('UNAUTHENTICATED');
  end if;
  select p.deactivated_at into v_deactivated from public.profiles p where p.id = v_uid;
  if not found then
    perform private.raise_error('UNAUTHENTICATED', 'No ScholAu profile exists for this session.');
  end if;
  if v_deactivated is not null then
    perform private.raise_error('FORBIDDEN', 'This account is deactivated.');
  end if;
  return v_uid;
end;
$$;

create or replace function private.user_is_admin(p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = p_user_id and r.role = 'admin' and p.deactivated_at is null
  )
$$;

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if not private.user_is_admin(v_uid) then
    perform private.raise_error('FORBIDDEN', 'Administrator access required.');
  end if;
  return v_uid;
end;
$$;

create or replace function private.require_request_key(p_request_key uuid)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_request_key is null then
    perform private.raise_error('VALIDATION_FAILED', 'A request key is required.',
      jsonb_build_object('request_key', 'required'));
  end if;
end;
$$;

-- Enforces app_config maintenance / minimum build / minimum API version for mutations.
create or replace function private.assert_client_supported(p_api_version integer default 1)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_platform text;
  v_build integer;
  v_api integer;
  v_cfg public.app_config;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_platform := coalesce(lower(v_headers ->> 'x-client-platform'), 'web');
  if v_platform not in ('web', 'ios', 'android') then
    v_platform := 'web';
  end if;
  begin
    v_build := (v_headers ->> 'x-client-build')::integer;
    v_api := coalesce((v_headers ->> 'x-api-version')::integer, p_api_version);
  exception when others then
    perform private.raise_error('VERSION_UNSUPPORTED', 'Invalid client version headers.');
  end;

  select * into v_cfg from public.app_config where platform = v_platform;
  if not found then
    return;
  end if;
  if v_cfg.maintenance and not private.user_is_admin(auth.uid()) then
    perform private.raise_error('MAINTENANCE', coalesce(v_cfg.message, null));
  end if;
  if v_api < v_cfg.minimum_api_version or (v_build is not null and v_build < v_cfg.minimum_build) then
    perform private.raise_error('VERSION_UNSUPPORTED', null,
      jsonb_build_object('minimum_build', v_cfg.minimum_build, 'minimum_api_version', v_cfg.minimum_api_version));
  end if;
end;
$$;

create or replace function private.audit(
  p_actor_id uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_request_key uuid default null, p_reason text default null, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_log (actor_id, action, entity_type, entity_id, request_key, reason, safe_metadata)
  values (p_actor_id, p_action, p_entity_type, p_entity_id, p_request_key, p_reason, coalesce(p_metadata, '{}'::jsonb))
  on conflict (actor_id, action, request_key) where request_key is not null do nothing;
end;
$$;

-- Streak = consecutive Africa/Lagos dates with qualifying activity, ending today or yesterday.
create or replace function private.streak(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with d as (
    select distinct a.local_date from public.activity_events a where a.user_id = p_user_id
  ), g as (
    select local_date, local_date - (row_number() over (order by local_date))::integer as grp from d
  ), runs as (
    select min(local_date) as s, max(local_date) as e, count(*)::integer as n from g group by grp
  )
  select jsonb_build_object(
    'current', coalesce((select r.n from runs r where r.e >= private.lagos_date() - 1 order by r.e desc limit 1), 0),
    'longest', coalesce((select max(r.n) from runs r), 0),
    'active_today', exists (select 1 from d where d.local_date = private.lagos_date()),
    'local_date', private.lagos_date()
  )
$$;

-- ---------------------------------------------------------------------------
-- Transactional outbox + server-originated Realtime broadcast
-- ---------------------------------------------------------------------------
-- Inserts the event in the caller's transaction and attempts an immediate private broadcast via
-- realtime.send (also transactional). If broadcasting fails, the dispatcher retries later.
create or replace function private.enqueue_event(p_topic text, p_event text, p_payload jsonb, p_event_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.outbox (event_key, topic, event, safe_payload)
  values (p_event_key, p_topic, p_event, p_payload)
  on conflict (event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return;
  end if;
  begin
    perform realtime.send(p_payload || jsonb_build_object('event_id', v_id), p_event, p_topic, true);
    update private.outbox set delivered_at = now(), attempts = 1 where id = v_id;
  exception when others then
    update private.outbox
       set attempts = 1, last_error_code = sqlstate, available_at = now() + interval '2 seconds'
     where id = v_id;
  end;
end;
$$;

create or replace function private.dispatch_outbox(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
  v_token uuid := gen_random_uuid();
begin
  for r in
    select o.id, o.topic, o.event, o.safe_payload, o.attempts
    from private.outbox o
    where o.delivered_at is null and o.available_at <= now() and o.attempts < 10
    order by o.available_at
    limit p_limit
    for update skip locked
  loop
    begin
      update private.outbox set claimed_at = now(), claim_token = v_token where id = r.id;
      perform realtime.send(r.safe_payload || jsonb_build_object('event_id', r.id), r.event, r.topic, true);
      update private.outbox set delivered_at = now(), attempts = r.attempts + 1, last_error_code = null where id = r.id;
      v_count := v_count + 1;
    exception when others then
      update private.outbox
         set attempts = r.attempts + 1,
             last_error_code = sqlstate,
             available_at = now() + make_interval(secs => least(power(2, r.attempts + 1)::integer, 300))
       where id = r.id;
    end;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rewards: award_points (internal only)
-- ---------------------------------------------------------------------------
-- Inserts one ledger entry per (user, event_key). Learning rules are capped per Africa/Lagos day by
-- a locked private.daily_counters row (TR-03). Battle rules bypass the counter (no battle cap).
-- Totals are updated in the same transaction. Returns awarded amount (0 for duplicates or capped).
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
  v_used integer;
  v_learning boolean;
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
  v_learning := p_rule_code not like 'battle\_%' and v_rule.daily_cap is not null;

  if v_learning then
    insert into private.daily_counters (user_id, local_date) values (p_user_id, v_date) on conflict do nothing;
    select c.learning_xp_awarded into v_used from private.daily_counters c
    where c.user_id = p_user_id and c.local_date = v_date
    for update;
    v_amount := least(v_requested, greatest(v_rule.daily_cap - v_used, 0));
  end if;

  insert into public.points_ledger (user_id, source_type, source_id, event_key, rule_id, requested_amount, amount,
                                    cap_applied, local_date)
  values (p_user_id, p_source_type, p_source_id, p_event_key, v_rule.id, v_requested, v_amount,
          v_amount < v_requested, v_date)
  on conflict (user_id, event_key) do nothing
  returning id into v_id;

  if v_id is null then
    return 0;
  end if;

  if v_learning and v_amount > 0 then
    update private.daily_counters set learning_xp_awarded = learning_xp_awarded + v_amount
    where user_id = p_user_id and local_date = v_date;
  end if;

  if v_amount <> 0 then
    insert into public.user_points (user_id, total) values (p_user_id, v_amount)
    on conflict (user_id) do update set total = public.user_points.total + excluded.total, updated_at = now();
  end if;
  return v_amount;
end;
$$;

-- Compensating correction for an existing reward entry (never deletes history).
create or replace function private.compensate_entry(p_entry_id uuid, p_actor_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.points_ledger;
  v_id uuid;
begin
  select * into v_entry from public.points_ledger where id = p_entry_id;
  if not found or v_entry.source_type = 'correction' or v_entry.amount = 0 then
    return 0;
  end if;
  insert into public.points_ledger (user_id, source_type, source_id, event_key, rule_id, requested_amount, amount,
                                    adjusts_entry_id, reason, actor_id, local_date)
  values (v_entry.user_id, 'correction', v_entry.source_id, 'correction:' || v_entry.id::text, v_entry.rule_id,
          -v_entry.amount, -v_entry.amount, v_entry.id, p_reason, p_actor_id, private.lagos_date())
  on conflict (user_id, event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return 0;
  end if;
  update public.user_points set total = total - v_entry.amount, updated_at = now() where user_id = v_entry.user_id;
  return -v_entry.amount;
end;
$$;

-- Rebuild a cached total from the ledger (cannot invent points). Returns the corrected total.
create or replace function private.reconcile_user_points(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.user_points (user_id, total)
  values (p_user_id, (select coalesce(sum(l.amount), 0) from public.points_ledger l where l.user_id = p_user_id))
  on conflict (user_id) do update set total = excluded.total, updated_at = now()
  returning total
$$;
