// Server-only API-Football wrapper.  All Next.js server code that needs
// football data must go through this module — never call the API from a
// component, page, or the browser.

const BASE_URL = 'https://v3.football.api-sports.io'
export const LEAGUE = 1
export const SEASON = 2026

function key(): string {
  const k = process.env.API_FOOTBALL_KEY
  if (!k) throw new Error('API_FOOTBALL_KEY is not set')
  return k
}

async function apiFetch<T>(path: string): Promise<{ response: T; results: number }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-rapidapi-key': key(),
      'x-apisports-key': key(),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Response shapes ────────────────────────────────────────────────────────

export interface ApiTeamItem {
  team: { id: number; name: string; logo: string }
}

export interface ApiFixtureItem {
  fixture: {
    id: number
    date: string
    status: { short: string; long: string }
  }
  league: { round: string }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface ApiSquadItem {
  team: { id: number; name: string }
  players: Array<{ id: number; name: string; position: string }>
}

// ── Fetch helpers ──────────────────────────────────────────────────────────

export async function getLeagueTeams(): Promise<ApiTeamItem[]> {
  const data = await apiFetch<ApiTeamItem[]>(`/teams?league=${LEAGUE}&season=${SEASON}`)
  return data.response
}

export async function getLeagueFixtures(): Promise<ApiFixtureItem[]> {
  const data = await apiFetch<ApiFixtureItem[]>(`/fixtures?league=${LEAGUE}&season=${SEASON}`)
  return data.response
}

export async function getTeamSquad(teamId: number): Promise<ApiSquadItem[]> {
  const data = await apiFetch<ApiSquadItem[]>(`/players/squads?team=${teamId}`)
  return data.response
}

// ── Mapping helpers (shared with the Edge Function) ────────────────────────

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

export type FixtureStatus = 'scheduled' | 'live' | 'finished'

export function mapStatus(short: string): FixtureStatus {
  if (LIVE_STATUSES.has(short)) return 'live'
  if (FINISHED_STATUSES.has(short)) return 'finished'
  return 'scheduled'
}

export function mapStage(round: string): string {
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
