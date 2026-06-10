// Edge Function: sync-fixtures
//
// Syncs teams, players (squads), and fixtures from API-Football into the DB.
// Called by the pg_cron job every 6 hours, and optionally by admins manually.
//
// Auth: if CRON_SECRET env var is set, callers must pass it as `x-cron-secret`.
//       Supabase service-role JWTs are always accepted.
//       With neither, calls are allowed (safe — this function only writes
//       public football reference data).
//
// Player sync: fetches 7 uncovered team squads per invocation to stay within
// the free-tier rate limit (10 req/min).  All 48 squads will be covered after
// several cron runs.

import { createClient } from 'npm:@supabase/supabase-js@2'

const LEAGUE = 1
const SEASON = 2026
const API_BASE = 'https://v3.football.api-sports.io'

// ── Type shapes (API-Football v3) ──────────────────────────────────────────

interface ApiTeamItem {
  team: { id: number; name: string; logo: string }
}

interface ApiFixtureItem {
  fixture: { id: number; date: string; status: { short: string } }
  league: { round: string }
  teams: { home: { id: number }; away: { id: number } }
  goals: { home: number | null; away: number | null }
  score: { fulltime: { home: number | null; away: number | null } }
}

interface ApiSquadItem {
  players: Array<{ id: number; name: string }>
}

