'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type AppointmentStatus = 'pending' | 'confirmed' | 'canceled' | 'completed' | 'no_show'

export async function updateAppointmentStatus(appointmentId: string, newStatus: AppointmentStatus) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)

  if (error) {
    console.error('Erro ao atualizar status:', error)
    return { error: 'Erro ao atualizar status.' }
  }

  revalidatePath('/agendamentos')
  return { success: true }
}