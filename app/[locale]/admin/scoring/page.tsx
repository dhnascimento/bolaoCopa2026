import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import ScoringConfigForm from '@/components/admin/ScoringConfigForm'
import type { ScoringConfig } from '@/lib/admin/actions'

export default async function AdminScoringPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/${locale}/auth/sign-in`)

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted-foreground">{t('notAdmin')}</p>
      </main>
    )
  }

  const { data: settings } = await supabase.from('settings').select('*').single()

  const initialConfig: ScoringConfig = {
    points_correct_result: settings?.points_correct_result ?? 3,
    points_exact_score_bonus: settings?.points_exact_score_bonus ?? 5,
    points_correct_champion: settings?.points_correct_champion ?? 15,
    points_correct_top_scorer: settings?.points_correct_top_scorer ?? 15,
    entry_fee: settings?.entry_fee ?? 0,
    currency: settings?.currency ?? 'BRL',
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ScoringConfigForm initialConfig={initialConfig} />
    </main>
  )
}
