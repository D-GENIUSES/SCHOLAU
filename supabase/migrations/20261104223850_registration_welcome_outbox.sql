-- Verified-email registration already writes to this outbox. Its DDL was absent
-- from migration history, so a clean database failed at confirmation time.
-- Delivery infrastructure may attach its own sender trigger; no mail is sent here.
begin;
create table if not exists private.welcome_email_events (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.welcome_email_events enable row level security;
revoke all on private.welcome_email_events from public,anon,authenticated;
revoke all on function private.queue_welcome_email() from public,anon,authenticated;
create trigger registration_queue_welcome after insert on private.legal_acceptances
for each row execute function private.queue_welcome_email();

-- Managed registration can run consent capture at insertion and confirmation.
-- Preserve the original visibility preference and pending state on the retry.
do $$
declare definition text;
begin
  select pg_get_functiondef('private.capture_registration_legal()'::regprocedure) into definition;
  if position('from public.profiles where id=new.id;' in definition)=0 then
    raise exception 'Unexpected registration capture definition';
  end if;
  definition:=replace(definition,'from public.profiles where id=new.id;',
    'from public.profiles where id=new.id on conflict (user_id) do nothing;');
  execute definition;
end $$;
commit;
