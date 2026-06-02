-- 0001_init.sql — Bolão World Cup 2026 initial schema
--
-- Invariants enforced in this file:
--   * Bet privacy  — other users' bets are unreadable until their lock time.
--   * Server locks — bet writes are gated on now() vs lock_at in the policy itself.
--   * Points safety — only the scorer (service role) or an admin can set points_awarded.
--   * Registration — no new users once settings.registration_locked_at has passed.
--
-- The sync + scoring jobs use the service-role key, which bypasses RLS; they do
-- not need permissive policies. RLS exists to constrain ordinary users.

create extension if not exists pgcrypto;

-- ──────────────────────────────────────────────────────────────────────────
-- Settings (singleton row)
-- ──────────────────────────────────────────────────────────────────────────
create table public.settings (
  id                        int primary key default 1 check (id = 1),
  entry_fee                 numeric(10,2) not null default 0,
  currency                  text not null default 'BRL',
  pct_first                 int not null default 70,
  pct_second                int not null default 20,
  pct_third                 int not null default 10,
  registration_locked_at    timestamptz,            -- null = registration open
  points_correct_result     int not null default 3,
  points_exact_score_bonus  int not null default 5,
  points_correct_champion   int not null default 15,
  points_correct_top_scorer int not null default 15,
  updated_at                timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- Profiles (1:1 with auth.users)
-- ──────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  display_name              text not null,
  locale                    text not null default 'pt-BR' check (locale in ('pt-BR','en')),
  is_admin                  boolean not null default false,
  payment_self_confirmed_at timestamptz,
  payment_admin_status      text not null default 'unpaid' check (payment_admin_status in ('unpaid','confirmed')),
  payment_confirmed_by      uuid references public.profiles(id),
  created_at                timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- Reference data (synced from API-Football; written by service role)
-- ──────────────────────────────────────────────────────────────────────────
create table public.teams (
  id          bigint generated always as identity primary key,
  api_team_id bigint unique not null,
  name        text not null,
  flag_url    text
);

create table public.players (
  id            bigint generated always as identity primary key,
  api_player_id bigint unique not null,
  name          text not null,
  team_id       bigint references public.teams(id)
);

create table public.fixtures (
  id              bigint generated always as identity primary key,
  api_fixture_id  bigint unique not null,
  stage           text not null,                  -- group | r32 | r16 | qf | sf | final
  home_team_id    bigint references public.teams(id),
  away_team_id    bigint references public.teams(id),
  kickoff_at      timestamptz not null,
  -- lock_at = kickoff_at − 5 min; kept in sync by trg_fixtures_lock_at below.
  -- Generated columns don't support timestamptz arithmetic in Postgres 17, so we
  -- use a BEFORE trigger instead — same immutability guarantee, wider compatibility.
  lock_at         timestamptz not null,
  status          text not null default 'scheduled',  -- scheduled | live | finished
  home_score      int,
  away_score      int,
  regulation_home int,                            -- 90-min score used for scoring
  regulation_away int,
  finished_at     timestamptz,
  odds_home       numeric(6,2),
  odds_draw       numeric(6,2),
  odds_away       numeric(6,2),
  odds_fetched_at timestamptz,
  reminder_sent_at timestamptz
);
create index on public.fixtures (kickoff_at);
create index on public.fixtures (status);

-- lock_at trigger: keeps lock_at = kickoff_at − 5 min on every write.
-- Fires on all INSERTs and on UPDATEs so the value never drifts.
create or replace function public.compute_fixture_lock_at()
returns trigger language plpgsql as $$
begin
  new.lock_at := new.kickoff_at - interval '5 minutes';
  return new;
end;
$$;
create trigger trg_fixtures_lock_at
  before insert or update on public.fixtures
  for each row execute function public.compute_fixture_lock_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Bets
-- ──────────────────────────────────────────────────────────────────────────
create table public.match_bets (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  fixture_id     bigint not null references public.fixtures(id) on delete cascade,
  predicted_home int not null check (predicted_home >= 0),
  predicted_away int not null check (predicted_away >= 0),
  points_awarded int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, fixture_id)
);

create table public.outright_bets (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  bet_type           text not null check (bet_type in ('champion','top_scorer')),
  predicted_team_id  bigint references public.teams(id),
  predicted_player_id bigint references public.players(id),
  points_awarded     int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, bet_type),
  check (
    (bet_type = 'champion'   and predicted_team_id   is not null and predicted_player_id is null) or
    (bet_type = 'top_scorer' and predicted_player_id is not null and predicted_team_id   is null)
  )
);

