import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from '@/components/profile/ProfileForm'

export default async function ProfilePage({
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const t = await getTranslations('profile')

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ProfileForm initialName={profile?.display_name ?? ''} />
    </main>
  )
}
