'use client'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { updateLocale } from '@/lib/auth/actions'

const OPTIONS = [
  { locale: 'pt-BR', short: 'PT' },
  { locale: 'en', short: 'EN' },
] as const

// Segmented PT/EN toggle. Switching navigates to the current path in the target
// locale (updating the URL prefix and NEXT_LOCALE cookie) and, when signed in,
// persists the choice to the user's profile.
export function LocaleSwitcher({
  isAuthed,
  className = '',
}: {
  isAuthed: boolean
  className?: string
}) {
  const active = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()

  function switchTo(locale: string) {
    if (locale === active) return
    startTransition(() => {
      if (isAuthed) void updateLocale(locale)
      router.replace(pathname, { locale })
    })
  }

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={`flex items-center rounded-md border border-white/20 p-0.5 ${className}`}
    >
      {OPTIONS.map(({ locale, short }) => {
        const isActive = locale === active
        return (
          <button
            key={locale}
            type="button"
            disabled={isPending}
            aria-pressed={isActive}
            onClick={() => switchTo(locale)}
            className={`cursor-pointer rounded px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-wait ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-brand-foreground/80 hover:text-brand-foreground'
            }`}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}
