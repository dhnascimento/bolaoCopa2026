// Edge Function: sync-results-fd
//
// Results source = football-data.org (free tier includes the World Cup), used
// because the API-Football account is suspended. This fetches WC matches, maps
// them onto the EXISTING fixtures (seeded with API-Football ids/names) by team
// pair, stores the football-data match id, writes the 90-minute regulation
// score for FINISHED matches, then re-scores idempotently.
//
// Match-onto-existing (never reseed) so nobody's match_bets are orphaned.
//
// Required env: FOOTBALL_DATA_TOKEN. Optional CRON_SECRET (same pattern as the
// other functions).

import { createClient } from 'npm:@supabase/supabase-js@2'

const FD_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'

// ── Types (football-data v4) ───────────────────────────────────────────────
interface FdMatch {
  id: number
  utcDate: string
  status: string // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage: string
  group: string | null
  homeTeam: { id: number | null; name: string | null }
  awayTeam: { id: number | null; name: string | null }
  score: {
    duration: string // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime: { home: number | null; away: number | null }
  }
}

// ── Name normalisation + provider aliases ───────────────────────────────────
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accent marks
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Maps a normalised football-data name → the normalised DB (API-Football) name.
// Extend this if the report surfaces unresolved names.
const ALIASES: Record<string, string> = {
  'united states': 'usa',
  turkey: 'turkiye',
  czechia: 'czech republic',
  'cape verde': 'cape verde islands',
  'dr congo': 'congo dr',
  'congo dr': 'congo dr',
  'korea republic': 'south korea',
  'cote d ivoire': 'ivory coast',
  'cote divoire': 'ivory coast',
  'bosnia and herzegovina': 'bosnia herzegovina',
}

function canonical(name: string): string {
  const n = normalize(name)
  return ALIASES[n] ?? n
}

// ── Stage + status mapping (football-data → project codes) ──────────────────
// Maps a football-data stage string to this project's stage codes (see
// lib/fixtures/stages.ts). Group stage is handled by the API-Football seed; we
// only ever insert knockout stages from here.
function mapStage(stage: string): string {
  switch (stage) {
    case 'LAST_32':
      return 'r32'
    case 'LAST_16':
      return 'r16'
    case 'QUARTER_FINALS':
      return 'qf'
    case 'SEMI_FINALS':
      return 'sf'
    case 'THIRD_PLACE':
      return '3rd'
    case 'FINAL':
      return 'final'
    default:
      return 'group'
  }
}

type FixtureStatus = 'scheduled' | 'live' | 'finished'

function mapStatus(status: string): FixtureStatus {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live'
  if (status === 'FINISHED') return 'finished'
  return 'scheduled' // SCHEDULED | TIMED | POSTPONED | ...
}

// Synthetic api_fixture_id for FD-seeded knockout fixtures. The column is a
// UNIQUE NOT NULL bigint normally holding API-Football ids (≤ ~7 digits). The
// offset keeps these clearly outside that range and collision-free, and is
// deterministic so re-runs map to the same row.
const FD_FIXTURE_ID_OFFSET = 9_000_000_000


// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const provided = req.headers.get('x-cron-secret')
    const authHeader = req.headers.get('authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const hasValidJwt = serviceKey && authHeader === `Bearer ${serviceKey}`
    if (provided !== cronSecret && !hasValidJwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const token = Deno.env.get('FOOTBALL_DATA_TOKEN')
  if (!token) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'FOOTBALL_DATA_TOKEN not configured' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  const stats = {
    seeded: 0,
    newly_mapped: 0,
    total_mapped: 0,
    updated: 0,
    scored: 0 as number | null,
    skipped_non_regular: 0,
    unmatched_fd: [] as Array<{ date: string; home: string; away: string; stage: string }>,
    unresolved_team_names: [] as string[],
    errors: [] as string[],
  }

  // ── 1. Fetch all WC matches (1 request) ──────────────────────────────────
  let matches: FdMatch[] = []
  try {
    const res = await fetch(`${FD_BASE}/competitions/${COMPETITION}/matches`, {
      headers: { 'X-Auth-Token': token },
    })
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `football-data ${res.status}: ${await res.text()}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const json = (await res.json()) as { matches?: FdMatch[] }
    matches = json.matches ?? []
  } catch (e) {
    return new Response(JSON.stringify({ error: `fetch failed: ${String(e)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Load DB teams + fixtures ──────────────────────────────────────────
  const { data: teams } = await db.from('teams').select('id, name')
  const teamByName = new Map<string, number>()
  for (const t of teams ?? []) teamByName.set(canonical(t.name as string), t.id as number)

  const { data: fixtures } = await db
    .from('fixtures')
    .select('id, home_team_id, away_team_id, fd_match_id')

  // Index fixtures by unordered team-id pair (each pair is unique in the group stage).
  const pairKey = (a: number, b: number) => [a, b].sort((x, y) => x - y).join('-')
  const fixtureByPair = new Map<string, { id: number; home: number; away: number; fd: number | null }>()
  // Existing fd_match_ids — the idempotency key for knockout seeding (a pair can
  // recur across stages, so we must not key inserts on the team pair alone).
  const seededFdIds = new Set<number>()
  for (const f of fixtures ?? []) {
    if (f.fd_match_id != null) {
      seededFdIds.add(f.fd_match_id as number)
      stats.total_mapped++
    }
    if (f.home_team_id == null || f.away_team_id == null) continue
    fixtureByPair.set(pairKey(f.home_team_id as number, f.away_team_id as number), {
      id: f.id as number,
      home: f.home_team_id as number,
      away: f.away_team_id as number,
      fd: f.fd_match_id as number | null,
    })
  }

  const unresolved = new Set<string>()

  // ── 3. Map + update ──────────────────────────────────────────────────────
  for (const m of matches) {
    const homeName = m.homeTeam?.name
    const awayName = m.awayTeam?.name

    // Knockout placeholders have null team names until the bracket fills in.
    if (!homeName || !awayName) {
      stats.unmatched_fd.push({
        date: m.utcDate.slice(0, 10),
        home: homeName ?? 'TBD',
        away: awayName ?? 'TBD',
        stage: m.stage,
      })
      continue
    }

    const homeId = teamByName.get(canonical(homeName))
    const awayId = teamByName.get(canonical(awayName))

    if (!homeId || !awayId) {
      if (!homeId) unresolved.add(homeName)
      if (!awayId) unresolved.add(awayName)
      stats.unmatched_fd.push({
        date: m.utcDate.slice(0, 10),
        home: homeName,
        away: awayName,
        stage: m.stage,
      })
      continue
    }

    let fixture = fixtureByPair.get(pairKey(homeId, awayId))
    if (!fixture) {
      const stage = mapStage(m.stage)

      // Group fixtures are seeded by API-Football; never duplicate them here.
      // Already-seeded knockout matches (by fd id) are skipped — their fixture
      // should resolve via the pair lookup once present.
      if (stage === 'group' || seededFdIds.has(m.id)) {
        stats.unmatched_fd.push({
          date: m.utcDate.slice(0, 10),
          home: m.homeTeam.name,
          away: m.awayTeam.name,
          stage: m.stage,
        })
        continue
      }

      // Seed the knockout fixture so participants can bet it. The
      // trg_fixtures_lock_at BEFORE trigger recomputes lock_at; we supply a
      // value only to satisfy the NOT NULL constraint.
      const kickoffAt = m.utcDate
      const lockAt = new Date(
        new Date(kickoffAt).getTime() - 5 * 60 * 1000,
      ).toISOString()

      const { data: inserted, error: seedErr } = await db
        .from('fixtures')
        .insert({
          api_fixture_id: FD_FIXTURE_ID_OFFSET + m.id,
          stage,
          group_label: null,
          home_team_id: homeId,
          away_team_id: awayId,
          kickoff_at: kickoffAt,
          lock_at: lockAt,
          status: mapStatus(m.status),
          fd_match_id: m.id,
        })
        .select('id')
        .single()

      if (seedErr || !inserted) {
        stats.errors.push(`seed fd ${m.id}: ${seedErr?.message ?? 'no row'}`)
        continue
      }

      seededFdIds.add(m.id)
      fixture = { id: inserted.id as number, home: homeId, away: awayId, fd: m.id }
      fixtureByPair.set(pairKey(homeId, awayId), fixture)
      stats.seeded++
      // Fall through: if this match is already FINISHED, the block below writes
      // its result in the same pass.
    }

    // Persist the fd match id on first sight.
    if (fixture.fd === null) {
      const { error } = await db
        .from('fixtures')
        .update({ fd_match_id: m.id })
        .eq('id', fixture.id)
      if (error) stats.errors.push(`map ${fixture.id}: ${error.message}`)
      else {
        fixture.fd = m.id
        stats.newly_mapped++
        stats.total_mapped++
      }
    }

    // Write the result only for finished, regulation-time matches (the 90-min
    // rule). ET / penalty knockouts are left for manual entry.
    if (m.status === 'FINISHED') {
      if (m.score.duration !== 'REGULAR') {
        stats.skipped_non_regular++
        continue
      }
      const fdHome = m.score.fullTime.home
      const fdAway = m.score.fullTime.away
      if (fdHome == null || fdAway == null) continue

      // Align scores to the DB fixture's home/away orientation.
      const sameOrientation = fixture.home === homeId
      const regHome = sameOrientation ? fdHome : fdAway
      const regAway = sameOrientation ? fdAway : fdHome

      const { error } = await db
        .from('fixtures')
        .update({
          status: 'finished',
          regulation_home: regHome,
          regulation_away: regAway,
          home_score: regHome,
          away_score: regAway,
          finished_at: new Date().toISOString(),
        })
        .eq('id', fixture.id)
      if (error) stats.errors.push(`update ${fixture.id}: ${error.message}`)
      else stats.updated++
    }
  }

  stats.unresolved_team_names = Array.from(unresolved)

  // ── 4. Re-score (idempotent) ─────────────────────────────────────────────
  const { data: scored, error: scoreErr } = await db.rpc('score_match_bets')
  if (scoreErr) stats.errors.push(`score_match_bets: ${scoreErr.message}`)
  else stats.scored = scored

  const statusCode = stats.errors.length > 0 ? 207 : 200
  return new Response(JSON.stringify(stats), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  })
})
