'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { addMinutes } from "date-fns"

export async function updateAppointment(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const customerId = formData.get('customer_id') as string
  const serviceId = formData.get('service_id') as string
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  
  if (!id || !customerId || !serviceId || !date || !time) {
    return { error: "Todos os campos são obrigatórios." }
  }

  // 1. Buscar a duração do serviço
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single()

  if (!service) return { error: "Serviço inválido." }

  // 2. Montar as novas datas
  const startTime = new Date(`${date}T${time}`)
  const endTime = addMinutes(startTime, service.duration_minutes) 

  // 3. Atualizar no Banco
  const { error } = await supabase
    .from('appointments')
    .update({
      customer_id: customerId,
      service_id: serviceId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error(error)
    return { error: "Erro ao atualizar agendamento." }
  }

  revalidatePath('/')
  revalidatePath('/agendamentos')
  
  return { success: true }
}