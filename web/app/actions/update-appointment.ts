'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWhatsAppMessage } from './send-whatsapp'

export async function updateAppointment(formData: FormData) {
  const supabase = await createClient()

  const appointmentId = formData.get('id') as string
  const dateRaw = formData.get('date') as string
  const timeRaw = formData.get('time') as string
  const professionalId = formData.get('professional_id') as string
  
  const { data: currentAppointment } = await supabase
    .from('appointments')
    .select(`
      service_id, 
      services ( duration, name ),
      customers ( name, phone ),
      professionals ( name )
    `)
    .eq('id', appointmentId)
    .single()

  if (!currentAppointment) return { error: "Agendamento não encontrado" }
  // Calcula novos horários
  const newStartTime = new Date(`${dateRaw}T${timeRaw}:00`)
  const duration = currentAppointment.services?.duration_minutes || 30
  const newEndTime = new Date(newStartTime.getTime() + duration * 60000)

  // Atualiza no Banco
  const { error } = await (supabase.from('appointments') as any)
    .update({
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString(),
      professional_id: professionalId || undefined
    })
    .eq('id', appointmentId)

  if (error) return { error: 'Erro ao atualizar agendamento' }

  // Automação WhatsApp: Aviso de Mudança
  if (currentAppointment.customers?.phone) {
    const nomeCliente = currentAppointment.customers.name
    const nomeServico = currentAppointment.services?.title || "procedimento"
    
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