'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { addMinutes } from 'date-fns'
import { sendAppointmentConfirmation } from "./whatsapp-messages"

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  const service_id = formData.get('service_id') as string
  const profile_id = formData.get('staff_id') as string
  const start_time_raw = formData.get('start_time') as string 
  const organization_id = formData.get('organizations_id') as string 

  if (!customer_id || !service_id || !start_time_raw || !organization_id) {
    return { error: "Campos obrigatórios faltando." }
  }

  // Busca duração do serviço (nota: duration_minutes)
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', service_id)
    .single()

  const duration = service?.duration_minutes || 30
  const start_date = new Date(start_time_raw)
  const end_date = addMinutes(start_date, duration)

  // Objeto corrigido para a tabela nova
  const newAppointment = {
    customer_id,
    organization_id,
    service_id,
    profile_id,
    start_time: start_date.toISOString(),
    end_time: end_date.toISOString(),
    status: 'pending',
    notes: 'Agendamento via Sistema'
  } as const

  // INSERT
  const { data: appointment, error: insertError } = await supabase
    .from('appointments') 
    .insert(newAppointment as any) // 'as any' para evitar conflito temporário de enum
    .select()
    .single()

  if (insertError) {
    console.error("Erro REAL do Banco de Dados:", insertError.message)
    return { error: `Erro ao salvar: ${insertError.message}` }
  }

  // Disparo do WhatsApp
  if (appointment) {
    try {
      await sendAppointmentConfirmation(appointment.id)
    } catch (err) {
      console.error("Erro ao enviar WhatsApp:", err)
    }
  }

  revalidatePath('/agendamentos')
  return { success: true }
}