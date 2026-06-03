-- 0007_place_outright_bet.sql — Outright bet placement RPC
--
-- place_outright_bet() upserts a champion or top-scorer bet for the caller.
-- Raises:
--   P0001  bet_locked   — registration_locked() is true
--   P0003  invalid_bet  — bad bet_type or missing team/player id
--
-- SECURITY INVOKER: runs as the calling user so RLS on outright_bets applies.
-- The explicit lock check gives a clear error on top of the RLS guard.

create or replace function public.place_outright_bet(
  p_bet_type            text,
  p_predicted_team_id   bigint default null,
  p_predicted_player_id bigint default null
) returns public.outright_bets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bet public.outright_bets;
begin
  if p_bet_type not in ('champion', 'top_scorer') then
    raise exception 'invalid_bet' using errcode = 'P0003';
  end if;
  if p_bet_type = 'champion' and p_predicted_team_id is null then
    raise exception 'invalid_bet' using errcode = 'P0003';
  end if;
  if p_bet_type = 'top_scorer' and p_predicted_player_id is null then
    raise exception 'invalid_bet' using errcode = 'P0003';
  end if;

  if public.registration_locked() then
    raise exception 'bet_locked' using errcode = 'P0001';
  end if;

  insert into public.outright_bets (user_id, bet_type, predicted_team_id, predicted_player_id)
  values (auth.uid(), p_bet_type, p_predicted_team_id, p_predicted_player_id)
  on conflict (user_id, bet_type) do update
    set predicted_team_id   = excluded.predicted_team_id,
        predicted_player_id = excluded.predicted_player_id,
        updated_at          = now()
  returning * into v_bet;

  return v_bet;
end;
$$;

grant execute on function public.place_outright_bet(text, bigint, bigint) to authenticated;

-- Add outright_bets to the Realtime publication so leaderboard updates when
-- outright bets are scored at tournament end.
alter publication supabase_realtime add table public.outright_bets;
