import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  FixtureCard,
  type FixtureWithTeams,
  type UserBet,
} from '@/components/fixtures/FixtureCard'
import PaymentBanner from '@/components/fixtures/PaymentBanner'

const STAGE_ORDER: Record<string, number> = {
  group: 0,
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  '3rd': 5,
  final: 6,
}

const STAGE_KEYS = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'] as const
type StageKey = (typeof STAGE_KEYS)[number]

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
        `id, stage, kickoff_at, lock_at, status, home_score, away_score,
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

  const betsMap = new Map(
    (bets ?? []).map((b) => [b.fixture_id, b as UserBet]),
  )

  const grouped = new Map<string, FixtureWithTeams[]>()
  for (const f of fixtures ?? []) {
    const stage = f.stage
    if (!grouped.has(stage)) grouped.set(stage, [])
    grouped.get(stage)!.push(f as unknown as FixtureWithTeams)
  }

  const stages = Array.from(grouped.keys()).sort(
    (a, b) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99),
  )

  const stageName = (stage: string): string => {
    if (STAGE_KEYS.includes(stage as StageKey)) {
      return t(`stages.${stage as StageKey}`)
    }
    return stage
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {needsPaymentBanner && <PaymentBanner />}

      {stages.length === 0 && (
        <p className="text-muted-foreground">{t('noFixtures')}</p>
      )}

      {stages.map((stage) => (
        <section key={stage}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {stageName(stage)}
          </h2>
          <div className="flex flex-col gap-3">
            {grouped.get(stage)!.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                existingBet={betsMap.get(fixture.id) ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
