'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateAppointmentStatus(appointmentId: string, newStatus: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)

  if (error) {
    console.error("Erro ao atualizar status:", error)
    return { error: "Erro ao atualizar status" }
  }

  revalidatePath('/')
  revalidatePath('/agendamentos')
  return { success: true }
}