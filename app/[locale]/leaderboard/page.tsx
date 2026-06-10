import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardRow } from '@/components/leaderboard/LeaderboardTable'
import PotTotal from '@/components/leaderboard/PotTotal'
import { getRate } from '@/lib/currency/rate'

// Currencies offered in the pot toggle, and the locale used to format each.
const POT_CURRENCIES = ['BRL', 'CAD'] as const
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

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/sign-in`)

  const [
    { data: leaderboard },
    { data: settings },
    { count: profileCount },
  ] = await Promise.all([
    supabase
      .from('leaderboard')
      .select('user_id, display_name, points, exact_hits, correct_results'),
    supabase.from('settings').select('entry_fee, currency').single(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const entryFee = settings?.entry_fee ?? 0
  const nativeCurrency = settings?.currency ?? 'BRL'
  const pot = entryFee * (profileCount ?? 0)

  // Always show the native currency; add the other toggle currency when the live
  // rate is available. Native first so it's the default.
  const ordered = [
    nativeCurrency,
    ...POT_CURRENCIES.filter((c) => c !== nativeCurrency),
  ]
  const amounts: Record<string, string> = { [nativeCurrency]: formatMoney(pot, nativeCurrency) }
  for (const c of ordered) {
    if (c === nativeCurrency) continue
    const rate = await getRate(nativeCurrency, c)
    if (rate != null) amounts[c] = formatMoney(pot * rate, c)
  }
  const currencies = ordered.filter((c) => c in amounts)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('leaderboard.title')}</h1>
        <PotTotal
          amounts={amounts}
          currencies={currencies}
          defaultCurrency={nativeCurrency}
        />
      </div>

      <LeaderboardTable
        initialData={(leaderboard ?? []) as LeaderboardRow[]}
        currentUserId={user.id}
      />
    </main>
  )
}
