-- 0004_place_bet_rpc.sql — Atomic match-bet placement with server-side lock validation
--
-- Returns the upserted match_bets row, or raises:
--   P0002  fixture_not_found — no fixture with that id
--   P0001  bet_locked        — now() >= fixture.lock_at
--
-- SECURITY INVOKER: runs as the calling user so RLS on match_bets still applies.
-- The explicit lock check provides a clear error message on top of the RLS guard.

create or replace function public.place_match_bet(
  p_fixture_id     bigint,
  p_predicted_home int,
  p_predicted_away int
) returns public.match_bets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lock_at timestamptz;
  v_bet     public.match_bets;
begin
  select lock_at into v_lock_at
  from public.fixtures
  where id = p_fixture_id;

  if not found then
    raise exception 'fixture_not_found' using errcode = 'P0002';
  end if;

  if now() >= v_lock_at then
    raise exception 'bet_locked' using errcode = 'P0001';
  end if;

  insert into public.match_bets (user_id, fixture_id, predicted_home, predicted_away)
  values (auth.uid(), p_fixture_id, p_predicted_home, p_predicted_away)
  on conflict (user_id, fixture_id) do update
    set predicted_home = excluded.predicted_home,
        predicted_away = excluded.predicted_away,
        updated_at     = now()
  returning * into v_bet;

  return v_bet;
end;
$$;

grant execute on function public.place_match_bet(bigint, int, int) to authenticated;
