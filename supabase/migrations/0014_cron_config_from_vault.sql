-- 0014_cron_config_from_vault.sql
-- Read cron config from Supabase Vault instead of database GUCs.
--
-- On hosted Supabase the `postgres` role is not a superuser, so
-- `ALTER DATABASE postgres SET app.*` fails with "permission denied to set
-- parameter" (same reason 0003 moved the cron secret to Vault). 0012 used a GUC
-- for the function base URL, which has the same problem — so both the base URL
-- and the cron secret are now sourced from Vault, the one store the postgres
-- role can write to.
--
-- Per-instance setup (Supabase SQL editor), once:
--   select vault.create_secret('<random-32-char-secret>', 'cron_secret');
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1', 'functions_base_url');
-- (To change an existing value later use vault.update_secret.)
--
-- When `functions_base_url` is absent it falls back to the original project's
-- URL, so the existing instance keeps working with no manual step.

create or replace function public.invoke_sync_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text;
  _base    text;
  _url     text;
  _headers jsonb;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into _base   from vault.decrypted_secrets where name = 'functions_base_url' limit 1;

  _url := coalesce(_base, 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1') || '/sync-fixtures';

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
  _secret  text;
  _base    text;
  _url     text;
  _headers jsonb;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into _base   from vault.decrypted_secrets where name = 'functions_base_url' limit 1;

  _url := coalesce(_base, 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1') || '/score-fixtures';

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
  _secret  text;
  _base    text;
  _url     text;
  _headers jsonb;
begin
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  select decrypted_secret into _base   from vault.decrypted_secrets where name = 'functions_base_url' limit 1;

  _url := coalesce(_base, 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1') || '/send-reminders';

  _headers := jsonb_build_object('Content-Type', 'application/json');
  if _secret is not null and _secret <> '' then
    _headers := _headers || jsonb_build_object('x-cron-secret', _secret);
  end if;

  perform net.http_post(url := _url, headers := _headers, body := '{}'::jsonb);
exception when others then
  raise warning 'invoke_send_reminders: %', sqlerrm;
end;
$$;
