import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'

const CURRENCY_LOCALE: Record<string, string> = { BRL: 'pt-BR', CAD: 'en-CA' }

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en', {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export default async function RulesPage({
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

  const { data: settings } = await supabase
    .from('settings')
    .select(
      'points_correct_result, points_exact_score_bonus, points_correct_champion, points_correct_top_scorer, entry_fee, currency',
    )
    .single()

  const correctResult = settings?.points_correct_result ?? 3
  const exactBonus = settings?.points_exact_score_bonus ?? 5
  const champion = settings?.points_correct_champion ?? 15
  const topScorer = settings?.points_correct_top_scorer ?? 15
  const entryFee = settings?.entry_fee ?? 0
  const currency = settings?.currency ?? 'BRL'

  const exactTotal = correctResult + exactBonus
  const feeFormatted = formatMoney(entryFee, currency)

  const t = await getTranslations('rules')

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl">{t('howToPlayTitle')}</h2>
        <p>{t('howToPlayBody')}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t('matchScoringTitle')}</h2>
        <ul className="space-y-2">
          <li className="flex items-baseline gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-primary" />
            <span>{t('matchCorrectResult', { points: correctResult })}</span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-primary" />
            <span>{t('matchExactScore', { points: exactTotal })}</span>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">{t('regulationNote')}</p>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm not-italic normal-case tracking-normal text-muted-foreground">
            {t('examplesTitle')}
          </h3>
          <ul className="space-y-1.5 text-sm">
            <li>{t('example1', { points: exactTotal })}</li>
            <li>{t('example2', { points: correctResult })}</li>
            <li>{t('example3')}</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t('outrightsTitle')}</h2>
        <ul className="space-y-2">
          <li className="flex items-baseline gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-primary" />
            <span>{t('championRule', { points: champion })}</span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full bg-primary" />
            <span>{t('topScorerRule', { points: topScorer })}</span>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('locksTitle')}</h2>
        <p>{t('locksBody')}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('tiebreakTitle')}</h2>
        <p>{t('tiebreakBody')}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('potTitle')}</h2>
        <p>{t('potBody', { fee: feeFormatted })}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl">{t('privacyTitle')}</h2>
        <p>{t('privacyBody')}</p>
      </section>
    </main>
  )
}
