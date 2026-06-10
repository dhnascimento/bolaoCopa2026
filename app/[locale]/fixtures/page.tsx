import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  type FixtureWithTeams,
  type UserBet,
} from '@/components/fixtures/FixtureCard'
import FixturesBrowser from '@/components/fixtures/FixturesBrowser'
import PaymentBanner from '@/components/fixtures/PaymentBanner'

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/sign-in`)

  const [{ data: fixtures }, { data: bets }, { data: profile }] = await Promise.all([
    supabase
      .from('fixtures')
      .select(
        `id, stage, group_label, kickoff_at, lock_at, status, home_score, away_score,
         odds_home, odds_draw, odds_away,
         home_team:teams!fixtures_home_team_id_fkey(id, name, flag_url),
         away_team:teams!fixtures_away_team_id_fkey(id, name, flag_url)`,
      )
      .order('kickoff_at', { ascending: true }),
    supabase
      .from('match_bets')
      .select('fixture_id, predicted_home, predicted_away')
      .eq('user_id', user.id),
    supabase
      .from('profiles')
      .select('payment_self_confirmed_at')
      .eq('id', user.id)
      .single(),
  ])

  const needsPaymentBanner = !profile?.payment_self_confirmed_at

  const t = await getTranslations('fixtures')

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {needsPaymentBanner && <PaymentBanner />}

      <FixturesBrowser
        fixtures={(fixtures ?? []) as unknown as FixtureWithTeams[]}
        bets={(bets ?? []) as UserBet[]}
        currentUserId={user.id}
      />
    </div>
  )
}
