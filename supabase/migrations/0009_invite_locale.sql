-- Propagate the invited locale to the new user's profile.
--
-- inviteUserByEmail() stores { display_name, locale } in raw_user_meta_data.
-- handle_new_user() previously read only display_name and let profiles.locale
-- fall back to its column default ('pt-BR'), so the admin's language choice on
-- the invite form was silently dropped. Read the locale here too, defaulting to
-- 'pt-BR' when absent (and guarding against an out-of-constraint value).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.registration_locked() then
    raise exception 'Registration is closed for this pool';
  end if;
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data->>'locale' in ('pt-BR', 'en')
        then new.raw_user_meta_data->>'locale'
      else 'pt-BR'
    end
  );
  return new;
end;
$$;
