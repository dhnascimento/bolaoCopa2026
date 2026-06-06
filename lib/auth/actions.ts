'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/sign-in') // next-intl middleware prepends the locale
}

// Persist the signed-in user's language choice so server-rendered surfaces
// (e.g. reminder emails) follow it. The active UI locale is driven by the URL
// prefix + NEXT_LOCALE cookie; this keeps the profile in sync.
export async function updateLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ locale }).eq('id', user.id)
}
