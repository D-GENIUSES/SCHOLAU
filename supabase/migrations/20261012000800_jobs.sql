-- ScholAu migration 8: scheduled jobs (Supabase Cron / pg_cron).
-- The sweep is the durable path that completes abandoned activity without either client:
-- queue matching/expiry, invitation/ready-window expiry, countdown->active, battle finalization,
-- overdue attempt finalization, slot reconciliation and outbox dispatch. Reads such as
-- get_battle_state_v1 / get_attempt_result_v1 also catch up opportunistically.
-- Sub-minute schedules require pg_cron >= 1.5 (available on Supabase).

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job text;
begin
  foreach v_job in array array['scholau-sweep', 'scholau-retention'] loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end
$$;

select cron.schedule('scholau-sweep', '5 seconds', $$select private.run_sweep()$$);
select cron.schedule('scholau-retention', '17 3 * * *', $$select private.cleanup_retention()$$);
