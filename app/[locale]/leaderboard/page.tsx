import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable'
import type { LeaderboardRow } from '@/components/leaderboard/LeaderboardTable'

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
  const currency = settings?.currency ?? 'BRL'
  const pot = entryFee * (profileCount ?? 0)

  let potFormatted: string
  try {
    potFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(pot)
  } catch {
    potFormatted = `${currency} ${pot.toFixed(2)}`
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('leaderboard.title')}</h1>
        <div className="shrink-0 text-right">
          <p className="eyebrow text-[0.7rem] text-muted-foreground">{t('common.potTotal')}</p>
          <p className="font-heading text-3xl font-bold italic tabular-nums text-primary">
            {potFormatted}
          </p>
        </div>
      </div>

      <LeaderboardTable
        initialData={(leaderboard ?? []) as LeaderboardRow[]}
        currentUserId={user.id}
      />
    </main>
  )
}
