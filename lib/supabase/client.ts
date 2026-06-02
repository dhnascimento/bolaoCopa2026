import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

// Browser client — uses the anon key and is fully governed by RLS.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
