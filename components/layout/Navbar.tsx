import { createClient } from '@/lib/supabase/server'
import NavbarClient from './NavbarClient'

export default async function Navbar({ locale }: { locale: string }) {
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
    <NavbarClient
      locale={locale}
      displayName={displayName}
      isAuthed={!!user}
      isAdmin={isAdmin}
    />
  )
}
