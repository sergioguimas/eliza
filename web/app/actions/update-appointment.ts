'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWhatsappMessage } from './send-whatsapp'

// Ajuste os tipos conforme necessário
export async function updateAppointment(formData: FormData) {
  const supabase = await createClient()

  const appointmentId = formData.get('id') as string
  const dateRaw = formData.get('date') as string
  const timeRaw = formData.get('time') as string
  
  // Vamos recalcular o start_time e end_time baseados na nova data/hora
  // Precisamos buscar a duração do serviço original
  const { data: currentAppointment } = await supabase
    .from('appointments')
    .select(`
      service_id, 
      services ( duration, name ),
      clients ( name, phone )
    `)
    .eq('id', appointmentId)
    .single()

  if (!currentAppointment) return { error: "Agendamento não encontrado" }

  // Monta a nova data
  const newStartTime = new Date(`${dateRaw}T${timeRaw}:00`)
  // @ts-ignore
  const duration = currentAppointment.services.duration || 30
  const newEndTime = new Date(newStartTime.getTime() + duration * 60000)

  // Atualiza no Banco
  const { error } = await supabase
    .from('appointments')
    .update({
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString()
    })
    .eq('id', appointmentId)

  if (error) return { error: 'Erro ao atualizar agendamento' }

  // 3. Automação WhatsApp: Aviso de Mudança 🚀
  // @ts-ignore
  if (currentAppointment.clients?.phone) {
    try {
      // @ts-ignore
      const nomeCliente = currentAppointment.clients.name
      // @ts-ignore
      const nomeServico = currentAppointment.services.name
      
      const dia = newStartTime.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const hora = newStartTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

      const message = `Olá ${nomeCliente}, atenção: Seu agendamento de *${nomeServico}* foi *alterado* para dia ${dia} às ${hora}.`
      
      // @ts-ignore
      await sendWhatsappMessage(currentAppointment.clients.phone, message)
      console.log("✅ Aviso de remarcação enviado!")

    } catch (err) {
      console.error("Erro zap update:", err)
    }
  }

  revalidatePath('/agendamentos')
  revalidatePath('/')
  return { success: true }
}