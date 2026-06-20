'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWhatsAppMessage } from './send-whatsapp'
import { Database } from "@/utils/database.types"

const TIME_ZONE = "America/Sao_Paulo"

type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"]

function getDatePartsInTimeZone(date: Date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value
    return Number(value)
  }

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone = TIME_ZONE) {
  const parts = getDatePartsInTimeZone(date, timeZone)

  const utcFromTimeZoneParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return utcFromTimeZoneParts - date.getTime()
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = TIME_ZONE
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)

  return new Date(utcGuess.getTime() - offset)
}

function parseSaoPauloWallTimeToUtc(rawValue: string) {
  const match = rawValue.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/
  )

  if (!match) {
    throw new Error("Formato de data/hora inválido.")
  }

  const [, year, month, day, hour, minute] = match.map(Number)

  return zonedDateTimeToUtc(year, month, day, hour, minute)
}

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

  const newStartTime = parseSaoPauloWallTimeToUtc(`${dateRaw}T${timeRaw}:00`)
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
