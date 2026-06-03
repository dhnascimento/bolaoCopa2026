import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export default async function Navbar({ locale }: { locale: string }) {
  const t = await getTranslations()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, is_admin')
      .eq('id', user.id)
      .single()
    displayName = profile?.display_name ?? null
    isAdmin = profile?.is_admin ?? false
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
        <a href={`/${locale}`} className="text-sm font-bold shrink-0">
          {t('common.appName')}
        </a>

        <nav className="flex flex-1 gap-4 overflow-x-auto">
          <a
            href={`/${locale}/fixtures`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {t('nav.fixtures')}
          </a>
          <a
            href={`/${locale}/outrights`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {t('nav.outrights')}
          </a>
          <a
            href={`/${locale}/leaderboard`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {t('nav.leaderboard')}
          </a>
          {isAdmin && (
            <a
              href={`/${locale}/admin/scoring`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {t('admin.title')}
            </a>
          )}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {displayName && (
                <span className="hidden sm:block text-sm text-muted-foreground">
                  {displayName}
                </span>
              )}
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm">
                  {t('auth.signOut')}
                </Button>
              </form>
            </>
          ) : (
            <a href={`/${locale}/auth/sign-in`}>
              <Button variant="outline" size="sm">
                {t('auth.signIn')}
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
