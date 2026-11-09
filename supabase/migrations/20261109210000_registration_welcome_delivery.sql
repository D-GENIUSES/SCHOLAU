-- Registration welcome email delivery: outbox state, claim/finish RPCs, worker wake.
begin;

alter table private.welcome_email_events
  add column if not exists state text not null default 'pending'
    check (state in ('pending', 'sent', 'failed')),
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now();

update private.welcome_email_events set state = 'sent' where state = 'pending';

create table private.registration_welcome_control (
  singleton boolean primary key default true check (singleton),
  last_wake_at timestamptz
);
insert into private.registration_welcome_control default values;

alter table private.registration_welcome_control enable row level security;
revoke all on private.registration_welcome_control from public, anon, authenticated;

create function public.claim_registration_welcome_emails_v1()
returns table (id uuid, audience text, email text, display_name text, attempt integer)
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended('scholau.registration-welcome.claim', 0)) then return; end if;

  return query
  with due as (
    select e.user_id
    from private.welcome_email_events e
    join auth.users u on u.id = e.user_id
    join public.profiles p on p.id = e.user_id
    where e.state = 'pending'
      and e.next_attempt_at <= now()
      and e.attempts < 3
      and u.email_confirmed_at is not null
      and nullif(btrim(u.email), '') is not null
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and p.deactivated_at is null
    order by e.next_attempt_at, e.user_id
    limit 20
    for update of e skip locked
  ), updated as (
    update private.welcome_email_events e set
      attempts = e.attempts + 1,
      next_attempt_at = now() + interval '10 minutes'
    from due where e.user_id = due.user_id and e.state = 'pending'
    returning e.user_id, e.attempts
  )
  select
    u.id,
    case when exists (
      select 1 from public.user_roles r where r.user_id = u.id and r.role = 'lecturer'
    ) then 'lecturer' else 'student' end,
    u.email::text,
    coalesce(nullif(btrim(p.display_name), ''), 'User')::text,
    updated.attempts
  from updated
  join auth.users u on u.id = updated.user_id
  join public.profiles p on p.id = u.id;
end $$;

create function public.finish_registration_welcome_email_v1(p_user_id uuid, p_attempt integer, p_outcome text)
returns void language sql security definer set search_path = '' as $$
  update private.welcome_email_events e
  set state = case
        when p_outcome = 'sent' then 'sent'
        when p_outcome = 'failed' or e.attempts >= 3 then 'failed'
        else 'pending'
      end
  where e.user_id = p_user_id
    and e.state = 'pending'
    and e.attempts = p_attempt
    and p_outcome in ('sent', 'failed', 'retry')
$$;

revoke all on function public.claim_registration_welcome_emails_v1(),
  public.finish_registration_welcome_email_v1(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_registration_welcome_emails_v1(),
  public.finish_registration_welcome_email_v1(uuid, integer, text)
  to service_role;

create or replace function private.wake_registration_welcome_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare endpoint text; secret text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('scholau.registration-welcome.wake', 0)) then return; end if;
  if exists (
    select 1 from private.registration_welcome_control
    where last_wake_at > clock_timestamp() - interval '2 seconds'
  ) then return; end if;

  select decrypted_secret into endpoint
  from vault.decrypted_secrets where name = 'registration_welcome_worker_url';
  select decrypted_secret into secret
  from vault.decrypted_secrets where name = 'welcome_email_webhook_secret';
  if endpoint is null or secret is null then return; end if;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-welcome-webhook-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  update private.registration_welcome_control set last_wake_at = clock_timestamp();
exception when others then
  raise warning 'Registration welcome wake failed; scheduled recovery will retry';
end $$;

create function private.wake_registration_welcome_on_enqueue() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.wake_registration_welcome_worker();
  return null;
end $$;

drop trigger if exists welcome_email_send_on_insert on private.welcome_email_events;
create trigger welcome_email_send_on_insert
  after insert on private.welcome_email_events
  for each statement
  execute function private.wake_registration_welcome_on_enqueue();

revoke all on function private.wake_registration_welcome_worker(),
  private.wake_registration_welcome_on_enqueue()
  from public, anon, authenticated;

select cron.schedule(
  'scholau-registration-welcome',
  '*/5 * * * *',
  $$select private.wake_registration_welcome_worker()$$
);

commit;
