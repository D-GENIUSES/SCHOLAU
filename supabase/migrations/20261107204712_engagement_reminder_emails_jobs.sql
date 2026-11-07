-- One reminder for notification setup and one per interrupted learning streak.
begin;

create table private.engagement_email_config (
  singleton boolean primary key default true check (singleton),
  starts_at timestamptz not null default now()
);
insert into private.engagement_email_config default values;

create table private.engagement_email_opt_outs (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table private.engagement_email_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('notifications', 'streak')),
  episode text not null,
  state text not null default 'pending' check (state in ('pending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 hours',
  unique (user_id, kind, episode)
);

create index engagement_email_jobs_due on private.engagement_email_jobs (next_attempt_at, id)
  where state = 'pending';

alter table private.engagement_email_config enable row level security;
alter table private.engagement_email_opt_outs enable row level security;
alter table private.engagement_email_jobs enable row level security;
revoke all on private.engagement_email_config, private.engagement_email_opt_outs,
  private.engagement_email_jobs from public, anon, authenticated;

create function private.engagement_email_candidates(p_now timestamptz)
returns table (user_id uuid, kind text, episode text)
language sql stable set search_path = '' as $$
  select u.id, 'notifications', 'signup'
  from auth.users u
  join public.profiles p on p.id = u.id
  join private.engagement_email_config c on u.created_at >= c.starts_at
  where u.created_at <= p_now - interval '5 hours'
    and u.created_at > p_now - interval '24 hours'
    and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= p_now)
    and p.deactivated_at is null
    and exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'student')
    and exists (select 1 from private.welcome_email_events e where e.user_id = u.id)
    and private.push_allowed(u.id)
    and not exists (select 1 from public.push_tokens t where t.user_id = u.id)
    and not exists (select 1 from private.notification_preferences n where n.user_id = u.id and n.configured)
    and not exists (select 1 from private.engagement_email_opt_outs o where o.user_id = u.id)

  union all

  select u.id, 'streak', a.local_date::text
  from private.user_presence s
  join auth.users u on u.id = s.user_id
  join public.profiles p on p.id = u.id
  cross join private.engagement_email_config c
  join lateral (
    select e.local_date, e.created_at
    from public.activity_events e where e.user_id = u.id
    order by e.local_date desc, e.created_at desc limit 1
  ) a on true
  where s.seen_at <= p_now - interval '48 hours'
    and greatest(s.seen_at, u.last_sign_in_at, a.created_at) <= p_now - interval '48 hours'
    and a.local_date <= private.lagos_date(p_now) - 2
    and a.created_at >= c.starts_at
    and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until <= p_now)
    and p.deactivated_at is null
    and exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'student')
    and not exists (select 1 from private.engagement_email_opt_outs o where o.user_id = u.id)
$$;
revoke all on function private.engagement_email_candidates(timestamptz) from public, anon, authenticated;

create function public.claim_engagement_emails_v1()
returns table (id uuid, kind text, email text, attempt integer)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('scholau.engagement-email.claim', 0)) then return; end if;

  insert into private.engagement_email_jobs(user_id, kind, episode)
  select c.user_id, c.kind, c.episode
  from private.engagement_email_candidates(now()) c
  where not exists (
    select 1 from private.engagement_email_jobs j
    where j.user_id = c.user_id and j.kind = c.kind and j.episode = c.episode
  )
  order by c.kind, c.user_id limit 40
  on conflict do nothing;

  return query
  with candidates as materialized (select * from private.engagement_email_candidates(now())),
  due as (
    select j.id, (
      j.expires_at > now() and j.attempts < 3 and exists (
        select 1 from candidates c where c.user_id = j.user_id and c.kind = j.kind and c.episode = j.episode
      )
    ) as eligible
    from private.engagement_email_jobs j
    where j.state = 'pending' and j.next_attempt_at <= now()
    order by j.next_attempt_at, j.id limit 20
    for update of j skip locked
  ), updated as (
    update private.engagement_email_jobs j set
      state = case when due.eligible then 'pending'
                   when j.expires_at <= now() or j.attempts >= 3 then 'failed'
                   else 'skipped' end,
      attempts = j.attempts + case when due.eligible then 1 else 0 end,
      next_attempt_at = now() + interval '10 minutes'
    from due where j.id = due.id
    returning j.id, j.kind, j.user_id, j.attempts, j.state
  )
  select j.id, j.kind, u.email::text, j.attempts
  from updated j join auth.users u on u.id = j.user_id where j.state = 'pending';
end $$;

create function public.finish_engagement_email_v1(p_id uuid, p_attempt integer, p_outcome text)
returns void language sql security definer set search_path = '' as $$
  update private.engagement_email_jobs j
  set state = case when p_outcome = 'sent' then 'sent'
                   when p_outcome = 'failed' or j.attempts >= 3 then 'failed'
                   else 'pending' end
  where j.id = p_id and j.state = 'pending' and j.attempts = p_attempt
    and p_outcome in ('sent', 'failed', 'retry')
$$;

create function public.unsubscribe_engagement_emails_v1(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into private.engagement_email_opt_outs (user_id)
  select j.user_id from private.engagement_email_jobs j where j.id = p_id and j.attempts > 0
  on conflict do nothing
$$;

revoke all on function public.claim_engagement_emails_v1(), public.finish_engagement_email_v1(uuid, integer, text),
  public.unsubscribe_engagement_emails_v1(uuid) from public, anon, authenticated;
grant execute on function public.claim_engagement_emails_v1(), public.finish_engagement_email_v1(uuid, integer, text),
  public.unsubscribe_engagement_emails_v1(uuid) to service_role;

create function private.wake_engagement_email_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'engagement_email_worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'welcome_email_webhook_secret';
  if endpoint is null or secret is null then return; end if;
  perform net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-welcome-webhook-secret', secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000);
end $$;
revoke all on function private.wake_engagement_email_worker() from public, anon, authenticated;

select cron.schedule('scholau-engagement-email', '*/5 * * * *', $$select private.wake_engagement_email_worker()$$);
commit;
