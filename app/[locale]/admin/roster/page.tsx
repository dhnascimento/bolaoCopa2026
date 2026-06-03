import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import RosterTable, { type RosterProfile } from '@/components/admin/RosterTable'

export default async function AdminRosterPage({
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
  if (!profile?.is_admin) redirect(`/${locale}/fixtures`)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, payment_admin_status, payment_self_confirmed_at, created_at')
    .order('display_name', { ascending: true })

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <AdminNav locale={locale} />
      <RosterTable profiles={(profiles ?? []) as RosterProfile[]} />
    </main>
  )
}
