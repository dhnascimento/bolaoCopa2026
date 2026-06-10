import { createClient } from '@/lib/supabase/server'

// Returns the signed-in user's id if they are an admin, otherwise null.
//
// IMPORTANT: the profiles_select RLS policy is `using (true)` (everyone in the
// pool can read every profile, for the leaderboard). So `select('is_admin')`
// without an id filter matches ALL rows, and `.single()` then throws once more
// than one member exists — which silently turned every admin action into
// "unauthorized". Always scope the check to the caller's own row.
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return profile?.is_admin ? user.id : null
}