interface ApiOddsItem {
  fixture: { id: number }
  bookmakers: Array<{
    bets: Array<{
      id: number
      values: Array<{ value: string; odd: string }>
    }>
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────

type FixtureStatus = 'scheduled' | 'live' | 'finished'

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

function mapStatus(short: string): FixtureStatus {
  if (LIVE_STATUSES.has(short)) return 'live'
  if (FINISHED_STATUSES.has(short)) return 'finished'
  return 'scheduled'
}

function mapStage(round: string): string {
  const r = round.toLowerCase()
  if (r.includes('group')) return 'group'
  if (r.includes('round of 32')) return 'r32'
  if (r.includes('round of 16')) return 'r16'
  if (r.includes('quarter')) return 'qf'
  if (r.includes('semi')) return 'sf'
  if (r.includes('3rd') || r.includes('third')) return '3rd'
  if (r.includes('final')) return 'final'
  return 'group'
}

// Extract the group letter from a round string like "Group A - 1" → "A".
// Returns null for non-group rounds (knockout stages have no group).
function parseGroup(round: string): string | null {
  const m = round.match(/group\s+([a-l])/i)
  return m ? m[1].toUpperCase() : null
}

async function apiFetch<T>(path: string, apiKey: string): Promise<{ response: T }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-apisports-key': apiKey,
    },
  })
  if (!res.ok) {
    throw new Error(`API-Football ${res.status} for ${path}: ${await res.text()}`)
  }
  return res.json()
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Optional protection: if CRON_SECRET is set, enforce it.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const providedSecret = req.headers.get('x-cron-secret')
    const authHeader = req.headers.get('authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const hasValidJwt = serviceKey && authHeader === `Bearer ${serviceKey}`

    if (providedSecret !== cronSecret && !hasValidJwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const apiKey = Deno.env.get('API_FOOTBALL_KEY')!

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const stats = {
    teams: 0,
    fixtures: 0,
    players: 0,
    players_skipped: false,
    odds_updated: 0,
    errors: [] as string[],
  }

  // ── 1. Teams ──────────────────────────────────────────────────────────────
  let teamItems: ApiTeamItem[] = []
  try {
    const res = await apiFetch<ApiTeamItem[]>(
      `/teams?league=${LEAGUE}&season=${SEASON}`,
      apiKey,
    )
    teamItems = res.response

    for (const { team } of teamItems) {
      const { error } = await db.from('teams').upsert(
        { api_team_id: team.id, name: team.name, flag_url: team.logo },
        { onConflict: 'api_team_id' },
      )
      if (error) stats.errors.push(`team ${team.id}: ${error.message}`)
      else stats.teams++
    }
  } catch (e) {
    stats.errors.push(`teams fetch: ${String(e)}`)
  }

  // Build api_team_id → internal id map (needed for fixture upserts)
  const { data: dbTeams } = await db.from('teams').select('id, api_team_id')
  const teamMap = new Map<number, number>(
    dbTeams?.map((t) => [t.api_team_id as number, t.id as number]) ?? [],
  )

  // ── 2. Fixtures ───────────────────────────────────────────────────────────
  try {
    const res = await apiFetch<ApiFixtureItem[]>(
      `/fixtures?league=${LEAGUE}&season=${SEASON}`,
      apiKey,
    )

    for (const item of res.response) {
      const homeId = teamMap.get(item.teams.home.id)
      const awayId = teamMap.get(item.teams.away.id)

      if (!homeId || !awayId) {
        stats.errors.push(`fixture ${item.fixture.id}: team not in DB yet`)
        continue
      }

      const status = mapStatus(item.fixture.status.short)
      const kickoffAt = item.fixture.date
      // Provide lock_at so the NOT NULL constraint is satisfied; the BEFORE
      // trigger trg_fixtures_lock_at will recompute it to kickoff_at − 5 min.
      const lockAt = new Date(
        new Date(kickoffAt).getTime() - 5 * 60 * 1000,
      ).toISOString()

      const stage = mapStage(item.league.round)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = {
        api_fixture_id: item.fixture.id,
        stage,
        group_label: stage === 'group' ? parseGroup(item.league.round) : null,
        home_team_id: homeId,
        away_team_id: awayId,
        kickoff_at: kickoffAt,
        lock_at: lockAt,
        status,
        home_score: item.goals.home,
        away_score: item.goals.away,
      }

      if (status === 'finished') {
        row.regulation_home = item.score.fulltime.home
        row.regulation_away = item.score.fulltime.away
        // finished_at: only set when first transitioning to finished
        row.finished_at = new Date().toISOString()
      }

      const { error } = await db
        .from('fixtures')
        .upsert(row, { onConflict: 'api_fixture_id' })

      if (error) stats.errors.push(`fixture ${item.fixture.id}: ${error.message}`)
      else stats.fixtures++
    }
  } catch (e) {
    stats.errors.push(`fixtures fetch: ${String(e)}`)
  }

  // ── 3. Players (squads) ───────────────────────────────────────────────────
  // Free tier: 10 req/min.  Teams + fixtures consume 2 slots, leaving 7 for
  // squad fetches.  We batch: find teams that have NO players yet, fetch up to
  // SQUADS_PER_RUN of them with a delay between requests.  Each cron run makes
  // progress until all 48 squads are covered.
  const SQUADS_PER_RUN = 7
  const SQUAD_DELAY_MS = 6500 // 6.5 s → ~9.2 req/min total, safely under 10

  try {
    // Find which internal team IDs already have at least one player.
    const { data: covered } = await db
      .from('players')
      .select('team_id')
      .not('team_id', 'is', null)

    const coveredIds = new Set((covered ?? []).map((r) => r.team_id as number))

    const pending = teamItems.filter(({ team }) => {
      const dbId = teamMap.get(team.id)
      return dbId !== undefined && !coveredIds.has(dbId)
    })

    if (pending.length === 0) {
      stats.players_skipped = true
    } else {
      const batch = pending.slice(0, SQUADS_PER_RUN)

      for (let i = 0; i < batch.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, SQUAD_DELAY_MS))

        const { team } = batch[i]
        const dbTeamId = teamMap.get(team.id)!

        try {
          const res = await apiFetch<ApiSquadItem[]>(
            `/players/squads?team=${team.id}`,
            apiKey,
          )
          for (const squad of res.response) {
            for (const player of squad.players) {
              const { error } = await db.from('players').upsert(
                { api_player_id: player.id, name: player.name, team_id: dbTeamId },
                { onConflict: 'api_player_id' },
              )
              if (error) stats.errors.push(`player ${player.id}: ${error.message}`)
              else stats.players++
            }
          }
        } catch (e) {
          stats.errors.push(`squad ${team.id}: ${String(e)}`)
        }
      }
    }
  } catch (e) {
    stats.errors.push(`players sync: ${String(e)}`)
  }

  // ── 4. Odds (pre-match, up to 5 fixtures per run) ─────────────────────────
  // Fetch Match Winner (bet type 1) odds for upcoming fixtures that haven't
  // had odds refreshed in the last 12 hours.  Stays within the free-tier
  // rate limit by batching at most 5 requests per invocation.
  const ODDS_PER_RUN = 5
  const ODDS_STALE_HOURS = 12

  try {
    const staleThreshold = new Date(
      Date.now() - ODDS_STALE_HOURS * 60 * 60 * 1000,
    ).toISOString()
    const nowIso = new Date().toISOString()

    // Find upcoming, not-yet-finished fixtures with stale or missing odds
    const { data: fixturesForOdds } = await db
      .from('fixtures')
      .select('id, api_fixture_id')
      .eq('status', 'scheduled')
      .gt('kickoff_at', nowIso)
      .or(`odds_fetched_at.is.null,odds_fetched_at.lt.${staleThreshold}`)
      .order('kickoff_at', { ascending: true })
      .limit(ODDS_PER_RUN)

    for (const fixture of fixturesForOdds ?? []) {
      try {
        const res = await apiFetch<ApiOddsItem[]>(
          `/odds?fixture=${fixture.api_fixture_id}&bookmaker=8`,
          apiKey,
        )

        const item = res.response[0]
        if (!item) continue

        // bookmaker 8 = Bet365; bet id 1 = Match Winner
        const matchWinnerBet = item.bookmakers[0]?.bets.find((b) => b.id === 1)
        if (!matchWinnerBet) continue

        const homeVal = matchWinnerBet.values.find((v) => v.value === 'Home')
        const drawVal = matchWinnerBet.values.find((v) => v.value === 'Draw')
        const awayVal = matchWinnerBet.values.find((v) => v.value === 'Away')

        const oddsHome = homeVal ? parseFloat(homeVal.odd) : null
        const oddsDraw = drawVal ? parseFloat(drawVal.odd) : null
        const oddsAway = awayVal ? parseFloat(awayVal.odd) : null

        const { error } = await db
          .from('fixtures')
          .update({
            odds_home: oddsHome,
            odds_draw: oddsDraw,
            odds_away: oddsAway,
            odds_fetched_at: new Date().toISOString(),
          })
          .eq('id', fixture.id)

        if (error) stats.errors.push(`odds fixture ${fixture.id}: ${error.message}`)
        else stats.odds_updated++
      } catch (e) {
        stats.errors.push(`odds fixture ${fixture.api_fixture_id}: ${String(e)}`)
      }

      // Small delay to stay within rate limit (reuses the squad delay cadence)
      await new Promise((r) => setTimeout(r, 6500))
    }
  } catch (e) {
    stats.errors.push(`odds sync: ${String(e)}`)
  }

  const status = stats.errors.length > 0 ? 207 : 200
  return new Response(JSON.stringify(stats), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
})
