-- 0006_score_cron.sql — pg_cron job for the score-fixtures Edge Function
--
-- Runs every 5 minutes.  The Edge Function itself checks the DB for an
-- active match window before hitting the API-Football quota — outside
-- match windows the function returns immediately with {skipped:true}.
--
-- Uses the same CRON_SECRET pattern as invoke_sync_fixtures() in 0002.
-- The project ref is hard-coded; update if you fork to a new project.

create or replace function public.invoke_score_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text := current_setting('app.cron_secret', true);
  _url     text := 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1/score-fixtures';
  _headers jsonb;
begin
  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(
    url     := _url,
    headers := _headers,
    body    := '{}'::jsonb
  );
exception when others then
  raise warning 'invoke_score_fixtures: %', sqlerrm;
end;
$$;

grant execute on function public.invoke_score_fixtures() to postgres;

select cron.schedule(
  'score-fixtures',   -- job name (must be unique)
  '*/5 * * * *',      -- every 5 minutes
  'select public.invoke_score_fixtures()'
);
