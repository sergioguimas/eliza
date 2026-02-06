'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendWhatsAppMessage } from "./send-whatsapp"

export async function handleAppointmentRequest(
  appointmentId: string, 
  action: 'confirmed' | 'canceled'
) {
  const supabase = await createClient()

  // 1. Atualiza o status no banco
  const { data: appointment, error } = await supabase
    .from('appointments')
    .update({ status: action })
    .eq('id', appointmentId)
    .select('*, customers(name, phone), services(title)')
    .single()

  if (error) return { error: "Erro ao processar solicitação." }

  // 2. Notifica o cliente via WhatsApp
  if (appointment?.customers?.phone) {
  const serviceTitle = appointment.services?.title || "procedimento";
  const customerName = appointment.customers.name || "Cliente";

  const message = action === 'confirmed' 
    ? `Olá ${customerName}, o seu agendamento para ${serviceTitle} foi confirmado!`
    : `Olá ${customerName}, infelizmente não conseguimos confirmar o seu horário para ${serviceTitle}. Por favor, entre em contato para escolher outro horário.`;
  
  await sendWhatsAppMessage({phone: appointment.customers.phone, message: message, organizationId: appointment.organization_id});
}

  revalidatePath('/dashboard')
  revalidatePath('/agendamentos')
  
  return { success: true }
}