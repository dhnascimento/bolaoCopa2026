-- 0019_schedule_fd_sync.sql — schedule the football-data results/fixtures sync.
--
-- API-Football is suspended, so sync-fixtures (its only consumer) can no longer
-- seed fixtures. The sync-results-fd Edge Function now also SEEDS knockout
-- fixtures from football-data.org (in addition to writing results), so it must
-- run on a schedule for the whole knockout stage. The invoker
-- public.invoke_sync_results_fd() already exists (0016); only the schedule was
-- missing.
--
-- Idempotent: unschedule first (guarded) so re-running this migration is safe.

-- ── Schedule sync-results-fd: every 10 minutes ─────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-results-fd') then
    perform cron.unschedule('sync-results-fd');
  end if;
end $$;

select cron.schedule(
  'sync-results-fd',
  '*/10 * * * *',                            -- every 10 minutes
  'select public.invoke_sync_results_fd()'
);

-- ── Stop the dead API-Football fixture sync ────────────────────────────────
-- sync-fixtures depends entirely on the suspended API-Football account; leaving
-- it scheduled just fires failing requests every 6 hours. Remove it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-fixtures') then
    perform cron.unschedule('sync-fixtures');
  end if;
end $$;
