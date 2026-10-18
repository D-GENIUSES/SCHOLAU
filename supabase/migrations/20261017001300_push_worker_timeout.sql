-- A complete bounded worker invocation can take tens of seconds. A one-second
-- HTTP timeout caused cold starts/batches to appear failed to the scheduler.
create or replace function private.wake_push_worker() returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 if not pg_try_advisory_xact_lock(hashtextextended('scholau.push.wake',0)) then return; end if;
 if exists(select 1 from private.push_control where last_wake_at>clock_timestamp()-interval '2 seconds') then return; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='push_worker_url' limit 1;
 select decrypted_secret into secret from vault.decrypted_secrets where name='push_worker_secret' limit 1;
 if endpoint is null or secret is null then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-push-worker-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=60000);
 update private.push_control set last_wake_at=clock_timestamp();
exception when others then
 raise warning 'Push wake failed; scheduled recovery will retry';
end $$;
revoke all on function private.wake_push_worker() from public,anon,authenticated;
