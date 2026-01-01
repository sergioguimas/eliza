'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleAppointmentStatus(appointmentId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus } as any)
    .eq('id', appointmentId)

  if (error) {
    return { error: error.message }
  }

  // Revalida a agenda para refletir a mudança de cor/ícone imediatamente
  revalidatePath('/agendamentos')
  return { success: true }
}