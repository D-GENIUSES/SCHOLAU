-- ScholAu migration 5: 1v1 battles, queue, live slots, and operational tables
-- (notifications, reports, app config, push tokens, audit, outbox, webhook receipts).
--
-- Battle state machine: waiting > ready > countdown > active > finished;
-- waiting/ready/countdown/active may become cancelled (expiry, readiness failure, forfeit);
-- finished may later become voided by an admin correction.

create table public.battle_rules (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  round_count integer not null check (round_count > 0),
  seconds_per_round integer not null check (seconds_per_round > 0),
  ready_seconds integer not null check (ready_seconds > 0),
  countdown_seconds integer not null check (countdown_seconds >= 0),
  queue_seconds integer not null check (queue_seconds > 0),
  invite_seconds integer not null default 300 check (invite_seconds > 0),
  win_xp integer not null check (win_xp > 0),
  draw_xp integer not null check (draw_xp > 0),
  loss_xp integer not null check (loss_xp > 0),
  -- No daily participation or battle-XP limits (D06).
  tie_policy text not null default 'draw' check (tie_policy = 'draw'),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.battles (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings(id),
  rules_id uuid not null references public.battle_rules(id),
  mode text not null check (mode in ('direct', 'queue')),
  state text not null default 'waiting' check (state in ('waiting', 'ready', 'countdown', 'active', 'finished', 'cancelled', 'voided')),
  created_by uuid not null references public.profiles(id),
  request_key uuid,
  created_at timestamptz not null default now(),
  invitation_expires_at timestamptz,
  ready_deadline timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  finalized_at timestamptz,
  winner_user_id uuid references public.profiles(id),
  result_kind text check (result_kind in ('win', 'draw', 'forfeit', 'double_forfeit', 'cancelled', 'voided')),
  cancel_reason text check (cancel_reason in ('invite_expired', 'ready_timeout', 'pre_start_cancel', 'early_forfeit', 'content_unavailable', 'admin_void')),
  round_count integer not null check (round_count > 0),
  seconds_per_round integer not null check (seconds_per_round > 0),
  revision integer not null default 0 check (revision >= 0),
  unique (created_by, request_key),
  check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
  check (state not in ('finished', 'cancelled', 'voided') or finalized_at is not null),
  check (state not in ('countdown', 'active', 'finished') or (starts_at is not null and ends_at is not null))
);

create table public.battle_participants (
  battle_id uuid not null references public.battles(id),
  user_id uuid not null references public.profiles(id),
  seat integer not null check (seat in (1, 2)),
  joined_at timestamptz not null default now(),
  ready_at timestamptz,
  activated_at timestamptz,
  forfeited_at timestamptz,
  activity_date date,
  correct_count integer check (correct_count >= 0),
  primary key (battle_id, user_id),
  unique (battle_id, seat)
);

alter table public.battles add constraint winner_is_participant
  foreign key (id, winner_user_id) references public.battle_participants(battle_id, user_id)
  deferrable initially deferred;

create table private.battle_invites (
  battle_id uuid primary key references public.battles(id),
  token text not null unique check (length(token) >= 32),
  created_at timestamptz not null default now()
);

create table public.battle_questions (
  battle_id uuid not null references public.battles(id),
  position integer not null check (position > 0),
  question_version_id uuid not null references public.question_versions(id),
  opened_at timestamptz not null,
  deadline timestamptz not null,
  option_order uuid[] not null,
  primary key (battle_id, position),
  unique (battle_id, question_version_id),
  unique (battle_id, position, question_version_id),
  check (deadline > opened_at)
);

create table public.battle_answers (
  battle_id uuid not null,
  user_id uuid not null,
  position integer not null,
  question_version_id uuid not null,
  option_id uuid not null,
  request_key uuid not null,
  received_at timestamptz not null,
  is_correct boolean,
  primary key (battle_id, user_id, position),
  unique (user_id, request_key),
  foreign key (battle_id, user_id) references public.battle_participants(battle_id, user_id),
  foreign key (battle_id, position, question_version_id) references public.battle_questions(battle_id, position, question_version_id),
  foreign key (option_id, question_version_id) references public.question_options(id, question_version_id)
);

create table public.battle_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  offering_id uuid not null references public.course_offerings(id),
  request_key uuid not null,
  state text not null default 'waiting' check (state in ('waiting', 'matched', 'cancelled', 'expired')),
  queued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  matched_battle_id uuid references public.battles(id),
  closed_at timestamptz,
  unique (user_id, request_key),
  check (expires_at > queued_at),
  check (state <> 'matched' or matched_battle_id is not null)
);

