'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const MAX_NAME_LENGTH = 40

type UpdateResult = { success: true } | { success: false; error: 'empty' | 'save' }

// Lets a signed-in user rename themselves. RLS (profiles_update) permits a user
// to update their own row, and the protect_profile_columns trigger guards only
// admin/payment columns — display_name is freely self-editable.
export async function updateDisplayName(name: string): Promise<UpdateResult> {
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'empty' }

  const display_name = trimmed.slice(0, MAX_NAME_LENGTH)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'save' }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name })
    .eq('id', user.id)

  if (error) return { success: false, error: 'save' }

  // Refresh server-rendered surfaces that show the name (navbar, leaderboard).
  revalidatePath('/', 'layout')
  return { success: true }
}