-- ──────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER → bypass RLS to avoid recursion)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.registration_locked()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(
    (select s.registration_locked_at is not null and now() >= s.registration_locked_at
       from public.settings s where s.id = 1),
    false);
$$;

-- New auth users get a profile — and are rejected once registration has closed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.registration_locked() then
    raise exception 'Registration is closed for this pool';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may not set their own points; service role (auth.uid() null) and admins may.
create or replace function public.prevent_points_tampering()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.points_awarded is distinct from old.points_awarded then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'points_awarded may not be modified by users';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_match_bets_points    before update on public.match_bets
  for each row execute function public.prevent_points_tampering();
create trigger trg_outright_bets_points before update on public.outright_bets
  for each row execute function public.prevent_points_tampering();

-- Users may not grant themselves admin or alter admin-controlled payment fields.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.is_admin             is distinct from old.is_admin
    or new.payment_admin_status is distinct from old.payment_admin_status
    or new.payment_confirmed_by is distinct from old.payment_confirmed_by then
      raise exception 'protected profile columns may only be changed by an admin';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ──────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ──────────────────────────────────────────────────────────────────────────
alter table public.settings      enable row level security;
alter table public.profiles      enable row level security;
alter table public.teams         enable row level security;
alter table public.players       enable row level security;
alter table public.fixtures      enable row level security;
alter table public.match_bets    enable row level security;
alter table public.outright_bets enable row level security;

-- Settings: everyone reads; only admins change.
create policy settings_select on public.settings for select to authenticated using (true);
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles: everyone in the pool can read profiles (needed for the leaderboard);
-- a user updates their own row, an admin updates anyone. Column protection is by trigger.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Reference data: read by all; written only by admins (service role bypasses RLS for sync).
create policy teams_select    on public.teams    for select to authenticated using (true);
create policy teams_write     on public.teams    for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy players_select  on public.players  for select to authenticated using (true);
create policy players_write   on public.players  for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy fixtures_select on public.fixtures for select to authenticated using (true);
create policy fixtures_write  on public.fixtures for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Match bets — THE privacy + lock rules.
-- Read: own bets anytime; others' bets only once that fixture has locked.
create policy match_bets_select on public.match_bets for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.fixtures f where f.id = fixture_id and now() >= f.lock_at)
  );
-- Insert: only your own, and only before the fixture locks.
create policy match_bets_insert on public.match_bets for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.fixtures f where f.id = fixture_id and now() < f.lock_at)
  );
-- Update: only your own, and only before the fixture locks.
create policy match_bets_update on public.match_bets for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.fixtures f where f.id = fixture_id and now() < f.lock_at)
  );

-- Outright bets — lock at registration close (first kickoff).
create policy outright_select on public.outright_bets for select to authenticated
  using (user_id = auth.uid() or public.registration_locked());
create policy outright_insert on public.outright_bets for insert to authenticated
  with check (user_id = auth.uid() and not public.registration_locked());
create policy outright_update on public.outright_bets for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.registration_locked());

-- ──────────────────────────────────────────────────────────────────────────
-- Leaderboard view
-- security_invoker → RLS of underlying tables applies. This is safe: points are
-- only awarded to finished (hence already-locked, hence visible) fixtures, so
-- totals are complete while unlocked predictions stay private.
-- ──────────────────────────────────────────────────────────────────────────
create view public.leaderboard with (security_invoker = true) as
with match_pts as (
  select
    mb.user_id,
    sum(mb.points_awarded) as pts,
    count(*) filter (
      where f.status = 'finished'
        and mb.predicted_home = f.regulation_home
        and mb.predicted_away = f.regulation_away
    ) as exact_hits,
    count(*) filter (
      where f.status = 'finished'
        and sign(mb.predicted_home - mb.predicted_away) = sign(f.regulation_home - f.regulation_away)
    ) as correct_results
  from public.match_bets mb
  join public.fixtures f on f.id = mb.fixture_id
  group by mb.user_id
),
outright_pts as (
  select user_id, sum(points_awarded) as pts
  from public.outright_bets
  group by user_id
)
select
  p.id          as user_id,
  p.display_name,
  coalesce(mp.pts, 0) + coalesce(op.pts, 0) as points,
  coalesce(mp.exact_hits, 0)      as exact_hits,
  coalesce(mp.correct_results, 0) as correct_results
from public.profiles p
left join match_pts   mp on mp.user_id = p.id
left join outright_pts op on op.user_id = p.id
order by points desc, exact_hits desc, correct_results desc;

-- ──────────────────────────────────────────────────────────────────────────
-- Realtime (drives the live leaderboard; a few-minute delay is acceptable)
-- ──────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.fixtures;
alter publication supabase_realtime add table public.match_bets;
