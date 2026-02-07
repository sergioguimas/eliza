'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient<Database>()

  const organization_id = formData.get('organizationId') as string
  const form_type = formData.get('form_type') as string

  // --- CENÁRIO 1: ATUALIZAR HORÁRIOS ---
  if (form_type === 'schedule') {
      const updates: any = {
          open_hours_start: formData.get('open_hours_start'),
          open_hours_end: formData.get('open_hours_end'),
          lunch_start: formData.get('lunch_start'), 
          lunch_end: formData.get('lunch_end'),
          appointment_duration: parseInt(formData.get('appointment_duration') as string),
          days_of_week: formData.getAll('days_of_week').map(d => parseInt(d as string))
      }

      const { error } = await (supabase.from('organization_settings'))
        .update(updates)
        .eq('organization_id', organization_id)

      if (error) return { error: 'Erro ao salvar horários' }
  }

  // --- CENÁRIO 2: ATUALIZAR MENSAGENS ---
  else if (form_type === 'messages') {
      const updates = {
          msg_appointment_created: formData.get('msg_appointment_created') as string,
          msg_appointment_reminder: formData.get('msg_appointment_reminder') as string,
          msg_appointment_canceled: formData.get('msg_appointment_canceled') as string
      }

      const { error } = await (supabase.from('organization_settings'))
        .update(updates)
        .eq('organization_id', organization_id)

      if (error) return { error: 'Erro ao salvar mensagens' }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}