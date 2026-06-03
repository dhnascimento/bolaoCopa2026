'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PaymentResult = { success: true } | { success: false; error: string }

export async function selfConfirmPayment(): Promise<PaymentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'unauthenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ payment_self_confirmed_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}
