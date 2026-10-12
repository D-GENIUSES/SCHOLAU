-- ScholAu migration 4: XP rules, append-only ledger, transactional totals, learning daily counters
-- and entitlements.
--
-- Learning rewards (lesson/review/practice/mock) share one per-user Africa/Lagos daily cap enforced
-- through a locked private.daily_counters row. Battle rewards never touch the counter and are uncapped.

create table private.point_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code in ('lesson_complete', 'review_correct', 'practice_first', 'mock_first',
                                     'battle_win', 'battle_draw', 'battle_loss')),
  version integer not null check (version > 0),
  amount integer not null check (amount >= 0),
  daily_cap integer check (daily_cap >= 0),
  policy jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_until timestamptz,
  unique (code, version),
  check (effective_until is null or effective_until > effective_from),
  -- Battle rules never carry an earning cap or a zero reward.
  check (code not like 'battle_%' or (daily_cap is null and amount > 0))
);

create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  source_type text not null check (source_type in ('lesson', 'review', 'practice', 'mock', 'battle', 'correction')),
  source_id uuid not null,
  event_key text not null check (length(event_key) between 1 and 200),
  rule_id uuid references private.point_rules(id),
  requested_amount integer not null,
  amount integer not null,
  cap_applied boolean not null default false,
  adjusts_entry_id uuid references public.points_ledger(id),
  reason text,
  actor_id uuid references public.profiles(id),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_key),
  check (source_type = 'correction' or (requested_amount >= 0 and amount >= 0 and amount <= requested_amount and rule_id is not null)),
  check (source_type <> 'correction' or (adjusts_entry_id is not null and reason is not null and length(reason) > 0))
);

create index ledger_history on public.points_ledger(user_id, created_at desc);
create index ledger_source on public.points_ledger(source_id);

create or replace function private.ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'points_ledger is append-only; use compensating correction entries' using errcode = 'check_violation';
end;
$$;

create trigger points_ledger_append_only before update or delete on public.points_ledger
  for each row execute function private.ledger_append_only();

create table public.user_points (
  user_id uuid primary key references public.profiles(id),
  total bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index rank_totals on public.user_points(total desc, user_id);

create table private.daily_counters (
  user_id uuid not null references public.profiles(id),
  local_date date not null,
  learning_xp_awarded integer not null default 0 check (learning_xp_awarded >= 0),
  primary key (user_id, local_date)
);

create or replace function private.create_user_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_points (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.create_user_points() from public, anon, authenticated;

create trigger profiles_user_points after insert on public.profiles
  for each row execute function private.create_user_points();

-- ---------------------------------------------------------------------------
-- Entitlements (premium). Server writes only: admin RPC or verified webhook.
-- Premium never gates battles or battle XP (D06).
-- ---------------------------------------------------------------------------
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  feature text not null default 'premium' check (feature in ('premium')),
  source text not null check (source in ('admin', 'paystack', 'flutterwave', 'app_store', 'play_store')),
  source_reference text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  revoked_at timestamptz,
  granted_by uuid references public.profiles(id),
  revoked_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  unique (source, source_reference),
  check (ends_at is null or ends_at > starts_at),
  check (source <> 'admin' or (granted_by is not null and reason is not null and length(reason) > 0))
);

create index entitlement_check on public.entitlements(user_id, feature, starts_at, ends_at) where revoked_at is null;

create or replace function private.has_entitlement(p_user_id uuid, p_feature text default 'premium', p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user_id and e.feature = p_feature and e.revoked_at is null
      and e.starts_at <= p_at and (e.ends_at is null or e.ends_at > p_at)
  )
$$;