create unique index one_waiting_queue on public.battle_queue(user_id) where state = 'waiting';
create index queue_matching on public.battle_queue(offering_id, queued_at) where state = 'waiting';
create index queue_due on public.battle_queue(expires_at) where state = 'waiting';

-- One durable live reservation (queue entry or battle) per user across all offerings.
-- This is a concurrency guard, never a daily quota.
create table private.battle_slots (
  user_id uuid primary key references public.profiles(id),
  queue_id uuid unique references public.battle_queue(id),
  battle_id uuid references public.battles(id),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check ((queue_id is not null and battle_id is null) or (queue_id is null and battle_id is not null))
);

create index battle_slots_battle on private.battle_slots(battle_id);
create index battle_slots_due on private.battle_slots(expires_at);

create index battles_due on public.battles(ends_at) where state in ('countdown', 'active');
create index battles_ready_due on public.battles(ready_deadline) where state = 'ready';
create index battles_invite_due on public.battles(invitation_expires_at) where state = 'waiting';
create index battles_start_due on public.battles(starts_at) where state = 'countdown';
create index participant_history on public.battle_participants(user_id, joined_at desc);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null check (length(kind) between 1 and 60),
  body text not null check (length(body) between 1 and 500),
  safe_target text check (safe_target is null or safe_target ~ '^/[A-Za-z0-9/_-]*$'),
  event_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_owner on public.notifications(user_id, created_at desc);
create index notifications_unread on public.notifications(user_id) where read_at is null;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('lesson', 'question', 'battle', 'technical')),
  target_id uuid,
  category text not null check (category in ('incorrect', 'unclear', 'typo', 'offensive', 'broken', 'other')),
  note text not null check (length(note) between 1 and 2000),
  state text not null default 'open' check (state in ('open', 'triaged', 'resolved', 'dismissed')),
  request_key uuid not null,
  resolved_by uuid references public.profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, request_key),
  check (target_type = 'technical' or target_id is not null)
);

create index reports_open on public.content_reports(created_at) where state in ('open', 'triaged');
create index reports_user on public.content_reports(user_id, created_at desc);

create table public.app_config (
  platform text primary key check (platform in ('web', 'ios', 'android')),
  minimum_build integer not null default 1 check (minimum_build > 0),
  minimum_api_version integer not null default 1 check (minimum_api_version > 0),
  maintenance boolean not null default false,
  message text,
  feature_flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger app_config_touch before update on public.app_config
  for each row execute function private.touch_updated_at();

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  platform text not null check (platform in ('web', 'ios', 'android')),
  device_key text not null check (length(device_key) between 8 and 200),
  delivery_config jsonb not null,
  consented_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, platform, device_key)
);

create table private.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_key uuid,
  reason text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index audit_request on private.audit_log(actor_id, action, request_key) where request_key is not null;
create index audit_entity on private.audit_log(entity_type, entity_id, created_at desc);

create table private.outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  topic text not null,
  event text not null default 'state',
  safe_payload jsonb not null,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claim_token uuid,
  delivered_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  created_at timestamptz not null default now()
);

create index outbox_ready on private.outbox(available_at) where delivered_at is null;

create table private.webhook_receipts (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  state text not null default 'received' check (state in ('received', 'processed', 'failed', 'ignored')),
  payload_hash text not null,
  processed_at timestamptz,
  last_error_code text,
  primary key (provider, event_id)
);
