import {
  Clock,
  CheckCircle2,
  UserCheck,
  XCircle,
  PlayCircle,
  MessageCircleWarningIcon,
} from "lucide-react"

export const STATUS_CONFIG: Record<
  string,
  {
    label: string
    color: string
    icon: any
  }
> = {
  pending: {
    label: "Pendente",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    icon: MessageCircleWarningIcon,
  },
  scheduled: {
    label: "Agendado",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    icon: UserCheck,
  },
  arrived: {
    label: "Chegou",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    icon: PlayCircle,
  },
  completed: {
    label: "Finalizado",
    color: "bg-zinc-800 border-zinc-700 text-zinc-400",
    icon: CheckCircle2,
  },
  canceled: {
    label: "Cancelado",
    color: "bg-red-500/10 border-red-500/20 text-red-400",
    icon: XCircle,
  },
}

const APP_TIMEZONE = "America/Sao_Paulo"

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number)
  return hours * 60 + minutes
}

function getLocalDayOfWeek(date: Date) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

  return new Date(`${localDate}T12:00:00`).getDay()
}

function getLocalTimeString(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

export async function checkProfessionalAvailability(
  supabase: any,
  professionalId: string,
  startTime: Date,
  endTime: Date
) {
  const dayOfWeek = getLocalDayOfWeek(startTime)

  const startTimeString = getLocalTimeString(startTime)
  const endTimeString = getLocalTimeString(endTime)

  const { data: profAvail, error: profAvailError } = await supabase
    .from("professional_availability")
    .select("*")
    .eq("professional_id", professionalId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle()

  if (profAvailError) {
    console.error("Erro ao buscar disponibilidade:", profAvailError)

    return {
      available: false,
      message: "Erro ao validar disponibilidade do profissional.",
    }
  }

  if (!profAvail) {
    return {
      available: false,
      message: "O profissional não possui horário configurado para este dia.",
    }
  }

  const selectedStartMinutes = timeToMinutes(startTimeString)
  const selectedEndMinutes = timeToMinutes(endTimeString)

  const workStartMinutes = timeToMinutes(profAvail.start_time)
  const workEndMinutes = timeToMinutes(profAvail.end_time)

  if (selectedStartMinutes < workStartMinutes) {
    return {
      available: false,
      message: "O horário inicial está antes do início do atendimento do profissional.",
    }
  }

  if (selectedEndMinutes > workEndMinutes) {
    return {
      available: false,
      message: "O horário final está após o fim do atendimento do profissional.",
    }
  }

  if (selectedStartMinutes >= workEndMinutes) {
    return {
      available: false,
      message: "O horário inicial está fora do horário de atendimento do profissional.",
    }
  }

  if (selectedEndMinutes <= workStartMinutes) {
    return {
      available: false,
      message: "O horário final está fora do horário de atendimento do profissional.",
    }
  }

  if (selectedEndMinutes <= selectedStartMinutes) {
    return {
      available: false,
      message: "O horário final precisa ser maior que o horário inicial.",
    }
  }

  if (profAvail.break_start && profAvail.break_end) {
    const breakStartMinutes = timeToMinutes(profAvail.break_start)
    const breakEndMinutes = timeToMinutes(profAvail.break_end)

    const overlapsBreak =
      selectedStartMinutes < breakEndMinutes &&
      selectedEndMinutes > breakStartMinutes

    if (overlapsBreak) {
      return {
        available: false,
        message: "Este horário está dentro do intervalo de atendimento.",
      }
    }
  }

  return { available: true }
}

export function generateTimeSlots(start: string, end: string, interval: number) {
  const slots = []
  let current = new Date(`2026-01-01T${start}`)
  const stop = new Date(`2026-01-01T${end}`)

  while (current < stop) {
    slots.push(current.toTimeString().slice(0, 5))
    current = new Date(current.getTime() + interval * 60000)
  }

  return slots
}

export async function checkOrganizationBusinessHours(
  supabase: any,
  organizationId: string,
  startTime: Date,
  endTime: Date
) {
  const dayOfWeek = getLocalDayOfWeek(startTime)

  const startTimeString = getLocalTimeString(startTime)
  const endTimeString = getLocalTimeString(endTime)

  const { data: settings, error } = await supabase
    .from("organization_settings")
    .select(`
      days_of_week,
      open_hours_start,
      open_hours_end,
      lunch_start,
      lunch_end
    `)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error("[checkOrganizationBusinessHours]", error)

    return {
      available: false,
      message: "Erro ao validar expediente da organização.",
    }
  }

  if (!settings) {
    return { available: true }
  }

  const workingDays = settings.days_of_week || []

  if (
    Array.isArray(workingDays) &&
    workingDays.length > 0 &&
    !workingDays.includes(dayOfWeek)
  ) {
    return {
      available: false,
      message: "Este dia não está disponível para agendamentos.",
    }
  }

  const selectedStartMinutes = timeToMinutes(startTimeString)
  const selectedEndMinutes = timeToMinutes(endTimeString)

  if (selectedEndMinutes <= selectedStartMinutes) {
    return {
      available: false,
      message: "O horário final precisa ser maior que o horário inicial.",
    }
  }

  if (settings.open_hours_start && settings.open_hours_end) {
    const openStartMinutes = timeToMinutes(settings.open_hours_start)
    const openEndMinutes = timeToMinutes(settings.open_hours_end)

    if (
      selectedStartMinutes < openStartMinutes ||
      selectedEndMinutes > openEndMinutes
    ) {
      return {
        available: false,
        message: "Este horário está fora do expediente.",
      }
    }
  }

  if (settings.lunch_start && settings.lunch_end) {
    const lunchStartMinutes = timeToMinutes(settings.lunch_start)
    const lunchEndMinutes = timeToMinutes(settings.lunch_end)

    const overlapsLunch =
      selectedStartMinutes < lunchEndMinutes &&
      selectedEndMinutes > lunchStartMinutes

    if (overlapsLunch) {
      return {
        available: false,
        message: "Este horário está dentro do intervalo de atendimento.",
      }
    }
  }

  return { available: true }
}