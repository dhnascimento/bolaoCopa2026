#!/usr/bin/env node
// gen-bot-prompts.mjs — generate per-bot prediction prompt files for a knockout round.
//
// Replaces the manual "run 02-fixtures-menu.sql → fill 03-prompt-template.md per model"
// loop. Reads the LIVE, still-open knockout fixtures (now() < lock_at — the same fairness
// rule humans get) and writes one match-only prompt file per bot into docs/llm-bots/.
//
//   node scripts/gen-bot-prompts.mjs            # all currently-open knockout fixtures
//   node scripts/gen-bot-prompts.mjs r16        # only r16 fixtures
//   npm run bot-prompts -- r16
//
// Outputs docs/llm-bots/prompt-<round>-<slug>.md (gitignored). These are paste-in prompts;
// paste each into its model and run the returned SQL in the Supabase SQL editor.
//
// Match-only by design: champion/top-scorer outrights closed at first kickoff and are
// locked, so knockout rounds only seed match_bets. Outright bets are never emitted here.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'llm-bots')

// Bots — display_name must match a row from 01-create-bots.sql exactly.
const BOTS = [
  { name: 'Claude Opus 4.8', slug: 'claude-opus' },
  { name: 'GPT-5', slug: 'gpt' },
  { name: 'Gemini 3 Pro', slug: 'gemini' },
  { name: 'DeepSeek', slug: 'deepseek' },
]

// Order knockout stages for a tidy combined filename label when several are open.
const STAGE_ORDER = { r32: 1, r16: 2, qf: 3, sf: 4, '3rd': 5, final: 6 }

// ── Minimal .env.local loader (no dotenv dependency) ────────────────────────
async function loadEnv() {
  const env = {}
  try {
    const raw = await readFile(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
    }
  } catch {
    // fall back to process.env only
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function fmtKickoff(iso) {
  // Stored UTC (…+00:00); slicing the ISO is correct without TZ math.
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

function buildTable(rows) {
  const headers = ['fixture_id', 'stage', 'home', 'away', 'kickoff']
  const data = rows.map((r) => [
    String(r.id),
    r.stage,
    r.home,
    r.away,
    fmtKickoff(r.kickoff_at),
  ])
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((d) => d[i].length)),
  )
  const line = (cells) =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`
  const sep = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`
  return [line(headers), sep, ...data.map(line)].join('\n')
}

function buildPrompt(botName, table) {
  return `You are **${botName}**, a contestant in a FIFA World Cup 2026 betting pool. Predict the
**regulation-time (90-minute)** score of every knockout fixture below.

Fixtures (bet on every row; use the \`fixture_id\` value exactly):

${table}

**Output ONLY the SQL below — no prose, no code fences, no commentary.** Fill in your
predicted scores. Use each \`fixture_id\` exactly as listed in the menu.

\`\`\`sql
-- match scorelines: one row per fixture above
insert into public.match_bets (user_id, fixture_id, predicted_home, predicted_away)
values
  ((select id from public.profiles where display_name = '${botName}'), <fixture_id>, <home>, <away>),
  ((select id from public.profiles where display_name = '${botName}'), <fixture_id>, <home>, <away>)
  -- ... one row per fixture
on conflict (user_id, fixture_id) do update
  set predicted_home = excluded.predicted_home,
      predicted_away = excluded.predicted_away,
      updated_at = now();
\`\`\`
`
}

async function main() {
  const stageFilter = process.argv[2]?.toLowerCase() // optional, e.g. "r16"
  const { url, key } = await loadEnv()
  if (!url || !key) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in .env.local).',
    )
    process.exit(1)
  }

  // PostgREST directly via fetch — avoids the supabase-js realtime/WebSocket
  // requirement on Node < 22, and this script only needs a single read.
  const select =
    'id,stage,kickoff_at,lock_at,' +
    'home_team:teams!fixtures_home_team_id_fkey(name),' +
    'away_team:teams!fixtures_away_team_id_fkey(name)'
  const params = new URLSearchParams({ select, order: 'kickoff_at.asc' })
  params.append('lock_at', `gt.${new Date().toISOString()}`) // still open — fairness rule
  // Knockout only: a specific stage if given, else everything except group.
  params.append('stage', stageFilter ? `eq.${stageFilter}` : 'neq.group')

  const res = await fetch(`${url}/rest/v1/fixtures?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    console.error(`Query failed: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  const data = await res.json()

  const rows = (data ?? [])
    .filter((f) => f.home_team?.name && f.away_team?.name) // skip unresolved (TBD) brackets
    .map((f) => ({
      id: f.id,
      stage: f.stage,
      kickoff_at: f.kickoff_at,
      lock_at: f.lock_at,
      home: f.home_team.name,
      away: f.away_team.name,
    }))

  if (rows.length === 0) {
    console.error(
      stageFilter
        ? `No open ${stageFilter} fixtures right now (none unlocked / bracket not resolved).`
        : 'No open knockout fixtures right now.',
    )
    process.exit(1)
  }

  const stages = [...new Set(rows.map((r) => r.stage))].sort(
    (a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
  )
  const label = stages.join('-')
  const table = buildTable(rows)

  await mkdir(OUT_DIR, { recursive: true })
  const written = []
  for (const bot of BOTS) {
    const file = join(OUT_DIR, `prompt-${label}-${bot.slug}.md`)
    await writeFile(file, buildPrompt(bot.name, table), 'utf8')
    written.push(`docs/llm-bots/prompt-${label}-${bot.slug}.md`)
  }

  const soonestLock = rows
    .map((r) => r.lock_at)
    .filter(Boolean)
    .sort()[0]

  console.log(`Round label: ${label}  (${rows.length} open fixture(s))`)
  console.log('Wrote:')
  for (const w of written) console.log(`  ${w}`)
  console.log(
    '\nNext: paste each into its model, run the returned SQL in the Supabase SQL editor.',
  )
  console.log(
    'For Claude Opus 4.8 you can paste its prompt into Claude, or ask Claude to fill the SQL directly.',
  )
  if (soonestLock) {
    console.log(
      `\n⏰ Soonest lock: ${fmtKickoff(soonestLock)} — run before then.` +
        ' A fixture that has already locked must NOT be seeded (the SQL editor bypasses locks).',
    )
  }
}

main()
