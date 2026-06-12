# Bolão Copa 2026

A private betting-pool web app for the FIFA World Cup 2026 (June 11 – July 19, 2026). Tracks predictions, scores them automatically, and shows a live leaderboard and pot total. Does **not** move money.

Designed for a closed group of ≤100 users.

## Features

- **Match bets** — predict the score of every game; bets lock 5 minutes before kickoff
- **Outright bets** — pick the champion and top scorer; locked at first kickoff
- **Auto-scoring** — points computed idempotently every 5 minutes from live results
- **Live leaderboard** — real-time updates via Supabase Realtime; tiebreakers built in
- **Pot total** — entry fee × registered users, visible on the leaderboard
- **Pre-match odds** — 1/X/2 odds cached from API-Football, shown per fixture
- **Email reminders** — sent to users who haven't placed a bet before lock
- **Payment tracking** — self-confirm + admin override; no money moves through the app
- **Admin area** — manage results, scoring config, payment roster, user invites
- **Bilingual** — Portuguese (pt-BR, default) and English

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron) |
| i18n | next-intl — `pt-BR` (default) and `en` |
| Football data | API-Football (api-sports.io) — `league=1`, `season=2026` |
| Email | Brevo (formerly Sendinblue) |
| Deploy | Vercel (frontend) + Supabase (backend) |

## Getting started

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project (free tier is enough)
- An [API-Football](https://www.api-sports.io/) key
- A [Brevo](https://brevo.com) account (free tier: 300 emails/day)

### 1. Clone and install

```bash
git clone https://github.com/dhnascimento/bolaocopa2026.git
cd bolaocopa2026
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — **server-only, never expose to client** |
| `API_FOOTBALL_KEY` | API-Football key (free: 100 req/day) |
| `BREVO_API_KEY` | Brevo API key for email reminders |
| `EMAIL_FROM` | Verified sender address, e.g. `Bolão Copa 2026 <you@example.com>` |
| `APP_URL` | Public app URL (used in reminder email links) |
| `CRON_SECRET` | Random secret shared between pg_cron and Edge Functions |

Set the server-only secrets in Supabase as well:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<value>
supabase secrets set API_FOOTBALL_KEY=<value>
supabase secrets set BREVO_API_KEY=<value>
supabase secrets set EMAIL_FROM="Bolão Copa 2026 <you@example.com>"
supabase secrets set APP_URL=https://yourdomain.com
supabase secrets set CRON_SECRET=<random-value>
```

### 3. Apply the database schema

```bash
supabase link --project-ref <your-project-ref>
supabase db push
npm run db:types
```

### 4. Make yourself an admin

After signing up for the first time, run in the Supabase SQL editor:

```sql
update public.profiles set is_admin = true where id = '<your-uuid>';
```

### 5. Set the registration lock

```sql
-- Adjust to the real first-match kickoff in UTC
update public.settings set registration_locked_at = '2026-06-11T16:00:00Z';
```

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint       # eslint (add -- --fix to auto-fix)
npm run typecheck  # tsc --noEmit
npm test           # test suite
npm run db:types   # regenerate Supabase TypeScript types → lib/database.types.ts
```

## Project structure

```
app/
  [locale]/
    fixtures/        # match list + bet placement
    leaderboard/     # live leaderboard + pot total
    outrights/       # champion & top-scorer bets
    rules/           # scoring rules page
    profile/         # locale setting, payment self-confirm
    admin/
      results/       # enter match results
      scoring/       # scoring config
      roster/        # payment status + invite users
    auth/            # sign-in, callback, confirm
components/
  fixtures/          # LockCountdown, PaymentBanner
  outrights/         # OutrightBetsForm
  admin/             # AdminNav, forms
  ui/                # shadcn/ui primitives
lib/
  supabase/
    client.ts        # browser client (RLS-governed)
    server.ts        # server client (RLS-governed)
    admin.ts         # service-role client (server-only)
  bets/              # match + outright bet actions
  football/          # API-Football client
  payment/           # payment confirmation actions
supabase/
  migrations/        # all schema changes in order
  functions/
    score-fixtures/  # scoring engine (called by pg_cron)
    send-reminders/  # email reminder job (called by pg_cron)
messages/
  pt-BR.json         # Portuguese strings (default)
  en.json            # English strings
docs/
  SPEC.md            # full product spec and build plan
```

## Scoring

All values are admin-configurable at runtime. Defaults:

| Event | Points |
|---|---|
| Correct result (win/draw/loss) | 3 |
| Exact score (stacked with result) | 3 + 5 = **8** |
| Correct champion | **15** |
| Correct top scorer | **15** |

Only the regulation (90-minute) result counts. Extra time and penalties don't affect scoring.

**Tiebreaker order:** total points → most exact-score hits → most correct results → shared rank.

## Deployment

The app is designed to deploy on **Vercel** (frontend) + **Supabase** (backend). Both free tiers handle ≤100 users without issue.

1. Push to GitHub and connect the repo in [Vercel](https://vercel.com).
2. Set all `NEXT_PUBLIC_*` and server-side env vars in the Vercel dashboard.
3. Supabase Edge Functions deploy via `supabase functions deploy`.
4. `pg_cron` jobs are installed by the migrations — no manual setup needed.

## Key invariants

1. **Bet privacy** — other users' bets are hidden until the fixture locks (enforced in RLS, not just the UI).
2. **Server-authoritative locks** — every bet write validates against `lock_at` server-side; client clocks are never trusted.
3. **Idempotent scoring** — points are computed by assignment (`points = f(...)`), never incremented; re-running never double-counts.
4. **Bilingual** — every user-facing string exists in both `pt-BR` and `en`.
5. **UTC in DB, local time on screen** — `lock_at` and `kickoff_at` are stored in UTC; the UI renders in the user's local time zone.
6. **Service-role key is server-only** — never import `lib/supabase/admin.ts` from client components.
