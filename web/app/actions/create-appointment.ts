'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  // --- 1. EXTRAÇÃO DOS DADOS ---
  const organization_id = formData.get('organization_id') as string
  const professional_id = formData.get('professional_id') as string
  const start_time_raw = formData.get('start_time') as string
  const notes = formData.get('notes') as string
  
  // Dados opcionais / condicionais
  let customer_id = formData.get('customer_id') as string | null
  const customer_name = formData.get('customer_name') as string | null
  const customer_phone = formData.get('customer_phone') as string | null
  const service_id = formData.get('service_id') as string | null

  // --- 2. VALIDAÇÃO TÉCNICA ---
  if (!organization_id || !start_time_raw || !professional_id) {
    return { error: "Erro interno: Dados de identificação incompletos." }
  }

  // --- 3. LÓGICA DE CLIENTE (NOVO vs EXISTENTE) ---
  if (!customer_id) {
    if (!customer_name) {
        return { error: "Selecione um paciente ou digite o nome." }
    }

    // Cria o cliente no banco
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

  // --- 4. CÁLCULO DE TEMPO ---
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

  const startTime = new Date(start_time_raw)
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

  // --- 6. CRIAÇÃO DO AGENDAMENTO ---
  const { error: insertError } = await supabase
    .from('appointments')
    .insert({
        organization_id,
        customer_id,
        professional_id,
        service_id: service_id || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes,
        status: 'scheduled',
        price
    })

  if (insertError) {
    console.error("Erro Supabase:", insertError)
    return { error: "Erro ao salvar agendamento." }
  }

  revalidatePath('/agendamentos')
  return { success: true }
}