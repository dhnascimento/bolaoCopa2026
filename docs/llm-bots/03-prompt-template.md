# Prompt template — ask an LLM for its Bolão predictions

Paste the block below into the model. Replace:

- `__MODEL_NAME__` → the bot's exact `display_name` (e.g. `Claude Opus 4.8`) — it must
  match a row created by `01-create-bots.sql`.
- `__FIXTURES_MENU__` → the first result set from `02-fixtures-menu.sql` (has `fixture_id`).
- `__CHAMPION_CANDIDATES__` → the team list (result set 2, has `team_id`).
- `__TOP_SCORER_CANDIDATES__` → the player list (result set 3, has `player_id`).

Picks are made by **numeric id** (`fixture_id`, `team_id`, `player_id`), never by name —
player/team names can contain apostrophes (e.g. `Ibrahim Sa'deh`) that break a quoted SQL
literal, and short names repeat across squads. The model references *itself* by
`display_name`, which we control. The SQL upserts (`ON CONFLICT DO UPDATE`), so re-running a
model's output just updates its picks — safe to re-run, and a model can revise before kickoff.

---

You are **__MODEL_NAME__**, a contestant in a FIFA World Cup 2026 betting pool. Predict the
**regulation-time (90-minute)** score of every fixture below, plus one champion and one top
scorer for the tournament.

Fixtures (bet on every row; use the `fixture_id` value exactly):

```
__FIXTURES_MENU__
```

Champion candidates (use the `team_id` of your pick):

```
__CHAMPION_CANDIDATES__
```

Top-scorer candidates (use the `player_id` of your pick):

```
__TOP_SCORER_CANDIDATES__
```

**Output ONLY the SQL below — no prose, no code fences, no commentary.** Fill in your
predicted scores and outright picks. Use each `fixture_id`, `team_id`, and `player_id`
exactly as listed in the menus.

```sql
-- match scorelines: one row per fixture above
insert into public.match_bets (user_id, fixture_id, predicted_home, predicted_away)
values
  ((select id from public.profiles where display_name = '__MODEL_NAME__'), <fixture_id>, <home>, <away>),
  ((select id from public.profiles where display_name = '__MODEL_NAME__'), <fixture_id>, <home>, <away>)
  -- ... one row per fixture
on conflict (user_id, fixture_id) do update
  set predicted_home = excluded.predicted_home,
      predicted_away = excluded.predicted_away,
      updated_at = now();

-- champion: your chosen team_id from the candidates list
insert into public.outright_bets (user_id, bet_type, predicted_team_id)
values ((select id from public.profiles where display_name = '__MODEL_NAME__'),
        'champion', <team_id>)
on conflict (user_id, bet_type) do update
  set predicted_team_id = excluded.predicted_team_id, updated_at = now();

-- top scorer: your chosen player_id from the candidates list
insert into public.outright_bets (user_id, bet_type, predicted_player_id)
values ((select id from public.profiles where display_name = '__MODEL_NAME__'),
        'top_scorer', <player_id>)
on conflict (user_id, bet_type) do update
  set predicted_player_id = excluded.predicted_player_id, updated_at = now();
```

---

## Running the model's output

Paste the returned SQL straight into the Supabase SQL editor and run it. To confirm it
landed (scalar subqueries — a plain join over both bet tables would multiply the counts):

```sql
select pr.display_name,
       (select count(*) from public.match_bets    mb
          where mb.user_id = pr.id)                                      as match_bets,
       (select count(*) from public.outright_bets ob
          where ob.user_id = pr.id and ob.bet_type = 'champion')         as has_champion,
       (select count(*) from public.outright_bets ob
          where ob.user_id = pr.id and ob.bet_type = 'top_scorer')       as has_top_scorer
from public.profiles pr
where pr.is_bot
order by pr.display_name;
```

Scoring is automatic: the existing match- and outright-scoring crons award points to these
rows like any human's, and the bots appear on the leaderboard (with a 🤖 badge) without
inflating the pot.
