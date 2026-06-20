"use server"

import { createClient } from "@/utils/supabase/server"

type AvailableSlotsReason =
  | "organization_closed_day"
  | "professional_unavailable_day"
  | "outside_business_hours"
  | "fully_booked"
  | "error"

type AvailableSlotsResult = {
  slots: string[]
  message?: string
  reason?: AvailableSlotsReason
}

const SAO_PAULO_OFFSET = "-03:00"

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number)
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function getSaoPauloDateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function getSaoPauloDayOfWeek(date: Date) {
  const dateOnly = getSaoPauloDateOnly(date)

  return new Date(`${dateOnly}T12:00:00`).getDay()
}

function overlapsRange(
  startMinutes: number,
  endMinutes: number,
  rangeStart: string | null,
  rangeEnd: string | null
) {
  if (!rangeStart || !rangeEnd) return false

  const rangeStartMinutes = timeToMinutes(rangeStart)
  const rangeEndMinutes = timeToMinutes(rangeEnd)

  return startMinutes < rangeEndMinutes && endMinutes > rangeStartMinutes
}

export async function getAvailableSlots(
  professionalId: string,
  date: Date,
  organizationId: string
): Promise<AvailableSlotsResult> {
  const supabase = await createClient()

  const dayOfWeek = getSaoPauloDayOfWeek(date)
  const dateOnly = getSaoPauloDateOnly(date)

  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select(`
      days_of_week,
      open_hours_start,
      open_hours_end,
      lunch_start,
      lunch_end,
      appointment_duration
    `)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (settingsError) {
    console.error("[getAvailableSlots:settings]", settingsError)

    return {
      slots: [],
      reason: "error",
      message: "Erro ao carregar configurações de expediente.",
    }
  }

  const organizationWorkingDays = settings?.days_of_week || []

  if (
    Array.isArray(organizationWorkingDays) &&
    organizationWorkingDays.length > 0 &&
    !organizationWorkingDays.includes(dayOfWeek)
  ) {
    return {
      slots: [],
      reason: "organization_closed_day",
      message: "Este dia não está disponível para agendamentos.",
    }
  }

  const { data: availability, error: availabilityError } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle()

  if (availabilityError) {
    console.error("[getAvailableSlots:availability]", availabilityError)

    return {
      slots: [],
      reason: "error",
      message: "Erro ao carregar disponibilidade do profissional.",
    }
  }

  if (!availability) {
    return {
      slots: [],
      reason: "professional_unavailable_day",
      message: "O profissional não possui expediente configurado para este dia.",
    }
  }

  const appointmentDuration = settings?.appointment_duration || 30

  const organizationStart = settings?.open_hours_start
    ? timeToMinutes(settings.open_hours_start)
    : timeToMinutes(availability.start_time)

  const organizationEnd = settings?.open_hours_end
    ? timeToMinutes(settings.open_hours_end)
    : timeToMinutes(availability.end_time)

  const professionalStart = timeToMinutes(availability.start_time)
  const professionalEnd = timeToMinutes(availability.end_time)

  const workStart = Math.max(organizationStart, professionalStart)
  const workEnd = Math.min(organizationEnd, professionalEnd)

  if (workStart >= workEnd) {
    return {
      slots: [],
      reason: "outside_business_hours",
      message: "Não há expediente disponível para este profissional neste dia.",
    }
  }

  const dayStart = new Date(`${dateOnly}T00:00:00.000${SAO_PAULO_OFFSET}`).toISOString()
  const dayEnd = new Date(`${dateOnly}T23:59:59.999${SAO_PAULO_OFFSET}`).toISOString()

  const { data: existingAppointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("start_time, end_time")
    .eq("professional_id", professionalId)
    .neq("status", "canceled")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd)

  if (appointmentsError) {
    console.error("[getAvailableSlots:appointments]", appointmentsError)

    return {
      slots: [],
      reason: "error",
      message: "Erro ao verificar horários ocupados.",
    }
  }

  const slots: string[] = []

  for (
    let current = workStart;
    current + appointmentDuration <= workEnd;
    current += appointmentDuration
  ) {
    const end = current + appointmentDuration
    const slotString = minutesToTime(current)

    const isInOrganizationLunch = overlapsRange(
      current,
      end,
      settings?.lunch_start || null,
      settings?.lunch_end || null
    )

    const isInProfessionalBreak = overlapsRange(
      current,
      end,
      availability.break_start || null,
      availability.break_end || null
    )

    const isOccupied = existingAppointments?.some((appointment) => {
      const appointmentStart = new Date(appointment.start_time).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })

      const appointmentEnd = new Date(appointment.end_time).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })

      const appointmentStartMinutes = timeToMinutes(appointmentStart)
      const appointmentEndMinutes = timeToMinutes(appointmentEnd)

      return current < appointmentEndMinutes && end > appointmentStartMinutes
    })

    if (!isInOrganizationLunch && !isInProfessionalBreak && !isOccupied) {
      slots.push(slotString)
    }
  }

  if (slots.length === 0) {
    return {
      slots: [],
      reason: "fully_booked",
      message:
        "Não há horários disponíveis neste dia. Pode ser intervalo, agenda cheia ou ausência de expediente livre.",
    }
  }

  return {
    slots,
  }
}