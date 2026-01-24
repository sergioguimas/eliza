'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient()

  const organization_id = formData.get('organizationId') as string
  const form_type = formData.get('form_type') as string

  const updates: any = {}

  // --- CENÁRIO 1: ATUALIZAR HORÁRIOS ---
  if (form_type === 'schedule') {
      const open_hours_start = formData.get('open_hours_start') as string
      const open_hours_end = formData.get('open_hours_end') as string
      const appointment_duration = formData.get('appointment_duration')
      
      // Tratamento especial para checkboxes
      const days_of_week = formData.getAll('days_of_week').map(d => parseInt(d as string))

      updates.open_hours_start = open_hours_start
      updates.open_hours_end = open_hours_end
      updates.appointment_duration = parseInt(appointment_duration as string)
      updates.days_of_week = days_of_week
  }

  // --- CENÁRIO 2: ATUALIZAR MENSAGENS ---
  else if (form_type === 'messages') {
      const msg_appointment_created = formData.get('msg_appointment_created') as string
      const msg_appointment_reminder = formData.get('msg_appointment_reminder') as string
      const msg_appointment_canceled = formData.get('msg_appointment_canceled') as string

      updates.msg_appointment_created = msg_appointment_created
      updates.msg_appointment_reminder = msg_appointment_reminder
      updates.msg_appointment_canceled = msg_appointment_canceled
  }

  // Se não identificou o tipo ou não tem updates, para.
  if (Object.keys(updates).length === 0) {
      return { success: true } 
  }

  const { error } = await (supabase.from('organization_settings') as any)
    .update(updates)
    .eq('organization_id', organization_id)

  if (error) {
    console.error('Erro update prefs:', error)
    return { error: 'Erro ao salvar configurações' }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}