'use client'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function AdminNav({ locale }: { locale: string }) {
  const t = useTranslations('admin')
  const pathname = usePathname()

  const tabs = [
    { href: `/${locale}/admin/scoring`, label: t('navScoring') },
    { href: `/${locale}/admin/roster`, label: t('navRoster') },
  ]

  return (
    <nav className="flex gap-1 border-b mb-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </a>
        )
      })}
    </nav>
  )
}
