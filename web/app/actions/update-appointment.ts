'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWhatsAppMessage } from './send-whatsapp'
import { Database } from "@/utils/database.types"
import { horaLocalParaUtc } from "@/lib/domain/tempo"

type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"]

export async function updateAppointment(formData: FormData) {
  const supabase = await createClient<Database>()

  const appointmentId =
    (formData.get('appointment_id') as string) || (formData.get('id') as string)
  const dateRaw = formData.get('date') as string
  const timeRaw = formData.get('time') as string
  const professionalId = formData.get('professional_id') as string
  const serviceId = formData.get('service_id') as string
  const notes = (formData.get('notes') as string) || null

  if (!appointmentId || !dateRaw || !timeRaw) {
    return { error: "Dados incompletos para atualizar o agendamento." }
  }
  
  const { data: currentAppointment } = await supabase
    .from('appointments')
    .select(`
      professional_id,
      service_id, 
      services ( duration_minutes, title ),
      customers ( name, phone ),
      professionals ( name ),
      organization_id
    `)
    .eq('id', appointmentId)
    .single()

  if (!currentAppointment) return { error: "Agendamento não encontrado" }

  const effectiveServiceId = serviceId || currentAppointment.service_id
  let service = currentAppointment.services

  if (effectiveServiceId && effectiveServiceId !== currentAppointment.service_id) {
    const { data: selectedService } = await supabase
      .from('services')
      .select('duration_minutes, title')
      .eq('id', effectiveServiceId)
      .eq('organization_id', currentAppointment.organization_id)
      .single()

    if (selectedService) {
      service = selectedService
    }
  }

  let newStartTime: Date

  try {
    newStartTime = horaLocalParaUtc(`${dateRaw}T${timeRaw}:00`)
  } catch {
    return { error: "Horário do agendamento inválido." }
  }

  const duration = service?.duration_minutes || 30
  const newEndTime = new Date(newStartTime.getTime() + duration * 60000)
  const updateData: AppointmentUpdate = {
    start_time: newStartTime.toISOString(),
    end_time: newEndTime.toISOString(),
    notes,
  }

  if (professionalId) {
    updateData.professional_id = professionalId
  }

  if (effectiveServiceId) {
    updateData.service_id = effectiveServiceId
  }

  // Atualiza no Banco
  const { error } = await (supabase.from('appointments'))
    .update(updateData)
    .eq('id', appointmentId)

  if (error) return { error: 'Erro ao atualizar agendamento' }

  // Automação WhatsApp: Aviso de Mudança
  if (currentAppointment.customers?.phone) {
    const nomeCliente = currentAppointment.customers.name
    const nomeServico = service?.title || "atendimento"
    
    const dia = newStartTime.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const hora = newStartTime.toLocaleTimeString('pt-BR', { 
      timeZone: 'America/Sao_Paulo', 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    const message = `Olá ${nomeCliente}, atenção: Seu agendamento de *${nomeServico}* foi *alterado* para dia ${dia} às ${hora}.`
    
    await sendWhatsAppMessage({
      phone: currentAppointment.customers.phone,
      message: message,
      organizationId: currentAppointment.organization_id
    })
  }

  revalidatePath('/agendamentos')
  revalidatePath('/')
  return { success: true }
}
