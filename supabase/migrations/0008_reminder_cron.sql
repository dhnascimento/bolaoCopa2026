-- 0008_reminder_cron.sql — pg_cron job for the send-reminders Edge Function
--
-- Runs every 15 minutes.  The Edge Function finds fixtures whose lock_at is
-- within the next 2 hours and reminder_sent_at IS NULL, then emails each user
-- who has no bet on those fixtures.  Idempotent — reminder_sent_at prevents
-- duplicate sends across cron firings.

create or replace function public.invoke_send_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  _secret  text := current_setting('app.cron_secret', true);
  _url     text := 'https://ivhpmgrucihnwugauxve.supabase.co/functions/v1/send-reminders';
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
  raise warning 'invoke_send_reminders: %', sqlerrm;
end;
$$;

grant execute on function public.invoke_send_reminders() to postgres;

select cron.schedule(
  'send-reminders',   -- job name (must be unique)
  '*/15 * * * *',     -- every 15 minutes
  'select public.invoke_send_reminders()'
);
