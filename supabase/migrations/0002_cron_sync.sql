-- 0002_cron_sync.sql — pg_net + pg_cron wiring for the sync-fixtures Edge Function
--
-- SETUP REQUIRED after deploying (one-time, run in the Supabase SQL editor):
--
--   1. Set a random secret for the cron job:
--      ALTER DATABASE postgres SET app.cron_secret TO 'replace-with-random-32-char-string';
--
--   2. Set the same value as a Supabase Edge Function secret so the function
--      can verify callers:
--      supabase secrets set CRON_SECRET=replace-with-random-32-char-string
--
--      (Without step 2 the function still runs but skips the secret check.)
--
-- The function URL uses the project ref; update it if you fork to a new project.

-- Both extensions are pre-installed on Supabase Cloud; these are no-ops if already present.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── Helper: invoke the sync Edge Function ─────────────────────────────────
create or replace function public.invoke_sync_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text := current_setting('app.cron_secret', true);
  _url     text := 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1/sync-fixtures';
  _headers jsonb;
begin
  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  -- net.http_post is provided by the pg_net extension (always in the net schema).
  -- It fires an async HTTP request and returns a request_id bigint; we discard it.
  perform net.http_post(
    url     := _url,
    headers := _headers,
    body    := '{}'::jsonb
  );
exception when others then
  -- Log but do not crash so pg_cron marks the job as succeeded
  raise warning 'invoke_sync_fixtures: %', sqlerrm;
end;
$$;

-- Grant execution to the postgres role used by pg_cron
grant execute on function public.invoke_sync_fixtures() to postgres;

-- ── Schedule: every 6 hours ────────────────────────────────────────────────
-- Runs at 00:00, 06:00, 12:00, 18:00 UTC.
-- Adjust to '0 */1 * * *' (hourly) once the tournament starts and scores
-- need to be picked up quickly.  Live-score polling (every 5 min during
-- match windows) will be wired separately in a later migration.
select cron.schedule(
  'sync-fixtures',          -- job name (must be unique)
  '0 */6 * * *',            -- every 6 hours
  'select public.invoke_sync_fixtures()'
);
