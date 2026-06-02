import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const handleI18n = createIntlMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Refresh the Supabase session so server components see the current user.
  // Must run before returning any response to ensure cookies are forwarded.
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)),
      },
    },
  )
  await supabase.auth.getUser()

  // Apply locale routing; propagate any session cookies it may discard.
  const intlResponse = handleI18n(request)
  response.cookies.getAll().forEach(({ name, value }) =>
    intlResponse.cookies.set(name, value))

  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
