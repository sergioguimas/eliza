'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { sendWhatsAppMessage } from "./send-whatsapp"

// Tipagem rigorosa baseada no Schema que corrigimos
type AppointmentStatus = Database['public']['Tables']['appointments']['Row']['status']

export async function handleAppointmentRequest(
  appointmentId: string, 
  action: 'confirm' | 'reject'
) {
  // Usamos o cliente padrão que respeita o RLS (apenas o dono da org ou o médico pode alterar)
  const supabase = await createClient()

  // 1. Determinar o novo status
  const newStatus: AppointmentStatus = action === 'confirm' ? 'confirmed' : 'canceled'

  // 2. Atualizar o agendamento
  // O join no 'select' permite-nos obter os dados para o WhatsApp numa única viagem ao banco
  const { data: appointment, error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)
    .select(`
      *,
      customers (name, phone),
      services (title),
      organizations (name)
    `)
    .single()

  if (error) {
    console.error("Erro ao processar agendamento:", error)
    return { error: "Não foi possível atualizar o status do agendamento." }
  }

  // 3. Disparar Notificação WhatsApp (Fluxo de Feedback ao Paciente)
  if (appointment?.customers?.phone) {
    const customerName = appointment.customers.name
    const serviceTitle = appointment.services?.title || "serviço"
    const orgName = appointment.organizations?.name || "nossa clínica"

    const message = action === 'confirm'
      ? `✅ *Agendamento Confirmado!*\n\nOlá ${customerName}, o seu horário para *${serviceTitle}* em *${orgName}* foi aprovado com sucesso. Esperamos por si!`
      : `❌ *Atualização de Agendamento*\n\nOlá ${customerName}, infelizmente não conseguimos confirmar o seu pedido de horário para *${serviceTitle}* em *${orgName}*. Por favor, entre em contacto para sugerirmos uma nova data.`

    try {
      await sendWhatsAppMessage({
        phone: appointment.customers.phone,
        message,
        organizationId: appointment.organization_id
      })
    } catch (wsError) {
      // Logamos o erro mas não travamos a UI, pois o status no banco já mudou
      console.error("Erro ao enviar WhatsApp de confirmação:", wsError)
    }
  }

  // Revalida a página de agendamentos e a dashboard para atualizar as listas
  revalidatePath('/agendamentos')
  revalidatePath('/dashboard')
  
  return { success: true }
}