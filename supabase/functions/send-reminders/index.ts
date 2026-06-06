// Edge Function: send-reminders
//
// Runs every 15 minutes (pg_cron).  Finds fixtures whose lock_at is within
// the next 2 hours and have not had a reminder sent yet, then emails every
// user who has NOT placed a bet on those fixtures.
//
// One consolidated email per user covers all their missing bets in the batch.
// After sending, stamps reminder_sent_at on each processed fixture.
// Idempotent: reminder_sent_at prevents duplicate sends.
//
// Required env vars (Supabase Vault or Edge Function secrets):
//   RESEND_API_KEY   — Resend API key
//   RESEND_FROM      — "Bolão Copa 2026 <noreply@yourdomain.com>"
//   APP_URL          — production URL, e.g. https://bolao.example.com
//   CRON_SECRET      — (optional) shared secret for cron auth

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────────────────────────

interface FixtureRow {
  id: number
  home_team: { name: string } | null
  away_team: { name: string } | null
  kickoff_at: string
  lock_at: string
}

interface ProfileRow {
  id: string
  display_name: string
  locale: string
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function formatKickoff(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function buildEmailHtml(
  displayName: string,
  fixtures: FixtureRow[],
  appUrl: string,
  locale: string,
): string {
  const isPtBr = locale === 'pt-BR'

  const title = isPtBr
    ? `Você ainda não apostou em ${fixtures.length} partida${fixtures.length > 1 ? 's' : ''}!`
    : `You haven't bet on ${fixtures.length} upcoming match${fixtures.length > 1 ? 'es' : ''}!`

  const greeting = isPtBr ? `Olá, ${displayName}!` : `Hi, ${displayName}!`
  const intro = isPtBr
    ? 'As seguintes partidas fecham em breve e você ainda não fez suas apostas:'
    : "These matches are locking soon and you haven't placed your bets yet:"
  const cta = isPtBr ? 'Apostar agora' : 'Place your bets'
  const footer = isPtBr
    ? 'Você recebe este email porque participa do Bolão Copa 2026.'
    : 'You are receiving this because you are participating in the World Cup 2026 Pool.'

  const matchRows = fixtures
    .map((f) => {
      const home = f.home_team?.name ?? 'TBD'
      const away = f.away_team?.name ?? 'TBD'
      const time = formatKickoff(f.kickoff_at)
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">${home} × ${away}</td>
        <td style="padding:8px 0 8px 16px;border-bottom:1px solid #e5e7eb;color:#6b7280;white-space:nowrap;">${time}</td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8" /><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827;">${greeting}</h1>
    <p style="margin:0 0 24px;color:#374151;">${intro}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tbody>${matchRows}</tbody>
    </table>

    <a href="${appUrl}/fixtures"
       style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
      ${cta}
    </a>

    <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">${footer}</p>
  </div>
</body>
</html>`
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  // Brevo (formerly Sendinblue) — no domain verification needed, just a
  // verified sender email address from the Brevo dashboard.
  const [senderName, senderEmail] = from.includes('<')
    ? [from.split('<')[0].trim(), from.split('<')[1].replace('>', '').trim()]
    : ['Bolão Copa 2026', from]

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })
  return res.ok
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
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

  const emailApiKey = Deno.env.get('BREVO_API_KEY')
  if (!emailApiKey) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'BREVO_API_KEY not configured' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const from = Deno.env.get('EMAIL_FROM') ?? 'Bolão Copa 2026 <noreply@example.com>'
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // ── 1. Find fixtures locking in the next 2 hours with no reminder sent ──
  const now = new Date().toISOString()
  const windowEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const { data: upcomingFixtures, error: fixturesErr } = await db
    .from('fixtures')
    .select(
      'id, kickoff_at, lock_at, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
    )
    .gte('lock_at', now)
    .lte('lock_at', windowEnd)
    .is('reminder_sent_at', null)

  if (fixturesErr) {
    return new Response(JSON.stringify({ error: fixturesErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!upcomingFixtures || upcomingFixtures.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no upcoming fixtures needing reminders' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  const fixtureIds = upcomingFixtures.map((f) => f.id)

  // ── 2. Find all profiles ───────────────────────────────────────────────
  const { data: profiles } = await db
    .from('profiles')
    .select('id, display_name, locale')

  if (!profiles || profiles.length === 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no profiles found' }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 3. Find which bets already exist for these fixtures ───────────────
  const { data: existingBets } = await db
    .from('match_bets')
    .select('user_id, fixture_id')
    .in('fixture_id', fixtureIds)

  const betSet = new Set(
    (existingBets ?? []).map((b) => `${b.user_id}:${b.fixture_id}`),
  )

  // ── 4. Get user emails from auth.admin ────────────────────────────────
  const { data: authData } = await db.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map<string, string>(
    (authData?.users ?? [])
      .filter((u) => !!u.email)
      .map((u) => [u.id, u.email!]),
  )

  // ── 5. Per user: collect unbetted fixtures, send one email ─────────────
  const stats = {
    emails_sent: 0,
    emails_skipped: 0,
    fixtures_stamped: new Set<number>(),
    errors: [] as string[],
  }

  for (const profile of profiles as ProfileRow[]) {
    const email = emailMap.get(profile.id)
    if (!email) continue

    const missing = (upcomingFixtures as unknown as FixtureRow[]).filter(
      (f) => !betSet.has(`${profile.id}:${f.id}`),
    )

    if (missing.length === 0) continue

    const isPtBr = profile.locale === 'pt-BR'
    const subject = isPtBr
      ? `[Bolão Copa 2026] Você tem ${missing.length} aposta${missing.length > 1 ? 's' : ''} pendente${missing.length > 1 ? 's' : ''}!`
      : `[World Cup 2026 Pool] You have ${missing.length} pending bet${missing.length > 1 ? 's' : ''}!`

    const html = buildEmailHtml(profile.display_name, missing, appUrl, profile.locale)
    const sent = await sendEmail(emailApiKey, from, email, subject, html)

    if (sent) {
      stats.emails_sent++
      missing.forEach((f) => stats.fixtures_stamped.add(f.id))
    } else {
      stats.emails_skipped++
      stats.errors.push(`failed to send to ${email}`)
    }
  }

  // ── 6. Stamp reminder_sent_at on processed fixtures ───────────────────
  const stampIds = Array.from(stats.fixtures_stamped)
  if (stampIds.length > 0) {
    const { error: stampErr } = await db
      .from('fixtures')
      .update({ reminder_sent_at: new Date().toISOString() })
      .in('id', stampIds)

    if (stampErr) stats.errors.push(`stamp reminder_sent_at: ${stampErr.message}`)
  }

  const statusCode = stats.errors.length > 0 ? 207 : 200
  return new Response(
    JSON.stringify({
      ...stats,
      fixtures_stamped: stampIds.length,
    }),
    { status: statusCode, headers: { 'Content-Type': 'application/json' } },
  )
})
