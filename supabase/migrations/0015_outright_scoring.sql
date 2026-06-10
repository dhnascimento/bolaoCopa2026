-- 0015_outright_scoring.sql — record the actual champion / top scorer and score
-- outright bets from them. Mirrors the idempotent match scorer (0005).
--
-- Match scoring already exists (score_match_bets); outright scoring did not.
-- The admin sets the actual results from the Results page; this assigns points.

alter table public.settings
  add column if not exists actual_champion_team_id    bigint references public.teams(id),
  add column if not exists actual_top_scorer_player_id bigint references public.players(id);

-- Idempotent: points are ASSIGNED (not incremented), so re-running is always
-- safe. A bet scores its configured points only when the actual result is set
-- and matches the prediction; everything else is reset to 0.
create or replace function public.score_outright_bets()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_champion_team  bigint;
  v_top_scorer     bigint;
  v_pts_champion   int;
  v_pts_top_scorer int;
  v_count          int;
begin
  select actual_champion_team_id, actual_top_scorer_player_id,
         points_correct_champion, points_correct_top_scorer
    into v_champion_team, v_top_scorer, v_pts_champion, v_pts_top_scorer
    from public.settings
   where id = 1;

  update public.outright_bets ob
  set points_awarded = case
    when ob.bet_type = 'champion'
     and v_champion_team is not null
     and ob.predicted_team_id = v_champion_team
    then v_pts_champion

    when ob.bet_type = 'top_scorer'
     and v_top_scorer is not null
     and ob.predicted_player_id = v_top_scorer
    then v_pts_top_scorer

    else 0
  end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
