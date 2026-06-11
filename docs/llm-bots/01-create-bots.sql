-- 01-create-bots.sql — manufacture "LLM bot" participants.
--
-- Run ONCE in the Supabase SQL editor (it runs as `postgres`, which bypasses RLS).
-- Re-running is safe: existing bots are skipped (ON CONFLICT DO NOTHING).
--
-- Each bot is a normal auth.users + profiles pair. The handle_new_user trigger
-- creates the profile from raw_user_meta_data.display_name. Because that trigger
-- refuses new users once registration is locked, this block temporarily clears
-- settings.registration_locked_at and restores it. The whole thing is one
-- transaction (DO block): if anything fails, the unlock is rolled back too.
--
-- To add models: edit the (email, display_name) list below. Keep the @llm.bolao
-- domain — the is_bot tagging and the fixtures menu rely on it.

do $$
declare
  v_saved timestamptz;
  rec     record;
begin
  select registration_locked_at into v_saved from public.settings where id = 1;
  update public.settings set registration_locked_at = null where id = 1;  -- temp unlock

  for rec in select * from (values
      ('claude-opus@llm.bolao', 'Claude Opus 4.8'),
      ('gpt@llm.bolao',         'GPT-5'),
      ('gemini@llm.bolao',      'Gemini 3 Pro'),
      ('deepseek@llm.bolao',      'DeepSeek')
      -- add more models here, e.g.:
      -- ('grok@llm.bolao',     'Grok 4'),
    ) as m(email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
      'authenticated', 'authenticated', rec.email,
      crypt('bot-no-login', gen_salt('bf')),   -- junk password; bots never sign in
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', rec.name, 'locale', 'pt-BR'),
      '', '', '', ''
    ) on conflict (email) do nothing;          -- re-runnable; trigger creates the profile
  end loop;

  -- handle_new_user doesn't know about is_bot, so tag the bot-domain users here.
  update public.profiles p set is_bot = true
  from auth.users u
  where u.id = p.id
    and u.email like '%@llm.bolao'
    and p.is_bot = false;

  update public.settings set registration_locked_at = v_saved where id = 1;  -- restore
end $$;

-- Verify: every model should appear with is_bot = true.
select p.display_name, p.is_bot, u.email
from public.profiles p
join auth.users u on u.id = p.id
where u.email like '%@llm.bolao'
order by p.display_name;
