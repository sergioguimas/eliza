'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function cancelAppointment(appointmentId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'canceled' } as any)
    .eq('id', appointmentId)

  if (error) return { error: error.message }

  revalidatePath('/agendamentos')
  revalidatePath('/dashboard')
  return { success: true }
}