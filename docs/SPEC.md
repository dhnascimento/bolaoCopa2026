# Bolão World Cup 2026 — v1 Spec & Build Plan

A betting pool app for a private group (≤100 users) for the FIFA World Cup 2026 (June 11 – July 19, 2026). The app does **not** move money; it tracks predictions, scores them, and shows a live leaderboard and the pot total.

This document is written to be handed to Claude Code as the source of truth. Build in the order of the day-by-day plan at the bottom.

---

## 1. Stack

- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui. Mobile-first; ensure good desktop layout.
- **Backend:** Supabase — Postgres, Auth, Realtime, Edge Functions, `pg_cron`.
- **i18n:** `next-intl`. Locales: `pt-BR` (default for most users) and `en`. Store the user's locale on their profile.
- **Football data:** API-Football (api-sports.io), `league=1`, `season=2026`. Covers fixtures, live scores, pre-match odds, players. Validate the free tier against a real fixture on Day 1 before committing.
- **Email (reminders):** Resend.
- **Deploy:** Vercel (frontend) + Supabase (managed backend). Both free/cheap tiers are far more than enough for ≤100 users. Do **not** self-host the production app on a home server — uptime during live matches matters.

## 2. Fixed decisions & assumptions

- Single pool. No multi-tenancy.
- Max ~100 users. Treat scalability as a non-requirement; do not introduce microservices, queues, or sharding. A single Postgres + Next.js app is correct.
- **Scoring uses the regulation (90-minute) result.** Extra time and penalties do not affect exact-score or result scoring.
- Registration closes at first kickoff (2026-06-11). No new users after that.
- Outright bets (champion, top scorer) lock at first kickoff.
- Each match's bets lock **5 minutes before that match's kickoff**.
- Tiebreaker on the leaderboard: total points → most exact-score hits → most correct results → (if still tied) shared rank.
- Times stored in UTC, displayed in the user's local time zone (most will be ET / Toronto, but don't hardcode).

## 3. Scoring rules (all values admin-configurable)

Configurable point values, defaults shown:
- Correct result (win/draw/loss outcome): **3**
- Exact score (implies correct result; award exact-score points *instead of*, not in addition to, the result points — or stacked; make this a config toggle, default: stacked, so an exact score = result points + exact bonus): result 3 + exact bonus 5 = 8 total. Confirm preference before launch.
- Correct champion: **15**
- Correct top scorer (artilheiro): **15**

All point values live in a single `settings`/`scoring_config` row editable from the admin area.

## 4. Data model (Postgres)

- `profiles` — `id` (FK auth.users), `display_name`, `locale`, `is_admin`, `payment_self_confirmed_at`, `payment_admin_status` (`unpaid|confirmed`), `payment_confirmed_by`.
- `settings` — singleton row: `entry_fee`, `currency`, payout split (`pct_first`, `pct_second`, `pct_third`), `registration_locked_at`, plus scoring config (or a separate `scoring_config` row).
- `teams` — `id`, `api_team_id`, `name`, `flag_url`. (Country names: localize in the app layer, not the DB.)
- `players` — `id`, `api_player_id`, `name`, `team_id`. (For top-scorer bets.)
- `fixtures` — `id`, `api_fixture_id`, `stage` (group/R32/R16/QF/SF/final), `home_team_id`, `away_team_id`, `kickoff_at` (UTC), `lock_at` (= kickoff − 5 min), `status`, `home_score`, `away_score`, `regulation_home`, `regulation_away`, `finished_at`, `odds_home`, `odds_draw`, `odds_away`, `odds_fetched_at`, `reminder_sent_at`.
- `match_bets` — `id`, `user_id`, `fixture_id`, `predicted_home`, `predicted_away`, `points_awarded`, `created_at`, `updated_at`. Unique `(user_id, fixture_id)`.
- `outright_bets` — `id`, `user_id`, `type` (`champion|top_scorer`), `predicted_team_id`, `predicted_player_id`, `points_awarded`. Unique `(user_id, type)`.
- `leaderboard` — a Postgres **view** summing `points_awarded` per user across match + outright bets, with the tiebreaker columns (exact-score count, correct-result count) computed for ordering.

## 5. Row-Level Security & fairness (critical)

- A user may read **their own** `match_bets` at any time.
- A user may read **other users'** `match_bets` only for fixtures where `now() >= lock_at`. Enforce in the RLS policy, not just the UI — this prevents copying picks before lock.
- Same rule for `outright_bets`: hidden from others until first kickoff.
- Writes to bets are allowed only when `now() < fixtures.lock_at` (for match bets) / before registration lock (for outrights). Enforce server-side via an RPC or Edge Function — **never trust the client clock.**
- Only `is_admin` users can write `settings`/`scoring_config`, override payment status, or trigger a rescore.

