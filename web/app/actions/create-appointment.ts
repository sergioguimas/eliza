'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendWhatsAppMessage } from "./send-whatsapp"
import { checkProfessionalAvailability } from "@/lib/appointment-config"
import { Database } from "@/utils/database.types"

// Tipagem baseada no banco gerado
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  // --- 1. EXTRAÇÃO DOS DADOS ---
  const organization_id = formData.get('organization_id') as string
  const professional_id = formData.get('professional_id') as string
  const service_id = formData.get('service_id') as string
  const start_time_raw = formData.get('start_time') as string
  const notes = formData.get('notes') as string
  
  // Campos financeiros
  const payment_method = formData.get('payment_method') as any || null
  const payment_status = formData.get('payment_status') as any || 'pending'
  
  // Controle de Origem
  const is_public_booking = formData.get('source') === 'public'
  
  let customer_id = formData.get('customer_id') as string | null
  const customer_name = formData.get('customer_name') as string | null
  const customer_phone = formData.get('customer_phone') as string | null

  // --- 2. VALIDAÇÃO TÉCNICA ---
  if (!organization_id || !start_time_raw || !professional_id || !service_id) {
    return { error: "Dados incompletos para realizar o agendamento." }
  }

  // --- 3. LÓGICA DE CLIENTE ---
  if (!customer_id) {
    if (!customer_name || !customer_phone) {
        return { error: "Nome e telefone do paciente são obrigatórios." }
    }

    const { data: newCustomer, error: createError } = await supabase
        .from('customers')
        .insert({
            organization_id,
            name: customer_name,
            phone: customer_phone,
            active: true
        })
        .select('id')
        .single()

    if (createError || !newCustomer) return { error: "Erro ao cadastrar novo paciente." }
    customer_id = newCustomer.id
  }

  // --- 4. CÁLCULO DE TEMPO E PREÇO ---
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, price, title')
    .eq('id', service_id)
    .single()

  const duration_minutes = service?.duration_minutes || 30
  const price = service?.price || 0

  // Tratamento de fuso horário brasileiro (GMT-3)
  let timeString = start_time_raw.trim()
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(timeString)) {
      if (timeString.split('T')[1]?.length === 5) timeString += ':00'
      timeString += '-03:00'
  }
  const startTime = new Date(timeString)
  const endTime = new Date(startTime.getTime() + duration_minutes * 60000)

  // --- 5. VERIFICAÇÃO DE DISPONIBILIDADE ---
  // Verifica se o médico trabalha nesse horário (Availability)
  const availability = await checkProfessionalAvailability(supabase, professional_id, startTime, endTime);
  if (!availability.available) return { error: availability.message };

  // --- 6. SALVAR NO BANCO ---
  const appointmentData: AppointmentInsert = {
    organization_id,
    customer_id,
    professional_id,
    service_id,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    notes,
    price,
    payment_method,
    payment_status,
    // Se for público, entra como 'pending' (pré-agendamento), se for interno, 'scheduled'
    status: is_public_booking ? 'pending' : 'scheduled' 
  }

  const { data: newAppointment, error: insertError } = await supabase
    .from('appointments')
    .insert(appointmentData)
    .select('id')
    .single()

  // TRATAMENTO DE CONFLITO VIA DATABASE CONSTRAINT (Erro 23P01)
  if (insertError) {
    if (insertError.code === '23P01') {
      return { error: "Este horário acabou de ser ocupado. Por favor, escolha outro." }
    }
    console.error("Erro Supabase:", insertError)
    return { error: "Erro ao salvar agendamento." }
  }

  // --- 7. NOTIFICAÇÕES ---
  const { data: prof } = await supabase
    .from('professionals')
    .select('name, phone')
    .eq('id', professional_id)
    .single()

  if (prof?.phone) {
    await sendWhatsAppMessage({
      phone: prof.phone,
      message: `🔔 *Novo Pré-agendamento*\n\nProfissional: ${prof.name}\nCliente: ${customer_name || 'Cliente'}\nServiço: \nHorário: ${startTime.toLocaleString('pt-BR')}`,
      organizationId: organization_id
    })
  }
  
  revalidatePath('/agendamentos')
  return { success: true, id: newAppointment.id }
}