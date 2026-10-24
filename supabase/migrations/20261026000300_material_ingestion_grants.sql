-- Cron recovery for ingestion worker (mirrors push wake pattern).
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('scholau-ingestion-recovery', '* * * * *', $job$ select private.wake_ingestion_worker(); $job$);
  end if;
exception when others then
  raise notice 'Ingestion cron not scheduled: %', sqlerrm;
end;
$cron$;
