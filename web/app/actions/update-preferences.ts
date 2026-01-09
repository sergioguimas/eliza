'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient()

  const organization_id = formData.get('organization_id') as string
  
  // Horários e Dias
  const open_hours_start = formData.get('open_hours_start') as string
  const open_hours_end = formData.get('open_hours_end') as string
  const appointment_duration = formData.get('appointment_duration')
  // Captura os checkboxes (retorna array de strings, convertemos para number)
  const days_of_week = formData.getAll('days_of_week').map(d => parseInt(d as string))
  
  // Mensagens Personalizadas
  const whatsapp_message_created = formData.get('whatsapp_message_created') as string
  const whatsapp_message_reminder = formData.get('whatsapp_message_reminder') as string
  const whatsapp_message_canceled = formData.get('whatsapp_message_canceled') as string

  const { error } = await supabase
    .from('organization_settings')
    .update({
      open_hours_start,
      open_hours_end,
      appointment_duration: parseInt(appointment_duration as string),
      days_of_week,
      whatsapp_message_created,
      whatsapp_message_reminder,
      whatsapp_message_canceled
    })
    .eq('organization_id', organization_id)

  if (error) {
    console.error("Erro ao atualizar preferências:", error)
    return { error: "Erro ao atualizar configurações." }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}