## 6. Key flows

1. **Auth / onboarding.** Supabase Auth (email + password or magic link). Invite-oriented since it's a closed group. Block new sign-ups once `now() >= registration_locked_at`.
2. **Place a bet.** User picks a score (match) or champion/top-scorer (outright). Server-side RPC validates the lock window, then upserts. Editable until lock.
3. **Sync fixtures.** Scheduled job upserts teams, players, and fixtures from API-Football. Knockout fixtures appear progressively as the group stage resolves — the sync must upsert new fixtures, not assume the full bracket exists up front. Recompute `lock_at` on kickoff changes.
4. **Live scores.** Poll API-Football for in-progress and just-finished matches **only during active match windows** (don't poll 24/7 — protect API quota). A ~5-minute delay is acceptable.
5. **Scoring engine.** For finished fixtures, write `regulation_home/away`, then compute and **set** (not increment) `points_awarded` per the scoring config. Must be idempotent — re-running never double-counts. Outright bets scored when champion is known / at tournament end for top scorer.
6. **Leaderboard.** Read the `leaderboard` view. Use Supabase Realtime on `match_bets`/`fixtures` to trigger a refetch; the 5-minute scoring cadence drives updates.
7. **Pot total.** `entry_fee × (count of users)`, shown near the leaderboard. Decide whether to count all registered users or only payment-confirmed ones (recommend: all registered, since registration closes before kickoff).
8. **Payment confirmation.** User self-confirms they paid the pot-keeper (sets `payment_self_confirmed_at`). Admin can override `payment_admin_status` either direction and is recorded in `payment_confirmed_by`. Show a roster with payment status in the admin area.
9. **Reminders (email, v1).** Cron every ~15 min finds fixtures whose `lock_at` is within the next window and whose `reminder_sent_at` is null, finds users with no bet on those fixtures, sends one email via Resend, then stamps `reminder_sent_at`. Idempotent; no duplicate sends.
10. **Odds.** Fetch pre-match 1/X/2 odds from API-Football, cache on the fixture (`odds_*`, `odds_fetched_at`), display beside each game. Refresh occasionally, not per page load.

## 7. i18n

- `next-intl` with `pt-BR` and `en` message catalogs. PT-BR is the primary audience.
- Localize all UI strings, dates, and the few football terms that matter (e.g. "artilheiro" / "top scorer"). Team/country names can come from a localized lookup in the app layer.
- Locale stored on the profile; switchable in settings.

## 8. Engineering gotchas (do not skip)

- **Server-authoritative lock enforcement.** Client clocks lie. Validate every bet write against `lock_at` server-side.
- **Idempotent scoring.** Recompute by assignment, never by `+=`.
- **API quota.** Cache fixtures and odds; poll live data only during match windows.
- **Progressive bracket.** Round-of-32 onward doesn't exist until groups finish; sync must handle late-appearing fixtures.
- **Time zones.** UTC in the DB, local on screen.
- **Bet privacy before lock** — enforced in RLS (see §5).

## 9. v1 cut line

Ship these for v1: auth + registration lock, match bets with lock enforcement and pre-lock privacy, outright bets, idempotent scoring, realtime leaderboard, pot total, payment self-confirm + admin override, admin scoring config, bilingual UI, email reminders, odds display.

**Deferred (post-v1):** WhatsApp reminders (Twilio WhatsApp or WhatsApp Cloud API), match predictions/stats, richer analytics.

## 10. Day-by-day plan (target: usable by ~June 8, onboarded by June 10)

- **Day 1 — Foundation.** Scaffold Next.js + TS + Tailwind + shadcn. Create Supabase project, schema, RLS policies, auth flow, i18n skeleton. Validate API-Football free tier with one real call.
- **Day 2 — Data sync.** Edge Function + cron pulling teams, players, and fixtures (`league=1`, `season=2026`); populate `fixtures` with computed `lock_at`.
- **Day 3 — Betting.** Mobile-first fixtures list + place/edit match bets, server-side lock RPC, RLS hiding others' bets pre-lock.
- **Day 4 — Scoring.** Finished-fixture polling, idempotent points computation, admin scoring-config UI.
- **Day 5 — Leaderboard & outrights.** Leaderboard view with realtime + tiebreaker, pot total, champion + top-scorer bets locking at kickoff.
- **Day 6 — Payments & admin.** Self-confirm + admin override, admin roster/area, registration lock.
- **Day 7 — Reminders, odds, polish.** Resend email reminders via cron, odds display, full PT-BR/EN pass, mobile/desktop polish.
- **Day 8 — Buffer.** Test, deploy to Vercel, onboard friends, dry run. (WhatsApp stays deferred.)
