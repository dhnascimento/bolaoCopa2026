-- 0016_fd_results.sql — football-data.org results sync support.
--
-- API-Football is suspended; football-data.org (free tier includes the World
-- Cup) is the alternative results source. The sync-results-fd Edge Function
-- matches football-data matches onto the existing fixtures and stores the
-- football-data match id here so later runs update by id.
--
-- The cron invoker reads its config from Vault (cron_secret + functions_base_url)
-- like the other jobs (0014). It is intentionally NOT scheduled here — enable it
-- manually after verifying the one-time fixture mapping:
--   select cron.schedule('sync-results-fd','*/10 * * * *',
--                         'select public.invoke_sync_results_fd()');

alter table public.fixtures add column if not exists fd_match_id bigint;

create or replace function public.invoke_sync_results_fd()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text;
  _base    text;
  _url     text;
  _headers jsonb;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into _base   from vault.decrypted_secrets where name = 'functions_base_url' limit 1;

  _url := coalesce(_base, 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1') || '/sync-results-fd';

  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(url := _url, headers := _headers, body := '{}'::jsonb);
exception when others then
  raise warning 'invoke_sync_results_fd: %', sqlerrm;
end;
$$;

grant execute on function public.invoke_sync_results_fd() to postgres;
