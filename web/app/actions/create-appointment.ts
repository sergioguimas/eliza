'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendAppointmentConfirmation } from "./whatsapp-messages"
import { sendWhatsAppMessage } from "./send-whatsapp"

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  // --- 1. EXTRAÇÃO DOS DADOS ---
  const organization_id = formData.get('organization_id') as string
  const professional_id = formData.get('professional_id') as string
  const start_time_raw = formData.get('start_time') as string
  const notes = formData.get('notes') as string
  
  let customer_id = formData.get('customer_id') as string | null
  const customer_name = formData.get('customer_name') as string | null
  const customer_phone = formData.get('customer_phone') as string | null
  const service_id = formData.get('service_id') as string | null

  // --- 2. VALIDAÇÃO TÉCNICA ---
  if (!organization_id || !start_time_raw || !professional_id) {
    return { error: "Erro interno: Dados de identificação incompletos." }
  }

  // --- 3. LÓGICA DE CLIENTE ---
  if (!customer_id) {
    if (!customer_name) {
        return { error: "Selecione um paciente ou digite o nome." }
    }

    const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
            organization_id,
            name: customer_name,
            phone: customer_phone,
            active: true
        } as any)
        .select('id')
        .single()

    if (createError || !newCustomer) {
        console.error("Erro ao criar cliente:", createError)
        return { error: "Erro ao cadastrar novo paciente." }
    }

    customer_id = newCustomer.id
  }

  // --- 4. CÁLCULO DE TEMPO E PREÇO ---
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, price, title')
    .eq('id', service_id as string)
    .single()

  // Definição das variáveis de apoio
  const duration_minutes = service?.duration_minutes || 30
  const price = service?.price || 0
  const serviceTitle = service?.title || "serviço"

  let timeString = start_time_raw.trim()

  // Verifica se a string JÁ TEM informação de fuso
  const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(timeString)

  if (!hasOffset) {      
      // Verifica se TEM SEGUNDOS (formato HH:mm:ss) ou só HH:mm
      const parts = timeString.split('T')
      if (parts[1] && parts[1].length === 5) { 
          // Se for só HH:mm, adiciona :00 para ficar padrão ISO
          timeString += ':00'
      }
      
      // Adiciona o offset do Brasil
      timeString += '-03:00'
  }

  const startTime = new Date(timeString)

  // VERIFICAÇÃO DE SEGURANÇA
  if (isNaN(startTime.getTime())) {
      console.error("Data inválida recebida:", start_time_raw, "Tentativa de correção:", timeString)
      return { error: "Data inválida. Por favor verifique o formato." }
  }

  const endTime = new Date(startTime.getTime() + duration_minutes * 60000)

  // --- 5. VERIFICAÇÃO DE CONFLITO ---
  const { data: conflicts } = await supabase
    .from('appointments')
    .select('id')
    .eq('organization_id', organization_id)
    .eq('professional_id', professional_id)
    .neq('status', 'canceled')
    .lt('start_time', endTime.toISOString())
    .gt('end_time', startTime.toISOString())

  if (conflicts && conflicts.length > 0) {
    return { error: "Este horário já está ocupado para este profissional." }
  }

  // --- 6. SALVAR NO BANCO ---
  const { data: newAppointment, error: insertError } = await supabase
    .from('appointments')
    .insert({
        organization_id,
        customer_id,
        professional_id,
        service_id: service_id || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes,
        status: 'pending', 
        price
    })
    .select('id')
    .single()

  if (insertError || !newAppointment) {
    console.error("Erro Supabase:", insertError)
    return { error: "Erro ao salvar agendamento." }
  }

  const appointmentId = newAppointment.id

  // --- 7. DISPARO WHATSAPP ---
  const { data: prof } = await supabase
    .from('professionals')
    .select('name, phone')
    .eq('id', professional_id)
    .single()

  if (prof?.phone) {
    await sendWhatsAppMessage({
      phone: prof.phone,
      message: `🔔 *Novo Pré-agendamento*\n\nProfissional: ${prof.name}\nCliente: ${customer_name || 'Cliente'}\nServiço: ${serviceTitle}\nHorário: ${startTime.toLocaleString('pt-BR')}`,
      organizationId: organization_id
    })
  }

  revalidatePath('/agendamentos')
  return { success: true, id: newAppointment.id }
}