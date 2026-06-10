import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { WorldCupMark } from '@/components/brand/WorldCupMark'

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
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden bg-brand-light p-8 text-brand-foreground">
      {/* Subtle coral glow accent */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sage/10 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 text-center">
        <WorldCupMark className="h-20 w-20 text-brand-foreground drop-shadow-lg" />
        <p className="eyebrow text-sm">{t('home.eyebrow')}</p>
        <h1 className="max-w-2xl text-4xl leading-[0.95] drop-shadow-md sm:text-6xl">
          {t('common.appName')}
        </h1>
        <a
          href={`/${locale}/auth/sign-in`}
          className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-8 py-3 font-heading text-lg font-semibold italic uppercase tracking-wide text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        >
          {t('auth.signIn')}
        </a>
      </div>
    </main>
  )
}
