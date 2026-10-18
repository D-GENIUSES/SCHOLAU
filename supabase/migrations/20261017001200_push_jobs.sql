-- Scheduling requires pg_cron, pg_net and Vault, as on the hosted Supabase project.
-- The development PGlite harness skips *_jobs.sql because it has no networking/scheduler.
create extension if not exists pg_net with schema extensions;
alter table private.push_control add column last_wake_at timestamptz;
create function private.wake_push_worker() returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('scholau.push.wake',0)) then return; end if;
 if exists(select 1 from private.push_control where last_wake_at>clock_timestamp()-interval '2 seconds') then return; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='push_worker_url' limit 1;
 select decrypted_secret into secret from vault.decrypted_secrets where name='push_worker_secret' limit 1;
 if endpoint is null or secret is null then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-push-worker-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=1000);
 update private.push_control set last_wake_at=clock_timestamp();
exception when others then
 -- Wakeups are best-effort. Durable rows and the recovery schedule survive network failures.
 raise warning 'Push wake failed; scheduled recovery will retry';
end $$;
create function private.wake_push_on_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.wake_push_worker(); return null; end $$;
create trigger wake_push_jobs after insert on private.push_jobs for each statement execute function private.wake_push_on_enqueue();
create trigger wake_notification_recipients after insert on private.notification_recipients for each statement execute function private.wake_push_on_enqueue();
revoke all on function private.wake_push_worker(),private.wake_push_on_enqueue() from public,anon,authenticated;
select cron.schedule('scholau-push-recovery','* * * * *',$job$ select private.wake_push_worker(); $job$);
