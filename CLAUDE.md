# Bolão World Cup 2026

Private betting-pool web app for the FIFA World Cup 2026 (June 11 – July 19). One pool, ≤100 users. The app tracks predictions, scores them automatically, and shows a live leaderboard and the pot total. It does **not** move money.

Full spec: `docs/SPEC.md` — read it before any non-trivial work.

## Stack
- Next.js (App Router, TypeScript) · Tailwind CSS · shadcn/ui
- Supabase: Postgres, Auth, Realtime, Edge Functions, pg_cron
- i18n: next-intl — locales `pt-BR` (default) and `en`
- Football data: API-Football (api-sports.io), `league=1`, `season=2026`
- Email: Resend · Deploy: Vercel + Supabase

## Commands
- `npm run dev` — local dev
- `npm run build` — production build
- `npm run lint` — eslint (auto-fix with `-- --fix`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — tests
- `npm run db:types` — regenerate Supabase types into `lib/database.types.ts`

## Invariants (never violate)
1. **Bet privacy.** A user may read another user's match/outright bets only after that bet's lock time. Enforced in RLS, not just UI.
2. **Server-authoritative locks.** Every bet write is validated against the fixture lock time (kickoff − 5 min) in the database. Never trust the client clock.
3. **Idempotent scoring.** Compute points by assignment (`points = f(...)`), never `+=`. Re-running the scorer must never double-count.
4. **Bilingual or it doesn't ship.** Every user-facing string exists in both `pt-BR` and `en`. No hardcoded text in components.
5. **UTC in the database, local time on screen.**
6. **Service-role key is server-only.** Never importable from client code.

## Conventions
- TypeScript strict; no `any`. No default exports except Next.js pages/layouts.
- All DB access via the typed clients in `lib/supabase/` (`client` and `server` are RLS-governed; `admin` bypasses RLS and is server-only).
- Schema changes only via migrations in `supabase/migrations/`; never edit the DB by hand. Regenerate types after.
- "Payment" is a confirmation flag only; no money moves through the app.
- When building UI, follow the **frontend-design** skill's tokens and styling guidance. Mobile-first, good desktop.

## Scoring (defaults; admin-configurable at runtime)
Regulation (90-minute) result only. Correct result **3** · exact score bonus **+5** (stacked → exact = 8) · correct champion **15** · correct top scorer **15**. Tiebreaker: points → exact-score hits → correct results.

## Working with this repo
- `.claude/skills/` holds the project workflows (migrations, i18n, scoring, API-Football). They auto-apply when relevant or run as `/name`.
- `.claude/agents/reviewer` is a read-only checker — run it after a feature and before a PR.
- These files are committed so every collaborator's Claude Code inherits the same rules.

## Current status

**The tournament is live.** Group stage began June 11, 2026. The app is deployed and users are active.

| Day | Theme | Status |
|-----|-------|--------|
| 1 | Foundation — scaffold, schema, i18n, Supabase linked | ✅ Done (commit 8daa703) |
| 2 | Data sync — Edge Function + cron → teams, players, fixtures | ✅ Done |
| 3 | Betting — fixtures list, place/edit match bets, lock RPC | ✅ Done |
| 4 | Scoring — finished-fixture polling, idempotent points, admin config | ✅ Done |
| 5 | Leaderboard & outrights — realtime, pot total, champion/top-scorer bets | ✅ Done |
| 6 | Payments & admin — self-confirm, admin roster, registration lock | ✅ Done |
| 7 | Reminders, odds, polish — email reminders, odds display, full i18n pass | ✅ Done |
| 8 | Buffer — test, deploy to Vercel, onboard users | ✅ Done |

Registration and outright bets closed at first kickoff (2026-06-11). Match bets continue locking per fixture (kickoff − 5 min) throughout the tournament. The tournament runs through 2026-07-19.

## Post-launch notes

- **Scoring cadence:** the `score-fixtures` Edge Function runs every 5 minutes via `pg_cron`. Outright bets (champion/top scorer) require manual admin trigger after the final.
- **Fixture sync:** knockout fixtures upsert progressively as the bracket resolves — the sync does not assume the full schedule exists up front.
- **API quota:** API-Football free tier is 100 req/day. The sync job is throttled; do not add ad-hoc calls without checking quota headroom.
- **Email provider:** Brevo (formerly Sendinblue), not Resend. Set `BREVO_API_KEY` and `EMAIL_FROM` in Supabase secrets.

**One non-obvious constraint from Day 1:** `lock_at` is trigger-computed (not a generated column — Postgres 17 rejects timestamptz arithmetic there). The sync job must write `kickoff_at` only; never write `lock_at` directly.
