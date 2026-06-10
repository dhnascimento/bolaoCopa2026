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

// Manually record a match's final 90-minute result (used when the automatic
// API-Football sync isn't available), then re-score match bets idempotently.
export async function setMatchResult(
  fixtureId: number,
  home: number,
  away: number,
): Promise<ActionResult & { count?: number }> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return { success: false, error: 'invalid' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('fixtures')
    .update({
      status: 'finished',
      regulation_home: home,
      regulation_away: away,
      home_score: home,
      away_score: away,
      finished_at: new Date().toISOString(),
    })
    .eq('id', fixtureId)
  if (error) return { success: false, error: error.message }

  const { data, error: scoreErr } = await admin.rpc('score_match_bets')
  if (scoreErr) return { success: false, error: scoreErr.message }

  revalidatePath('/', 'layout')
  return { success: true, count: data ?? 0 }
}

// Revert a match to "not played" (e.g. a result entered by mistake) and re-score.
export async function clearMatchResult(fixtureId: number): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('fixtures')
    .update({
      status: 'scheduled',
      regulation_home: null,
      regulation_away: null,
      home_score: null,
      away_score: null,
      finished_at: null,
    })
    .eq('id', fixtureId)
  if (error) return { success: false, error: error.message }

  const { error: scoreErr } = await admin.rpc('score_match_bets')
  if (scoreErr) return { success: false, error: scoreErr.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

// Record the actual champion / top scorer (either may be null until decided)
// and score the outright bets idempotently.
export async function setOutrightResults(
  championTeamId: number | null,
  topScorerPlayerId: number | null,
): Promise<ActionResult & { count?: number }> {
  const adminId = await requireAdmin()
  if (!adminId) return { success: false, error: 'unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('settings')
    .update({
      actual_champion_team_id: championTeamId,
      actual_top_scorer_player_id: topScorerPlayerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return { success: false, error: error.message }

  const { data, error: scoreErr } = await admin.rpc('score_outright_bets')
  if (scoreErr) return { success: false, error: scoreErr.message }

  revalidatePath('/', 'layout')
  return { success: true, count: data ?? 0 }
}
