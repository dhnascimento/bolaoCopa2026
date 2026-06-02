'use server'
import { createClient } from '@/lib/supabase/server'

export type BetResult =
  | { success: true }
  | { success: false; error: 'locked' | 'not_found' | 'unknown' }

export async function placeBet(
  fixtureId: number,
  predictedHome: number,
  predictedAway: number,
): Promise<BetResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('place_match_bet', {
    p_fixture_id: fixtureId,
    p_predicted_home: predictedHome,
    p_predicted_away: predictedAway,
  })
  if (!error) return { success: true }
  if (error.message.includes('bet_locked')) return { success: false, error: 'locked' }
  if (error.message.includes('fixture_not_found')) return { success: false, error: 'not_found' }
  return { success: false, error: 'unknown' }
}
