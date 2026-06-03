'use server'
import { createClient } from '@/lib/supabase/server'

export type OutrightBetResult =
  | { success: true }
  | { success: false; error: 'locked' | 'unknown' }

export async function placeOutrightBet(
  betType: 'champion' | 'top_scorer',
  teamId: number | null,
  playerId: number | null,
): Promise<OutrightBetResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('place_outright_bet', {
    p_bet_type: betType,
    p_predicted_team_id: teamId ?? undefined,
    p_predicted_player_id: playerId ?? undefined,
  })
  if (!error) return { success: true }
  if (error.message.includes('bet_locked')) return { success: false, error: 'locked' }
  return { success: false, error: 'unknown' }
}
