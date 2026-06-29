# LLM bot participants

A way to enter LLM models (Claude, GPT, Gemini, …) into the pool as ordinary participants —
on the leaderboard, scored automatically — without creating each one through the GUI.

Bots are tagged with `profiles.is_bot = true` (migration `0017_profiles_is_bot.sql`). They
compete normally but are **excluded from the money pot** and shown with a 🤖 badge.

## Workflow

1. **Once:** apply migration `0017`, then run [`01-create-bots.sql`](01-create-bots.sql) in
   the Supabase SQL editor to manufacture the bot users. Edit the model list inside it first.
2. **Each prediction round:** run [`02-fixtures-menu.sql`](02-fixtures-menu.sql) and copy its
   three result sets.
3. **Per model:** fill those into [`03-prompt-template.md`](03-prompt-template.md), paste it
   into the model, and run the SQL it returns. The output upserts, so it's safe to re-run and
   models may revise picks before kickoff.

Everything runs as `postgres` in the SQL editor, which bypasses RLS and the bet locks — so
no per-bot login is needed. The fixtures menu is still filtered to unlocked matches so bots
play by the same fairness rule as humans.

## Automated generation (knockout rounds)

Steps 2–3 are automated by [`scripts/gen-bot-prompts.mjs`](../../scripts/gen-bot-prompts.mjs)
for the knockout stage. It reads the live, still-open knockout fixtures (`now() < lock_at`)
and writes one **match-only** prompt file per bot:

```bash
npm run bot-prompts            # all currently-open knockout fixtures
npm run bot-prompts -- r16     # only one stage (r32 | r16 | qf | sf | 3rd | final)
```

Output: `docs/llm-bots/prompt-<round>-<slug>.md` (gitignored). Knockout rounds are match-only
by design — champion/top-scorer outrights closed at first kickoff and are locked, so the
generator never emits outright SQL. It reads `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. Then paste each file into its model and run the
returned SQL, exactly as in step 3. For **Claude Opus 4.8** you can paste its prompt into
Claude, or ask Claude to fill the SQL directly.
