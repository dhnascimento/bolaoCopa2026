'use server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type InviteResult =
  | { success: true }
  | { success: false; error: string }

export async function inviteUser(
  email: string,
  displayName: string,
  locale: string,
): Promise<InviteResult> {
  const userClient = await createClient()
  const { data: profile } = await userClient.from('profiles').select('is_admin').single()
  if (!profile?.is_admin) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (alreadyExists) return { success: false, error: 'already_exists' }

  // Send invite email via Supabase Auth (magic-link invite)
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, locale },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}
