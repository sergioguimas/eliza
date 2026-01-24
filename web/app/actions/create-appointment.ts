'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendAppointmentConfirmation } from "./whatsapp-messages"

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
  let duration_minutes = 30 
  let price = 0

  if (service_id) {
    const { data: service } = await supabase
        .from('services')
        .select('duration_minutes, price')
        .eq('id', service_id)
        .single()
    
    if (service) {
        duration_minutes = service.duration_minutes || 30
        price = service.price || 0
    }
  }

  // 👇 CORREÇÃO DE DATA "BLINDADA"
  // Objetivo: Transformar o input em uma data válida no fuso -03:00 (Brasil)
  let timeString = start_time_raw.trim()

  // Verifica se a string JÁ TEM informação de fuso (Z, +00:00, -03:00)
  // Regex: Procura por Z ou +XX:XX ou -XX:XX no final da string
  const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(timeString)

  if (!hasOffset) {
      // Se não tem fuso, vamos tratar para adicionar o do Brasil (-03:00)
      
      // Verifica se TEM SEGUNDOS (formato HH:mm:ss) ou só HH:mm
      // O input type="datetime-local" padrão envia "YYYY-MM-DDTHH:mm" (16 chars)
      const parts = timeString.split('T')
      if (parts[1] && parts[1].length === 5) { 
          // Se for só HH:mm, adicionamos :00 para ficar padrão ISO
          timeString += ':00'
      }
      
      // Adiciona o offset do Brasil
      timeString += '-03:00'
  }

  const startTime = new Date(timeString)

  // 🚨 VERIFICAÇÃO DE SEGURANÇA (Evita o erro "Invalid time value")
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
    .lt('start_time', endTime.toISOString()) // Aqui não vai mais quebrar
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
  try {
    if (sendAppointmentConfirmation) {
      await sendAppointmentConfirmation(appointmentId)
    }
  } catch (err) {
    console.error("Erro ao enviar zap:", err)
  }

  revalidatePath('/agendamentos')
  return { success: true }
}