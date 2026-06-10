-- Seed group_label (A–L) for the 2026 World Cup group stage.
--
-- The API-Football free plan does not cover league=1 / season=2026, so the
-- sync-fixtures function receives an empty fixtures response and cannot populate
-- group_label automatically. The draw is final and public, so we seed it here,
-- keyed on team name (stable). Source:
--   https://en.wikipedia.org/wiki/2026_FIFA_World_Cup
--
-- Both teams in a group-stage fixture share a group, so labelling by the home
-- team's group is sufficient. Idempotent: re-running assigns the same labels.
with team_group(name, grp) as (
  values
    ('Czech Republic', 'A'), ('Mexico', 'A'), ('South Africa', 'A'), ('South Korea', 'A'),
    ('Bosnia & Herzegovina', 'B'), ('Canada', 'B'), ('Qatar', 'B'), ('Switzerland', 'B'),
    ('Brazil', 'C'), ('Haiti', 'C'), ('Morocco', 'C'), ('Scotland', 'C'),
    ('Australia', 'D'), ('Paraguay', 'D'), ('Türkiye', 'D'), ('USA', 'D'),
    ('Curaçao', 'E'), ('Ecuador', 'E'), ('Germany', 'E'), ('Ivory Coast', 'E'),
    ('Japan', 'F'), ('Netherlands', 'F'), ('Sweden', 'F'), ('Tunisia', 'F'),
    ('Belgium', 'G'), ('Egypt', 'G'), ('Iran', 'G'), ('New Zealand', 'G'),
    ('Cape Verde Islands', 'H'), ('Saudi Arabia', 'H'), ('Spain', 'H'), ('Uruguay', 'H'),
    ('France', 'I'), ('Iraq', 'I'), ('Norway', 'I'), ('Senegal', 'I'),
    ('Algeria', 'J'), ('Argentina', 'J'), ('Austria', 'J'), ('Jordan', 'J'),
    ('Colombia', 'K'), ('Congo DR', 'K'), ('Portugal', 'K'), ('Uzbekistan', 'K'),
    ('Croatia', 'L'), ('England', 'L'), ('Ghana', 'L'), ('Panama', 'L')
)
update public.fixtures f
set group_label = tg.grp
from public.teams t
join team_group tg on tg.name = t.name
where f.stage = 'group'
  and f.home_team_id = t.id;
