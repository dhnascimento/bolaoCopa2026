import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(`/${locale}/fixtures`)
  }

  const t = await getTranslations()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight text-center">
        {t('common.appName')}
      </h1>
      <a href={`/${locale}/auth/sign-in`}>
        <Button size="lg">{t('auth.signIn')}</Button>
      </a>
    </main>
  )
}
