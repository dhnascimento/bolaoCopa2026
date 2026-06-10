import type { Metadata } from 'next'
import { Geist, Geist_Mono, Oswald } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { getPoolName } from '@/lib/settings/pool-name'
import Navbar from '@/components/layout/Navbar'
import '../globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const oswald = Oswald({
  variable: '--font-oswald',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [poolName, t] = await Promise.all([
    getPoolName(),
    getTranslations({ locale }),
  ])
  return {
    title: poolName ?? t('common.appName'),
    description: 'Private betting pool for the FIFA World Cup 2026',
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <Navbar locale={locale} />
          <main className="flex flex-col flex-1">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
