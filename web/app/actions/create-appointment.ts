'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendWhatsAppMessage } from "./send-whatsapp"
import { checkProfessionalAvailability } from "@/lib/appointment-config"
import { Database } from "@/utils/database.types"
import { sendAppointmentConfirmation } from './whatsapp-messages'

type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']

export async function createAppointment(formData: FormData) {
  const supabase = await createClient<Database>()

  // --- 1. EXTRAÇÃO DOS DADOS ---
  const organization_id = formData.get('organization_id') as string
  const rawProfessionalId = formData.get('professional_id') as string | null
  const professional_id =
    rawProfessionalId && rawProfessionalId !== '__unassigned__'
      ? rawProfessionalId
      : null

  const service_id = formData.get('service_id') as string
  const start_time_raw = formData.get('start_time') as string
  const notes = formData.get('notes') as string

  const payment_method = (formData.get('payment_method') as any) || null
  const payment_status = (formData.get('payment_status') as any) || 'pending'

  const is_public_booking = formData.get('source') === 'public'

  let customer_id = formData.get('customer_id') as string | null
  const customer_name = formData.get('customer_name') as string | null
  const customer_phone = formData.get('customer_phone') as string | null
  const customer_document = formData.get('customer_document') as string
  const customer_birth_date = formData.get('customer_birth_date') as string
  const customer_gender = formData.get('customer_gender') as string

  let customer_found_name = ""

  // --- 2. VALIDAÇÃO TÉCNICA ---
  if (!organization_id || !start_time_raw || !service_id) {
    return { error: "Dados incompletos para realizar o agendamento." }
  }

  // --- 3. LÓGICA DE CLIENTE ---
  if (!customer_id) {
    if (!customer_name || !customer_phone) {
      return { error: "Nome e telefone do paciente são obrigatórios." }
    }

    const { data: customerData, error: upsertError } = await supabase
      .from('customers')
      .upsert(
        {
          organization_id,
          name: customer_name,
          phone: customer_phone,
          document: customer_document,
          birth_date: customer_birth_date || null,
          gender: customer_gender || null,
          active: true
        },
        {
          onConflict: 'document',
          ignoreDuplicates: false
        }
      )
      .select('id, name')
      .single()

    if (upsertError || !customerData) {
      console.error("Erro Upsert:", upsertError)
      return { error: "Erro ao processar dados do paciente." }
    }

    customer_id = customerData.id
    customer_found_name = customerData.name
  }

  // --- 4. CÁLCULO DE TEMPO E PREÇO ---
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, price, title')
    .eq('id', service_id)
    .single()

  const duration_minutes = service?.duration_minutes || 30
  const price = service?.price || 0

  let timeString = start_time_raw.trim()
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(timeString)) {
    if (timeString.split('T')[1]?.length === 5) timeString += ':00'
    timeString += '-03:00'
  }

  const startTime = new Date(timeString)
  const endTime = new Date(startTime.getTime() + duration_minutes * 60000)

  // --- 5. VERIFICAÇÃO DE DISPONIBILIDADE ---
  if (professional_id) {
    const availability = await checkProfessionalAvailability(
      supabase,
      professional_id,
      startTime,
      endTime
    )

    if (!availability.available) {
      return { error: availability.message }
    }
  }

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
    status: is_public_booking ? 'pending' : 'scheduled'
  }

  const { data: newAppointment, error: insertError } = await supabase
    .from('appointments')
    .insert(appointmentData)
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23P01') {
      return { error: "Este horário acabou de ser ocupado. Por favor, escolha outro." }
    }

    console.error("Erro Supabase:", insertError)
    return { error: "Erro ao salvar agendamento." }
  }

  // --- 7. NOTIFICAÇÕES ---
  if (professional_id) {
    const { data: prof } = await supabase
      .from('professionals')
      .select('name, phone')
      .eq('id', professional_id)
      .single()

    if (prof?.phone) {
      const formattedDate = startTime.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      await sendWhatsAppMessage({
  const { data: prof } = await supabase
    .from('professionals')
    .select('name, phone')
    .eq('id', professional_id)
    .single()

  const notifications = [];

  if (prof?.phone) {
    const formattedDate = startTime.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    notifications.push(
      sendWhatsAppMessage({
        phone: prof.phone,
        message: `🔔 *Novo Pré-agendamento*\n\nProfissional: ${prof.name}\nCliente: ${customer_name}\nServiço: ${service?.title}\nHorário: ${formattedDate}`,
        organizationId: organization_id
      })
    }
  }

  revalidatePath('/agendamentos')

  return {
    success: true,
    id: newAppointment.id,
    foundName: customer_found_name !== customer_name ? customer_found_name : null
  }
}
    );
  }

  notifications.push(
    sendAppointmentConfirmation(newAppointment.id)
  );

  await Promise.allSettled(notifications);
  
  revalidatePath('/agendamentos')
  return { success: true, 
    id: newAppointment.id, 
    foundName: customer_found_name !== customer_name ? customer_found_name : null }
}
