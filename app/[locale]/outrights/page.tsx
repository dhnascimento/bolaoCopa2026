import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import OutrightBetsForm from '@/components/outrights/OutrightBetsForm'
import type { Team, PlayerWithTeam, CurrentBet } from '@/components/outrights/OutrightBetsForm'
import OutrightsReveal, { type RevealPick } from '@/components/outrights/OutrightsReveal'

// Mirrors the DB registration_locked() function: locked once the timestamp is
// set and has passed. Module-scope helper keeps the time read out of render.
function registrationIsLocked(ts: string | null): boolean {
  return !!ts && new Date(ts).getTime() <= Date.now()
}

type OutrightRow = {
  user_id: string
  bet_type: string
  profiles: { display_name: string } | { display_name: string }[] | null
  teams: { name: string } | { name: string }[] | null
  players: { name: string } | { name: string }[] | null
}

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function OutrightsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('outrights')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/sign-in`)

  const [
    { data: teams },
    { data: players },
    { data: currentBets },
    { data: settings },
  ] = await Promise.all([
    supabase.from('teams').select('id, name, flag_url').order('name'),
    supabase.from('players').select('id, name, teams(name)').order('name'),
    supabase
      .from('outright_bets')
      .select('bet_type, predicted_team_id, predicted_player_id')
      .eq('user_id', user.id),
    supabase.from('settings').select('registration_locked_at').single(),
  ])

  const registrationLockedAt = settings?.registration_locked_at ?? null
  const isLocked = registrationIsLocked(registrationLockedAt)

  // Once registration is locked, RLS exposes every participant's outright bets.
  const championPicks: RevealPick[] = []
  const topScorerPicks: RevealPick[] = []
  if (isLocked) {
    const { data: allBets } = await supabase
      .from('outright_bets')
      .select('user_id, bet_type, profiles(display_name), teams(name), players(name)')

    for (const row of (allBets ?? []) as unknown as OutrightRow[]) {
      const name = unwrap(row.profiles)?.display_name ?? '—'
      if (row.bet_type === 'champion') {
        championPicks.push({
          user_id: row.user_id,
          display_name: name,
          pick: unwrap(row.teams)?.name ?? '—',
        })
      } else if (row.bet_type === 'top_scorer') {
        topScorerPicks.push({
          user_id: row.user_id,
          display_name: name,
          pick: unwrap(row.players)?.name ?? '—',
        })
      }
    }

    const byName = (a: RevealPick, b: RevealPick) =>
      a.display_name.localeCompare(b.display_name)
    championPicks.sort(byName)
    topScorerPicks.sort(byName)
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <OutrightBetsForm
        teams={(teams ?? []) as Team[]}
        players={(players ?? []) as unknown as PlayerWithTeam[]}
        currentBets={(currentBets ?? []) as CurrentBet[]}
        registrationLockedAt={registrationLockedAt}
      />
      {isLocked && (
        <OutrightsReveal
          championPicks={championPicks}
          topScorerPicks={topScorerPicks}
          currentUserId={user.id}
        />
      )}
    </main>
  )
}
