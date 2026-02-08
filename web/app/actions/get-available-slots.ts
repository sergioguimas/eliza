'use server'

import { createClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { addMinutes, format, parseISO, startOfDay, endOfDay } from "date-fns"

export async function getAvailableSlots(
  professionalId: string,
  date: Date,
  organizationId: string
) {
  const supabase = await createClient()
  const dayOfWeek = date.getDay() // 0 (Domingo) a 6 (Sábado)

  // 1. Buscar a regra de disponibilidade do profissional para este dia da semana
  const { data: availability } = await supabase
    .from('professional_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (!availability) return [] // Médico não trabalha neste dia

  // 2. Buscar agendamentos já existentes para este profissional neste dia
  const dayStart = startOfDay(date).toISOString()
  const dayEnd = endOfDay(date).toISOString()

  const { data: existingAppointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .neq('status', 'canceled') // Ignora cancelados
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)

  // 3. Gerar os slots baseados no horário de início e fim
  const slots: string[] = []
  let currentTime = new Date(`${format(date, 'yyyy-MM-dd')}T${availability.start_time}`)
  const endTime = new Date(`${format(date, 'yyyy-MM-dd')}T${availability.end_time}`)
  
  // Intervalo padrão de 30 minutos (pode ser buscado na organization_settings se preferir)
  const { data: interval } = await supabase
    .from('organization_settings')
    .select('appointment_duration')
    .eq('organization_id', organizationId)
    .single() 

  while (currentTime < endTime) {
    const slotString = format(currentTime, 'HH:mm')

    // 1. Verificação de Intervalo (Break)
    let isInBreak = false;

    if (availability.break_start && availability.break_end) {
    // Normaliza para garantir que estamos comparando apenas HH:mm
    const breakStart = availability.break_start.slice(0, 5);
    const breakEnd = availability.break_end.slice(0, 5);
    const currentSlot = slotString.slice(0, 5);
        // Regra: Bloqueia se estiver entre o início (inclusive) e o fim (exclusive)
        if (currentSlot >= breakStart && currentSlot < breakEnd) {
            isInBreak = true;
        }
    }

    // 2. Verificação de Ocupação (Existing Appointments)
    const isOccupied = existingAppointments?.some(appt => {
        const apptStart = format(parseISO(appt.start_time), 'HH:mm')
        const apptEnd = format(parseISO(appt.end_time), 'HH:mm')
        return slotString >= apptStart && slotString < apptEnd
    })

    // Só adiciona se não for intervalo E não estiver ocupado
    if (!isInBreak && !isOccupied) {
    slots.push(slotString)
    }

    currentTime = addMinutes(currentTime, interval?.appointment_duration || 30)
  }

  return slots
}