import { createClient } from "@supabase/supabase-js"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { Database } from "@/utils/database.types"

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TZ = "America/Sao_Paulo"

function nowSP() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ })
  )
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

export async function processDoctorDailySummaries() {
  const now = nowSP()

  if (now.getHours() !== 8) {
    return { skipped: true }
  }

  const startDay = new Date(now)
  startDay.setHours(0, 0, 0, 0)

  const endDay = new Date(now)
  endDay.setHours(23, 59, 59, 999)

  const { data: appointments } = await supabase
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

  if (!appointments?.length) return { sent: 0 }

  const grouped: Record<string, any[]> = {}

  for (const appt of appointments) {
    if (appt.reminder_morning_sent_at) continue
    if (!appt.professional?.phone) continue    

    const key = `${appt.organization_id}-${appt.professional.phone}`

    if (!grouped[key]) grouped[key] = []
    grouped[key].push(appt)
  }

  let sent = 0

  for (const key in grouped) {
    const list = grouped[key]
    const orgId = list[0].organization_id
    const phone = list[0].professional.phone

    if (!phone) continue

    const lines = list.map((a) => {
      return `${formatTime(new Date(a.start_time))} - ${a.customer.name}`
    })

    const template = list[0].settings?.msg_doctor_daily_summary

    const message =
      render(template, {
        date: formatDate(now),
        agenda: lines.join("\n"),
      }) ||
      `📅 Agenda do dia:\n\n${lines.join("\n")}`

    await sendWhatsAppMessage({
      phone,
      message,
      organizationId: orgId,
    })

    // marca todos como enviados
    const ids = list.map((a) => a.id)

    await supabase
      .from("appointments")
      .update({ reminder_morning_sent_at: now.toISOString() })
      .in("id", ids)

    sent++
  }

  return { sent }
}

export async function processPatientMorningReminders() {
  const now = nowSP()
  const nextHour = new Date(now.getTime() + 60 * 60000)

  const { data: appointments } = await supabase
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

  if (!appointments?.length) return { sent: 0 }

  let sent = 0

  const orgIds = [...new Set(appointments.map((a) => a.organization_id))]

  const { data: settingsRows } = await supabase
    .from("organization_settings")
    .select("organization_id, msg_appointment_reminder, msg_doctor_daily_summary")
    .in("organization_id", orgIds)

  const settingsByOrg = new Map(
    (settingsRows || []).map((s) => [s.organization_id, s])
  )

  for (const appt of appointments) {
    const phone = appt.customer.phone
    if (!phone) continue

    const professional = Array.isArray(appt.professional)
      ? appt.professional[0]
      : appt.professional

    const customer = Array.isArray(appt.customer)
      ? appt.customer[0]
      : appt.customer

    const service = Array.isArray(appt.service)
      ? appt.service[0]
      : appt.service

    if (!professional || !customer || !service) continue

    const settings = settingsByOrg.get(appt.organization_id)
    const template = settings?.msg_appointment_reminder

    const date = formatDate(new Date(appt.start_time))
    const time = formatTime(new Date(appt.start_time))

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
      phone,
      message,
      organizationId: appt.organization_id,
    })

    if (result.success) {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", appt.id)

      sent++
    }
  }

  return { sent }
}