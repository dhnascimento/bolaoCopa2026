'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'
import { WorldCupMark } from '@/components/brand/WorldCupMark'
import { LocaleSwitcher } from './LocaleSwitcher'

type NavLink = { href: string; label: string }

export default function NavbarClient({
  locale,
  poolName,
  displayName,
  isAuthed,
  isAdmin,
}: {
  locale: string
  poolName: string | null
  displayName: string | null
  isAuthed: boolean
  isAdmin: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const appName = poolName ?? t('common.appName')

  // Lock body scroll while the mobile overlay is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const links: NavLink[] = [
    { href: `/${locale}/fixtures`, label: t('nav.fixtures') },
    { href: `/${locale}/outrights`, label: t('nav.outrights') },
    { href: `/${locale}/leaderboard`, label: t('nav.leaderboard') },
    { href: `/${locale}/rules`, label: t('nav.rules') },
    ...(isAdmin
      ? [{ href: `/${locale}/admin/scoring`, label: t('admin.title') }]
      : []),
  ]

  return (
    <header className="sticky top-0 z-30 bg-brand text-brand-foreground shadow-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
        {/* Logo */}
        <a
          href={`/${locale}`}
          className="flex shrink-0 cursor-pointer items-center gap-2 text-brand-foreground"
        >
          <WorldCupMark className="h-7 w-7" />
          <span className="font-heading text-base font-bold italic uppercase tracking-tight">
            {appName}
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center gap-1 sm:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative shrink-0 cursor-pointer px-3 py-1.5 font-heading text-sm font-semibold italic uppercase tracking-wide text-brand-foreground/90 transition-colors hover:text-brand-foreground"
            >
              {link.label}
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        {/* Desktop auth (right) */}
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <LocaleSwitcher isAuthed={isAuthed} />
          {isAuthed ? (
            <>
              {displayName && (
                <a
                  href={`/${locale}/profile`}
                  className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-brand-foreground/70 transition-colors hover:text-brand-foreground"
                >
                  {displayName}
                </a>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="cursor-pointer rounded-md px-3 py-1.5 font-heading text-sm font-semibold italic uppercase tracking-wide text-brand-foreground/90 transition-colors hover:bg-white/10 hover:text-brand-foreground"
                >
                  {t('auth.signOut')}
                </button>
              </form>
            </>
          ) : (
            <a
              href={`/${locale}/auth/sign-in`}
              className="cursor-pointer rounded-md bg-primary px-4 py-1.5 font-heading text-sm font-semibold italic uppercase tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {t('auth.signIn')}
            </a>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="ml-auto flex cursor-pointer items-center justify-center rounded-md p-1.5 text-brand-foreground transition-colors hover:bg-white/10 sm:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile full-screen overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-brand text-brand-foreground sm:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <a
              href={`/${locale}`}
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center gap-2"
            >
              <WorldCupMark className="h-7 w-7" />
              <span className="font-heading text-base font-bold italic uppercase tracking-tight">
                {t('common.appName')}
              </span>
            </a>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors hover:bg-white/10"
            >
              <X className="h-7 w-7" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-2 px-6 pt-8">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="group w-fit cursor-pointer font-heading text-3xl font-bold italic uppercase tracking-tight text-brand-foreground transition-colors hover:text-primary"
              >
                {link.label}
                <span className="block h-0.5 w-0 bg-primary transition-all duration-200 group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="border-t border-white/15 px-6 py-6">
            <div className="mb-5">
              <LocaleSwitcher isAuthed={isAuthed} className="w-fit" />
            </div>
            {isAuthed ? (
              <>
                {displayName && (
                  <a
                    href={`/${locale}/profile`}
                    onClick={() => setOpen(false)}
                    className="mb-3 block cursor-pointer font-heading text-lg font-semibold italic uppercase tracking-wide text-brand-foreground/80 transition-colors hover:text-primary"
                  >
                    {displayName}
                  </a>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="cursor-pointer font-heading text-lg font-semibold italic uppercase tracking-wide text-brand-foreground/90 transition-colors hover:text-primary"
                  >
                    {t('auth.signOut')}
                  </button>
                </form>
              </>
            ) : (
              <a
                href={`/${locale}/auth/sign-in`}
                onClick={() => setOpen(false)}
                className="inline-block cursor-pointer rounded-md bg-primary px-6 py-2.5 font-heading text-lg font-semibold italic uppercase tracking-wide text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                {t('auth.signIn')}
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
