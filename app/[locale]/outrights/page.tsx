import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import OutrightBetsForm from '@/components/outrights/OutrightBetsForm'
import type { Team, PlayerWithTeam, CurrentBet } from '@/components/outrights/OutrightBetsForm'

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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <OutrightBetsForm
        teams={(teams ?? []) as Team[]}
        players={(players ?? []) as unknown as PlayerWithTeam[]}
        currentBets={(currentBets ?? []) as CurrentBet[]}
        registrationLockedAt={settings?.registration_locked_at ?? null}
      />
    </main>
  )
}
