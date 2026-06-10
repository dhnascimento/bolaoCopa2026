'use server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from './require-admin'

export type ScoringConfig = {
  points_correct_result: number
  points_exact_score_bonus: number
  points_correct_champion: number
  points_correct_top_scorer: number
  entry_fee: number
  currency: string
  pool_name: string
}

export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string }

export async function updateScoringConfig(config: ScoringConfig): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('settings')
    .update({
      points_correct_result: config.points_correct_result,
      points_exact_score_bonus: config.points_exact_score_bonus,
      points_correct_champion: config.points_correct_champion,
      points_correct_top_scorer: config.points_correct_top_scorer,
      entry_fee: config.entry_fee,
      currency: config.currency,
      pool_name: config.pool_name.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function setPaymentStatus(
  userId: string,
  status: 'unpaid' | 'confirmed',
): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ payment_admin_status: status })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function setRegistrationLock(lockedAt: string | null): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('settings')
    .update({ registration_locked_at: lockedAt, updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function triggerRescore(): Promise<ActionResult & { count?: number }> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  // Call score_match_bets() via service-role client — auth.uid() will be null
  // in the DB session, satisfying the prevent_points_tampering trigger check.
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('score_match_bets')

  if (error) return { success: false, error: error.message }
  return { success: true, count: data ?? 0 }
}
