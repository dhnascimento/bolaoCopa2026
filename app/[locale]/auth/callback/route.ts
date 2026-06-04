import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Handles the OAuth PKCE code-exchange after Google redirect.
// Exchanges the one-time code for a session cookie, then:
//   - New user + registration locked → signs out + redirects to sign-in with error
//   - Otherwise → redirects to /fixtures
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL(`/${locale}/auth/sign-in`, request.url))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(new URL(`/${locale}/auth/sign-in`, request.url))
  }

  // Check if this is a new user (no profile row yet) and whether registration is locked
  const userId = data.session.user.id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    // New user — check registration lock
    const { data: settings } = await supabase
      .from('settings')
      .select('registration_locked_at')
      .single()

    const lockedAt = settings?.registration_locked_at
    const isLocked = !!lockedAt && new Date(lockedAt).getTime() <= Date.now()

    if (isLocked) {
      // Sign them out immediately and bounce back to sign-in
      await supabase.auth.signOut()
      return NextResponse.redirect(
        new URL(`/${locale}/auth/sign-in?error=registration_closed`, request.url),
      )
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/fixtures`, request.url))
}
