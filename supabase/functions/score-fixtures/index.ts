// Edge Function: score-fixtures
//
// Polls API-Football for live and recently-finished fixtures, updates the DB,
// then calls score_match_bets() to award points idempotently.
//
// Quota discipline: checks the DB for an active match window before touching
// the API.  Outside a window the function returns immediately with
// {skipped: true}, costing 0 API-Football quota.
//
// Active window = any fixture with status != 'finished' whose kickoff_at
// is within the last 3 hours (covers regulation + stoppage time + buffer).
//
// Auth: same CRON_SECRET pattern as sync-fixtures.

import { createClient } from 'npm:@supabase/supabase-js@2'

const LEAGUE = 1
const API_BASE = 'https://v3.football.api-sports.io'

// ── Type shapes (API-Football v3) ──────────────────────────────────────────

interface ApiFixtureItem {
  fixture: {
    id: number
    status: { short: string }
  }
  goals: { home: number | null; away: number | null }
  score: { fulltime: { home: number | null; away: number | null } }
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
  // Optional CRON_SECRET check (same pattern as sync-fixtures).
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
  const apiKey = Deno.env.get('API_FOOTBALL_KEY')

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API_FOOTBALL_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // ── 1. Active window check ─────────────────────────────────────────────
  // Avoid API calls outside match windows to protect the free-tier quota.
  // A window is open if any not-yet-finished fixture kicked off in the last
  // 3 hours (covers a full 90-min match + stoppage + processing buffer).
  const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  const { data: activeCheck } = await db
    .from('fixtures')
    .select('id')
    .gte('kickoff_at', windowStart)
    .lte('kickoff_at', now)
    .neq('status', 'finished')
    .limit(1)

  if (!activeCheck || activeCheck.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no active match window' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const stats = {
    fixtures_updated: 0,
    bets_scored: 0 as number | null,
    errors: [] as string[],
  }

  // ── 2. Fetch live fixtures from API-Football ───────────────────────────
  // The live endpoint briefly includes fixtures in FT/AET/PEN status too,
  // giving us a window to capture scores before they age out.
  let apiFixtures: ApiFixtureItem[] = []
  try {
    const res = await apiFetch<ApiFixtureItem[]>(
      `/fixtures?live=all&league=${LEAGUE}`,
      apiKey,
    )
    apiFixtures = res.response
  } catch (e) {
    stats.errors.push(`live fetch: ${String(e)}`)
  }

  // ── 3. Update fixture rows in DB ───────────────────────────────────────
  // Only update the mutable fields (status, scores).  kickoff_at / stage /
  // team IDs never change mid-match, so we don't touch them here — this
  // also avoids the trg_fixtures_lock_at trigger recomputing lock_at
  // unnecessarily (it still fires, but new.kickoff_at = old.kickoff_at).
  for (const item of apiFixtures) {
    const status = mapStatus(item.fixture.status.short)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      status,
      home_score: item.goals.home,
      away_score: item.goals.away,
    }

    if (status === 'finished') {
      update.regulation_home = item.score.fulltime.home
      update.regulation_away = item.score.fulltime.away
      // finished_at: set only on first transition (COALESCE not available via
      // JS SDK, so we just overwrite — the exact timestamp is not critical).
      update.finished_at = new Date().toISOString()
    }

    const { error } = await db
      .from('fixtures')
      .update(update)
      .eq('api_fixture_id', item.fixture.id)

    if (error) {
      stats.errors.push(`update fixture ${item.fixture.id}: ${error.message}`)
    } else {
      stats.fixtures_updated++
    }
  }

  // ── 4. Run the idempotent scoring engine ───────────────────────────────
  // score_match_bets() scans all finished fixtures with regulation scores
  // and sets points_awarded = f(predicted, actual, config).  Safe to call
  // even when no fixture data changed (no-op if scores didn't change).
  const { data: scored, error: scoreErr } = await db.rpc('score_match_bets')
  if (scoreErr) {
    stats.errors.push(`score_match_bets: ${scoreErr.message}`)
  } else {
    stats.bets_scored = scored
  }

  const statusCode = stats.errors.length > 0 ? 207 : 200
  return new Response(JSON.stringify(stats), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  })
})
