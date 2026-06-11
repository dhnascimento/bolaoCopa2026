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
