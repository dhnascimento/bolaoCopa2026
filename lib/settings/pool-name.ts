import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

// Custom pool display name from settings (admin-editable), or null to use the
// localized default (common.appName). Read with the service-role client so it
// also resolves on public pages (sign-in / landing) where settings RLS would
// otherwise hide it. Cached per request to dedupe across navbar/landing/metadata.
export const getPoolName = cache(async (): Promise<string | null> => {
  try {
    const admin = createAdminClient()
    const { data } = await admin.from('settings').select('pool_name').single()
    return data?.pool_name?.trim() || null
  } catch {
    return null
  }
})
