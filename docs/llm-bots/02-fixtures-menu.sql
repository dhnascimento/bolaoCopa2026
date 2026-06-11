-- 02-fixtures-menu.sql — the "menu" you paste into each model.
--
-- Run in the Supabase SQL editor before each prediction round, copy the output,
-- and paste it into the prompt from 03-prompt-template.md.
--
-- The fixtures query is filtered to now() < lock_at, so bots only bet on matches
-- that haven't locked yet — the same fairness rule humans get (admin SQL would
-- otherwise let a bot "predict" a game already underway).

-- 1) Upcoming, still-bettable fixtures. The model needs fixture_id to write bets.
select f.id as fixture_id, f.stage,
       th.name as home, ta.name as away,
       to_char(f.kickoff_at, 'YYYY-MM-DD HH24:MI" UTC"') as kickoff
from public.fixtures f
join public.teams th on th.id = f.home_team_id
join public.teams ta on ta.id = f.away_team_id
where now() < f.lock_at
order by f.kickoff_at;

-- 2) Champion candidates. The model picks a team_id (not a name) — names can
--    contain apostrophes that break a quoted SQL literal.
select id as team_id, name from public.teams order by name;

-- 3) Top-scorer candidates. The model picks a player_id. NB this is the full
--    squad list (~1200 rows); paste it all, or narrow it (e.g. add a WHERE on
--    specific teams, or keep only forwards) if the prompt gets too large.
select pl.id as player_id, pl.name as player, t.name as team
from public.players pl
join public.teams t on t.id = pl.team_id
order by t.name, pl.name;
