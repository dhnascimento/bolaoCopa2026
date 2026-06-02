---
name: supabase-migration
description: Use when creating or changing database tables, columns, or Row-Level Security (RLS) policies. Covers migration file conventions, the bet-privacy RLS rules, and regenerating TypeScript types.
---

# Supabase migration workflow

1. Create `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`. Never edit an applied migration — add a new one.
2. Enable RLS on every new table: `alter table <t> enable row level security;`. A table with no policies denies all access by default — that is intended; add explicit policies.
3. RLS is the security boundary, not the UI. For any table holding bets, enforce the privacy invariant:
   - Owners may always select/insert/update their own rows (before lock for writes).
   - Other users may select a bet row only once its lock time has passed.
   The canonical pattern is in `0001_init.sql` (`match_bets`, `outright_bets`). Copy it; do not reinvent.
4. Write policies gate bet writes on the server clock (`now() < f.lock_at`) so the database refuses early/late writes regardless of the client.
5. `points_awarded` is written only by the scorer (service role) or an admin. Keep the `prevent_points_tampering` trigger attached to any new bet table.
6. Apply: `npx supabase db push` (linked) or `npx supabase db reset` (local). Then regenerate types: `npm run db:types`. Commit the migration and the regenerated `lib/database.types.ts` together.

## Checklist
- [ ] RLS enabled on every new table
- [ ] Bet tables hide other users' rows until lock
- [ ] Write policies enforce the lock window server-side
- [ ] points_awarded protected from user writes
- [ ] Types regenerated and committed
