-- 0005_score_match_bets.sql — Idempotent match-bet scoring function
--
-- score_match_bets() recomputes points_awarded for every match_bet attached
-- to a finished fixture, using the scoring config from the settings row.
--
-- Invariants:
--   * Points are ASSIGNED (not incremented) — re-running is always safe.
--   * Only bets on fixtures with status='finished' and non-null regulation
--     scores are touched; unfinished fixtures are left at 0.
--   * Exact score = points_correct_result + points_exact_score_bonus (stacked).
--
-- Security: SECURITY DEFINER runs as the function owner (postgres), bypassing
-- RLS on match_bets.  The prevent_points_tampering trigger still fires; it
-- reads auth.uid() from the caller's JWT — service-role callers have no JWT
-- so auth.uid() = null → the trigger's non-admin guard is skipped.
--
-- Returns the number of match_bet rows updated.

create or replace function public.score_match_bets()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pts_result  int;
  v_pts_bonus   int;
  v_count       int;
begin
  select points_correct_result, points_exact_score_bonus
  into   v_pts_result, v_pts_bonus
  from   public.settings
  where  id = 1;

  update public.match_bets mb
  set    points_awarded = case
    -- exact score: predicted both home and away correctly
    when f.regulation_home = mb.predicted_home
     and f.regulation_away = mb.predicted_away
    then v_pts_result + v_pts_bonus

    -- correct result: win/draw/loss direction matches (sign comparison)
    when sign(f.regulation_home::numeric - f.regulation_away::numeric)
       = sign(mb.predicted_home::numeric - mb.predicted_away::numeric)
    then v_pts_result

    else 0
  end
  from   public.fixtures f
  where  f.id = mb.fixture_id
    and  f.status = 'finished'
    and  f.regulation_home is not null
    and  f.regulation_away is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
