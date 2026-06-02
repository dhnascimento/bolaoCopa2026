---
name: api-football
description: Use when fetching football data (fixtures, live scores, odds, teams, players) from API-Football. Covers the client wrapper, caching, ID mapping, and quota discipline.
---

# Calling API-Football

Source: API-Football (api-sports.io), `league=1`, `season=2026`. Key in `API_FOOTBALL_KEY` (server-only).

Rules:
1. All calls go through `lib/football/client.ts`. Never call the API from a component, page, or the browser.
2. Protect quota:
   - Teams / players / fixtures: synced on a schedule and persisted to our DB. Read from our DB at request time, not the API.
   - Odds: cached on the fixture row (`odds_*`, `odds_fetched_at`); refresh on a schedule, not per page load.
   - Live scores: poll only during active match windows, not 24/7.
3. Map external IDs to our IDs on sync (`api_team_id`, `api_fixture_id`, `api_player_id`). App logic uses our IDs.
4. Knockout fixtures appear progressively as the group stage resolves — the sync UPSERTS new fixtures and must not assume the full bracket exists.
5. Recompute is automatic: `lock_at` is a generated column (`kickoff_at - 5 min`), so just keep `kickoff_at` correct on sync.

## Checklist
- [ ] No API calls outside the wrapper
- [ ] Request-time reads hit our DB/cache, not the API
- [ ] Sync upserts (handles new and rescheduled fixtures)
