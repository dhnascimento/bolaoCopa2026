# Day 1 setup

Goal by end of day: app boots, auth works, the migration + RLS are applied, both
locales render, and one real API-Football call is validated. Claude Code can drive
all of this — point it at CLAUDE.md first.

## 0. Validate the data source BEFORE building anything
Confirm API-Football returns 2026 World Cup data on your plan:

    curl -s "https://v3.football.api-sports.io/fixtures?league=1&season=2026" \
      -H "x-apisports-key: $API_FOOTBALL_KEY" | head

Then check an odds response for one fixture. If fixtures + odds don't come back
cleanly, stop and reassess the provider — everything else depends on this.

## 1. Scaffold Next.js (let the tool generate boilerplate)
    npx create-next-app@latest bolao --typescript --app --tailwind --eslint
    cd bolao

## 2. Dependencies
    npm i @supabase/supabase-js @supabase/ssr next-intl
    npm i -D supabase
    npx shadcn@latest init

## 3. Drop in the provided files
Copy from this starter into the new project:
    CLAUDE.md
    docs/SPEC.md
    .claude/                      (skills + reviewer agent)
    supabase/migrations/0001_init.sql
    lib/supabase/{client,server,admin}.ts
    i18n/{routing,request}.ts
    messages/{pt-BR,en}.json
    middleware.ts
    .env.example  ->  copy to .env.local and fill in

## 4. Apply the database
    npx supabase init
    npx supabase link --project-ref <your-ref>
    npx supabase db push
    npx supabase gen types typescript --linked > lib/database.types.ts

Wire `npm run db:types` to that last command in package.json.

## 5. Make yourself admin (after you first sign up)
    update public.profiles set is_admin = true where id = '<your-uuid>';

## 6. Set the lock once the schedule is confirmed
    update public.settings set registration_locked_at = '2026-06-11T16:00:00Z';
This closes new signups and locks outright bets at first kickoff. (Adjust to the
real first-match kickoff in UTC.)

## 7. First commit
Commit CLAUDE.md, docs/SPEC.md, .claude/, and the migration so every collaborator
who clones inherits the rules and workflows.
