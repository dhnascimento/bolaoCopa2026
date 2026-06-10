import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Verifies an admin-generated invite (or other email OTP) link server-side.
// generateLink({ type: 'invite' }) yields a token_hash that we wrap in a link to
// this route; verifyOtp establishes the session (sets auth cookies) without the
// PKCE verifier that the OAuth callback relies on. On success the user lands in
// the app already signed in.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(`/${locale}/fixtures`, request.url))
    }
    console.error('[auth/confirm] verifyOtp failed', error)
  }

  return NextResponse.redirect(
    new URL(`/${locale}/auth/sign-in?error=invite_invalid`, request.url),
  )
}
