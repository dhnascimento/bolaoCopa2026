-- 0003_cron_vault_secret.sql
--
-- Updates invoke_sync_fixtures() to read CRON_SECRET from Supabase Vault
-- instead of ALTER DATABASE SET (which is blocked for non-superusers).
--
-- PREREQUISITE — run once in the SQL editor before pushing this migration:
--   select vault.create_secret('<your-cron-secret-value>', 'cron_secret');
-- Use the same value you added as the CRON_SECRET edge function secret.

create or replace function public.invoke_sync_fixtures()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text;
  _url     text := 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1/sync-fixtures';
  _headers jsonb;
begin
  -- Read the cron secret from Supabase Vault.
  -- Returns NULL if the vault entry doesn't exist yet (graceful fallback).
  select decrypted_secret
    into _secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

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
  raise warning 'invoke_sync_fixtures: %', sqlerrm;
end;
$$;
