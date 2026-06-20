import { createClient } from "@supabase/supabase-js"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { Database } from "@/utils/database.types"

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TZ = "America/Sao_Paulo"

// Altere aqui caso queira o resumo em outro horário.
const DOCTOR_DAILY_SUMMARY_HOUR = 7

function getDatePartsInTimeZone(date: Date, timeZone = TZ) {
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

function getTimeZoneOffsetMs(date: Date, timeZone = TZ) {
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

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
  timeZone = TZ
) {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  )

  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)

  return new Date(utcGuess.getTime() - offset)
}

function getTodayRangeInTimeZone(date: Date, timeZone = TZ) {
  const parts = getDatePartsInTimeZone(date, timeZone)

  const start = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    0,
    0,
    0,
    0,
    timeZone
  )

  const end = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    23,
    59,
    59,
    999,
    timeZone
  )

  return { start, end }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  })
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    timeZone: TZ,
  })
}

function render(
  template: string | null | undefined,
  vars: Record<string, any>
) {
  if (!template) return null

  return template.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, key) => {
    return vars[key] ?? ""
  })
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function processDoctorDailySummaries() {
  const now = new Date()
  const nowPartsSP = getDatePartsInTimeZone(now)

  if (nowPartsSP.hour !== DOCTOR_DAILY_SUMMARY_HOUR) {
    return {
      skipped: true,
      reason: "outside_summary_hour",
      currentHourSP: nowPartsSP.hour,
      expectedHourSP: DOCTOR_DAILY_SUMMARY_HOUR,
    }
  }

  const { start: startDay, end: endDay } = getTodayRangeInTimeZone(now)

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(`
      id,
      organization_id,
      start_time,
      reminder_morning_sent_at,
      professional:professionals(name, phone),
      customer:customers(name),
      settings:organization_settings(msg_doctor_daily_summary)
    `)
    .gte("start_time", startDay.toISOString())
    .lte("start_time", endDay.toISOString())
    .in("status", ["scheduled", "confirmed"])

  if (error) {
    console.error("🔥 [CRON] Erro ao buscar agenda dos profissionais:", error)
    throw error
  }

  if (!appointments?.length) {
    return {
      sent: 0,
      startDay: startDay.toISOString(),
      endDay: endDay.toISOString(),
    }
  }

  const grouped: Record<string, any[]> = {}

  for (const appt of appointments) {
    if (appt.reminder_morning_sent_at) continue

    const professional = normalizeRelation(appt.professional)
    if (!professional?.phone) continue

    const key = `${appt.organization_id}-${professional.phone}`

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(appt)
  }

  let sent = 0

  for (const key in grouped) {
    const list = grouped[key]

    const firstAppointment = list[0]
    const orgId = firstAppointment.organization_id

    const professional = normalizeRelation(firstAppointment.professional)
    const phone = professional?.phone

    if (!phone) continue

    const lines = list.map((appointment) => {
      const customer = normalizeRelation(appointment.customer)

      return `${formatTime(new Date(appointment.start_time))} - ${
        customer?.name ?? "Cliente não informado"
      }`
    })

    const settings = normalizeRelation(firstAppointment.settings)
    const template = settings?.msg_doctor_daily_summary
    const professionalName = professional?.name ?? "profissional"
    const appointmentsText = lines.join("\n")

    const message =
      render(template, {
        name: professionalName,
        date: formatDate(now),
        appointments: appointmentsText,
        agenda: appointmentsText,
        count: list.length,
      }) ||
      `Bom dia, ${professionalName}!\n\nSua agenda de hoje:\n\n${appointmentsText}\n\nTotal: ${list.length} atendimento(s).`

    const result = await sendWhatsAppMessage({
      phone,
      message,
      organizationId: orgId,
    })

    if (!result.success) {
      console.error("🔥 [CRON] Falha ao enviar resumo diário:", {
        organizationId: orgId,
        phone,
        result,
      })

      continue
    }

    const ids = list.map((appointment) => appointment.id)

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ reminder_morning_sent_at: now.toISOString() })
      .in("id", ids)

    if (updateError) {
      console.error("🔥 [CRON] Erro ao marcar resumo como enviado:", updateError)
      throw updateError
    }

    sent++
  }

  return {
    sent,
    startDay: startDay.toISOString(),
    endDay: endDay.toISOString(),
  }
}

export async function processPatientMorningReminders() {
  const now = new Date()
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000)

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(`
      id,
      organization_id,
      start_time,
      reminder_sent_at,
      customer:customers(name, phone),
      professional:professionals(name),
      service:services(title)
    `)
    .gte("start_time", now.toISOString())
    .lte("start_time", nextHour.toISOString())
    .in("status", ["scheduled", "confirmed"])
    .is("reminder_sent_at", null)

  if (error) {
    console.error("🔥 [CRON] Erro ao buscar lembretes dos pacientes:", error)
    throw error
  }

  if (!appointments?.length) {
    return {
      sent: 0,
      start: now.toISOString(),
      end: nextHour.toISOString(),
    }
  }

  let sent = 0

  const orgIds = [...new Set(appointments.map((a) => a.organization_id))]

  const { data: settingsRows, error: settingsError } = await supabase
    .from("organization_settings")
    .select("organization_id, msg_appointment_reminder")
    .in("organization_id", orgIds)

  if (settingsError) {
    console.error("🔥 [CRON] Erro ao buscar configurações:", settingsError)
    throw settingsError
  }

  const settingsByOrg = new Map(
    (settingsRows || []).map((s) => [s.organization_id, s])
  )

  for (const appt of appointments) {
    const customer = normalizeRelation(appt.customer)
    const professional = normalizeRelation(appt.professional)
    const service = normalizeRelation(appt.service)

    if (!customer?.phone) continue
    if (!professional || !customer || !service) continue

    const settings = settingsByOrg.get(appt.organization_id)
    const template = settings?.msg_appointment_reminder

    const appointmentDate = new Date(appt.start_time)

    const date = formatDate(appointmentDate)
    const time = formatTime(appointmentDate)

    const message =
      render(template, {
        name: customer.name,
        service: service.title,
        date,
        time,
        professional: professional.name,
      }) ||
      `⏰ Lembrete: ${service.title} às ${time}`

    const result = await sendWhatsAppMessage({
      phone: customer.phone,
      message,
      organizationId: appt.organization_id,
    })

    if (result.success) {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", appt.id)

      if (updateError) {
        console.error("🔥 [CRON] Erro ao marcar lembrete como enviado:", updateError)
        throw updateError
      }

      sent++
    } else {
      console.error("🔥 [CRON] Falha ao enviar lembrete para paciente:", {
        appointmentId: appt.id,
        organizationId: appt.organization_id,
        result,
      })
    }
  }

  return {
    sent,
    start: now.toISOString(),
    end: nextHour.toISOString(),
  }
}
