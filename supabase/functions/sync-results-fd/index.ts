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
  homeTeam: { id: number; name: string }
  awayTeam: { id: number; name: string }
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
  for (const f of fixtures ?? []) {
    if (f.home_team_id == null || f.away_team_id == null) continue
    fixtureByPair.set(pairKey(f.home_team_id as number, f.away_team_id as number), {
      id: f.id as number,
      home: f.home_team_id as number,
      away: f.away_team_id as number,
      fd: f.fd_match_id as number | null,
    })
    if (f.fd_match_id != null) stats.total_mapped++
  }

  const unresolved = new Set<string>()

  // ── 3. Map + update ──────────────────────────────────────────────────────
  for (const m of matches) {
    const homeId = teamByName.get(canonical(m.homeTeam.name))
    const awayId = teamByName.get(canonical(m.awayTeam.name))

    if (!homeId || !awayId) {
      if (!homeId) unresolved.add(m.homeTeam.name)
      if (!awayId) unresolved.add(m.awayTeam.name)
      stats.unmatched_fd.push({
        date: m.utcDate.slice(0, 10),
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        stage: m.stage,
      })
      continue
    }

    const fixture = fixtureByPair.get(pairKey(homeId, awayId))
    if (!fixture) {
      // No DB fixture for this pair (e.g. knockout matches not seeded yet).
      stats.unmatched_fd.push({
        date: m.utcDate.slice(0, 10),
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        stage: m.stage,
      })
      continue
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
