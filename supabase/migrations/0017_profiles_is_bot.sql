-- 0017_profiles_is_bot.sql — tag manufactured "LLM bot" participants.
--
-- Bots are full participants (they appear on the leaderboard and are scored like
-- anyone else) but they must NOT inflate the money pot, which is computed as
-- entry_fee × (count of profiles). This flag lets the pot query count humans only,
-- and lets the UI show a small badge next to bot names.

alter table public.profiles
  add column if not exists is_bot boolean not null default false;

-- Recreate the leaderboard view to expose is_bot (so the UI can badge bots).
-- Definition copied from 0001_init.sql with is_bot appended LAST: CREATE OR REPLACE
-- VIEW can only add columns at the end, never insert one mid-list (that reads as a
-- column rename and errors 42P16). security_invoker is preserved, so RLS of the
-- underlying tables still applies.
create or replace view public.leaderboard with (security_invoker = true) as
with match_pts as (
  select
    mb.user_id,
    sum(mb.points_awarded) as pts,
    count(*) filter (
      where f.status = 'finished'
        and mb.predicted_home = f.regulation_home
        and mb.predicted_away = f.regulation_away
    ) as exact_hits,
    count(*) filter (
      where f.status = 'finished'
        and sign(mb.predicted_home - mb.predicted_away) = sign(f.regulation_home - f.regulation_away)
    ) as correct_results
  from public.match_bets mb
  join public.fixtures f on f.id = mb.fixture_id
  group by mb.user_id
),
outright_pts as (
  select user_id, sum(points_awarded) as pts
  from public.outright_bets
  group by user_id
)
select
  p.id          as user_id,
  p.display_name,
  coalesce(mp.pts, 0) + coalesce(op.pts, 0) as points,
  coalesce(mp.exact_hits, 0)      as exact_hits,
  coalesce(mp.correct_results, 0) as correct_results,
  p.is_bot
from public.profiles p
left join match_pts   mp on mp.user_id = p.id
left join outright_pts op on op.user_id = p.id
order by points desc, exact_hits desc, correct_results desc;
