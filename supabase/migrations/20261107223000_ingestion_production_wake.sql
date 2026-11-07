-- Production ingestion worker wake: vault URL + fallback when secret is configured.

do $$
begin
  if not exists (
    select 1 from vault.secrets s where s.name = 'ingestion_worker_url'
  ) then
    perform vault.create_secret(
      'https://scholau.com/api/material-ingestion/worker',
      'ingestion_worker_url',
      'POST target for material ingestion worker (production)'
    );
  end if;
exception
  when undefined_table then
    raise notice 'vault extension unavailable — set ingestion_worker_url manually in Supabase Vault';
  when others then
    raise notice 'Could not create ingestion_worker_url vault secret: %', sqlerrm;
end;
$$;

create or replace function private.wake_ingestion_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare endpoint text;
declare secret text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('scholau.ingestion.wake', 0)) then return; end if;
  begin
    select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'ingestion_worker_url' limit 1;
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'ingestion_worker_secret' limit 1;
  exception when others then
    endpoint := null;
    secret := null;
  end;
  endpoint := coalesce(nullif(btrim(endpoint), ''), 'https://scholau.com/api/material-ingestion/worker');
  if secret is null or btrim(secret) = '' then return; end if;
  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingestion-worker-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
exception when others then
  raise warning 'Ingestion wake failed: %', sqlerrm;
end;
$$;
