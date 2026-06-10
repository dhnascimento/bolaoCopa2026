-- 0012_parameterize_cron_url.sql
-- Make the Edge Function base URL configurable per instance instead of
-- hard-coding the project ref, so the same migrations work for a forked pool.
--
-- Set on each project once (Supabase SQL editor or psql):
--   ALTER DATABASE postgres
--     SET app.functions_base_url = 'https://<project-ref>.supabase.co/functions/v1';
--
-- When the setting is absent it falls back to the original project's URL, so the
-- existing instance keeps working unchanged without any manual step.
--
-- Only the three cron invoker function bodies change; their schedules already
-- call them by name and pick up the new definitions automatically.

create or replace function public.invoke_sync_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text;
  _url     text := coalesce(
    current_setting('app.functions_base_url', true),
    'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1'
  ) || '/sync-fixtures';
  _headers jsonb;
begin
  -- Cron secret from Supabase Vault (see 0003); NULL if not configured yet.
  select decrypted_secret
    into _secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(url := _url, headers := _headers, body := '{}'::jsonb);
exception when others then
  raise warning 'invoke_sync_fixtures: %', sqlerrm;
end;
$$;

create or replace function public.invoke_score_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text := current_setting('app.cron_secret', true);
  _url     text := coalesce(
    current_setting('app.functions_base_url', true),
    'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1'
  ) || '/score-fixtures';
  _headers jsonb;
begin
  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(url := _url, headers := _headers, body := '{}'::jsonb);
exception when others then
  raise warning 'invoke_score_fixtures: %', sqlerrm;
end;
$$;

create or replace function public.invoke_send_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text := current_setting('app.cron_secret', true);
  _url     text := coalesce(
    current_setting('app.functions_base_url', true),
    'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1'
  ) || '/send-reminders';
  _headers jsonb;
begin
  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(url := _url, headers := _headers, body := '{}'::jsonb);
exception when others then
  raise warning 'invoke_send_reminders: %', sqlerrm;
end;
$$;
