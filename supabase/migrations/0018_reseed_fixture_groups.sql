-- Re-seed group_label (A–L) for the 2026 World Cup group stage.
--
-- Migration 0010 ran its UPDATE before the group-stage fixtures existed in this
-- instance (the rows were populated afterwards), so it matched zero rows and
-- every group fixture was left with group_label = NULL — which hid the group
-- chip on the fixtures cards. This re-applies the same name-keyed seed. The
-- draw is final and public, both teams in a fixture share a group, so labelling
-- by the home team's group is sufficient. Idempotent: re-running is a no-op.
--   Source: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup
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
  and f.home_team_id = t.id
  and f.group_label is null;
