import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Handles the OAuth PKCE code-exchange after Google / Microsoft redirects back.
// Supabase redirects here with ?code=<one-time-code>; we exchange it for a
// session cookie and send the user to the fixtures page.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(`/${locale}/fixtures`, request.url))
}
