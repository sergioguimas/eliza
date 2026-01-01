'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { addMinutes, parseISO } from 'date-fns'

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  const service_id = formData.get('service_id') as string
  const start_time_raw = formData.get('start_time') as string
  const organizations_id = formData.get('organizations_id') as string

  // 1. Busca a duração
  const { data: service } = await supabase
    .from('services')
    .select('duration')
    .eq('id', service_id)
    .single()

  const duration = service?.duration || 30
  
  // 2. CORREÇÃO DE TIMEZONE
  // O parseISO interpreta strings "YYYY-MM-DDTHH:mm" como horário local do servidor/browser
  const start_time = parseISO(start_time_raw)
  const end_time = addMinutes(start_time, duration)

  // 3. Insere usando a string ISO completa (que inclui o fuso se necessário)
  const { error } = await supabase
    .from('appointments')
    .insert({
      customer_id,
      service_id,
      start_time: start_time.toISOString(), // Salva em UTC no banco
      end_time: end_time.toISOString(),
      organizations_id,
      status: 'scheduled'
    } as any)

  if (error) return { error: error.message }

  revalidatePath('/agendamentos')
  return { success: true }
}