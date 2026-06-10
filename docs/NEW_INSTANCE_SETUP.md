# Spinning up a second pool (new instance)

Each pool is a **fully independent instance** of the same codebase: its own Supabase
project (database), its own Vercel deployment, and its own domain. Code is shared — push
to this repo and both deployments update — while data is completely isolated.

Thanks to two portability changes, no source edits are needed per instance:

- The cron jobs read their Edge Function URL from a database setting
  (`app.functions_base_url`) instead of a hard-coded project ref.
- The pool's display name lives in `settings.pool_name` (admin-editable), falling back to
  the localized default when blank.

> The Supabase CLI is linked to **one** project at a time. When working on instance #2,
> run `npx supabase link --project-ref <new-ref>`; relink to the original when you're done.

---

## 1. Create the Supabase project
1. supabase.com → **New project**. Note the **project ref** (the `xxxx` in
   `https://xxxx.supabase.co`), the **anon** key and the **service-role** key
   (Project Settings → API).

## 2. Apply the schema
```bash
npx supabase link --project-ref <new-ref>
npx supabase db push          # applies every migration 0001 → 0013
```

## 3. Database settings (Supabase → SQL Editor)
Run once, substituting the new ref and a fresh random secret:
```sql
-- Point cron at THIS project's Edge Functions
alter database postgres
  set app.functions_base_url = 'https://<new-ref>.supabase.co/functions/v1';

-- Cron secret, two ways (this codebase uses both): keep them identical
alter database postgres set app.cron_secret = '<random-32-char-secret>';   -- score/reminders
select vault.create_secret('<random-32-char-secret>', 'cron_secret');       -- sync-fixtures
```
> Use the **same** secret value for the `CRON_SECRET` Edge Function secret in step 4.

## 4. Edge Functions (secrets + deploy)
```bash
npx supabase secrets set CRON_SECRET=<same-random-secret> API_FOOTBALL_KEY=<your-key>
npx supabase functions deploy sync-fixtures
npx supabase functions deploy score-fixtures
# send-reminders is optional and currently disabled (email rate limits) — skip unless you wire SMTP
```

## 5. Auth configuration (Supabase dashboard → Authentication → URL Configuration)
- **Site URL:** your new production domain.
- **Redirect URLs:** add `https://<new-domain>/**` and `http://localhost:3000/**`
  (the latter so local sign-in stays local).
- If using Google sign-in: **Providers → Google →** paste a Client ID/Secret
  (create credentials in Google Cloud Console, redirect URI
  `https://<new-ref>.supabase.co/auth/v1/callback`). The shareable-link invites work
  without this; Google is just a convenience for repeat logins.

## 6. Reference data (teams / players / fixtures) — important
The API-Football **free plan does not cover season 2026**, so `sync-fixtures` returns an
empty set and can't populate matches. Copy the reference tables from your existing project:
```bash
# Dump just the reference data from instance #1
pg_dump "<INSTANCE_1_DB_URL>" --data-only --no-owner \
  -t public.teams -t public.players -t public.fixtures > refdata.sql

# Load into instance #2
psql "<INSTANCE_2_DB_URL>" -f refdata.sql
```
(DB connection strings: Project Settings → Database → Connection string.)
Then re-apply the group labels (migration `0010` is a no-op until fixtures exist), by
running the `UPDATE` block from `supabase/migrations/0010_seed_fixture_groups.sql` in the
SQL editor. Verify: `select group_label, count(*) from fixtures group by 1 order by 1;`
should show A–L with 6 each.

> If you instead have a **paid** API-Football plan that covers 2026, you can skip the copy
> and just invoke `sync-fixtures` (then run the 0010 seed).

## 7. Deploy the app (Vercel)
1. New Vercel project from **this same repo** (so code changes deploy to both).
2. Environment variables (see `.env.example` for the full list; the app runtime needs):
   - `NEXT_PUBLIC_SUPABASE_URL = https://<new-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY = <new anon key>`
   - `SUPABASE_SERVICE_ROLE_KEY = <new service-role key>`
3. Assign the new domain to this Vercel project.

## 8. First-run setup
1. Open the app, sign in once (Google, or invite yourself — but you can't invite before an
   admin exists, so for the very first user sign in with Google or insert a user manually).
2. Make yourself admin (SQL editor):
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = '<your-email>');
   ```
3. **Admin → Scoring**: set the **Pool name** (e.g. "Bolão dos Amigos"), the entry fee,
   currency, and point values. The name now drives the navbar, landing page, and tab title.
4. Invite participants via **Admin → Roster → Create invite link** and share over WhatsApp.

---

## Per-instance checklist
| Item | Where | Notes |
|---|---|---|
| Migrations applied | `db push` | all of 0001–0013 |
| `app.functions_base_url` | SQL editor | this project's function URL |
| `app.cron_secret` + Vault `cron_secret` | SQL editor | same value as `CRON_SECRET` |
| `CRON_SECRET`, `API_FOOTBALL_KEY` | `supabase secrets set` | Edge Function secrets |
| Functions deployed | `functions deploy` | sync-fixtures, score-fixtures |
| Auth Site URL + redirect allowlist | dashboard | new domain + localhost |
| Reference data | pg_dump/psql | teams/players/fixtures + 0010 seed |
| Supabase keys | Vercel env | URL + anon + service-role |
| Domain | Vercel | mapped to the new project |
| Pool name | Admin → Scoring | per-instance branding |

## Ongoing
- **Code changes:** push to this repo → both Vercel projects rebuild automatically.
- **New migrations:** must be applied to **each** project — `supabase link --project-ref <ref>`
  then `db push`, for every instance.
- **API-Football quota** is per project/key — each instance consumes its own daily quota.

## Optional: also set `app.functions_base_url` on the original project
Not required (it falls back to the original URL when unset), but for symmetry you can run the
`alter database postgres set app.functions_base_url = …` on the existing project too.
