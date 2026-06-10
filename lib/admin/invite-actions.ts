'use server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './require-admin'

export type InviteResult =
  | { success: true }
  | { success: false; error: string }

export type InviteLinkResult =
  | { success: true; link: string }
  | { success: false; error: string }

// Creates the user (with the chosen name + language) and returns a one-time
// invite link WITHOUT sending any email — sidestepping Supabase's built-in
// email rate limit. The admin shares the link directly (e.g. on WhatsApp).
// The link points at our /auth/confirm route, which verifies the token
// server-side via verifyOtp (the @supabase/ssr pattern).
export async function createInviteLink(
  email: string,
  displayName: string,
  locale: string,
): Promise<InviteLinkResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()

  // Reject duplicates up front (generateLink would also error).
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (alreadyExists) return { success: false, error: 'already_exists' }

  // generateLink creates the user and returns the token WITHOUT sending email.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { display_name: displayName, locale } },
  })

  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('[createInviteLink] generateLink failed', error)
    return { success: false, error: error?.message ?? 'unknown' }
  }

  // Build a link to our own confirm route from the current request origin.
  const h = await headers()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  const link = `${origin}/${locale}/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=invite`

  revalidatePath('/', 'layout')
  return { success: true, link }
}

export async function inviteUser(
  email: string,
  displayName: string,
  locale: string,
): Promise<InviteResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (alreadyExists) return { success: false, error: 'already_exists' }

  // Send invite email via Supabase Auth (magic-link invite).
  // NOTE: the built-in email sender is capped at ~2 emails/hour on hosted
  // Supabase; raising it requires custom SMTP. We surface that case explicitly.
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, locale },
  })

  if (error) {
    console.error('[inviteUser] invite failed', error)
    const isRateLimited =
      error.status === 429 ||
      error.code === 'over_email_send_rate_limit' ||
      /rate limit/i.test(error.message)
    return { success: false, error: isRateLimited ? 'rate_limited' : error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
