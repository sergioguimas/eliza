'use server'

import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"

// 🌎 Timezone fixo (Brasil)
const TZ = "America/Sao_Paulo"

// 🔌 Supabase (service role para bypass RLS)
function getSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 🕒 Helpers de data
function nowInBrazil() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }))
}

function getTodayRange() {
  const now = nowInBrazil()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)

  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: start.toISOString().slice(0, 10), // YYYY-MM-DD
  }
}

function getMinutesNow() {
  const now = nowInBrazil()
  return now.getHours() * 60 + now.getMinutes()
}

// --------------------------------------------------
// 🩺 1) RESUMO DO MÉDICO
// --------------------------------------------------

export async function processDoctorDailySummaries() {
  const supabase = getSupabase()
  const { start, end, date } = getTodayRange()
  const nowMinutes = getMinutesNow()
  const todayWeekday = nowInBrazil().getDay()

  console.log("🩺 [CRON] Processando resumo dos médicos...")

  // 1. Buscar disponibilidades ativas hoje
  const { data: availabilities } = await supabase
    .from("professional_availability")
    .select(`
      professional_id,
      start_time,
      is_active,
      professionals (
        id,
        name,
        phone,
        organization_id
      )
    `)
    .eq("day_of_week", todayWeekday)
    .eq("is_active", true)

  if (!availabilities || availabilities.length === 0) {
    return { sent: 0 }
  }

  let sent = 0

  for (const av of availabilities) {
    const professional = av.professionals

    if (!professional?.phone) continue

    // ⏱️ converte HH:mm → minutos
    const [h, m] = av.start_time.split(":").map(Number)
    const startMinutes = h * 60 + m

    // ⏱️ janela de 5 minutos
    if (nowMinutes < startMinutes || nowMinutes > startMinutes + 4) {
      continue
    }

    // 🚫 evitar duplicado
    const { data: alreadySent } = await supabase
      .from("notification_dispatches")
      .select("id")
      .eq("kind", "doctor_daily_summary")
      .eq("professional_id", professional.id)
      .eq("dispatch_date", date)
      .maybeSingle()

    if (alreadySent) continue

    // 📅 buscar agenda do dia
    const { data: appointments } = await supabase
      .from("appointments")
      .select(`
        id,
        start_time,
        customer:customers ( name ),
        service:services ( title )
      `)
      .eq("professional_id", professional.id)
      .gte("start_time", start)
      .lte("start_time", end)
      .in("status", ["pending", "scheduled", "confirmed"])
      .order("start_time", { ascending: true })

    // 🧠 montar mensagem
    let list = ""

    if (!appointments || appointments.length === 0) {
      list = "Nenhum agendamento hoje."
    } else {
      list = appointments
        .map((a, i) => {
          const time = new Date(a.start_time)
            .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

          return `${i + 1}. ${time} - ${a.customer?.name || "Paciente"}`
        })
        .join("\n")
    }

    const firstName = professional.name.split(" ")[0]

    const message = `Bom dia, ${firstName}! ☀️

Sua agenda de hoje:

${list}

Total: ${appointments?.length || 0} paciente(s).`

    // 📤 envio
    await sendWhatsAppMessage({
      phone: professional.phone,
      message,
      organizationId: professional.organization_id,
    })

    // 📝 log
    await supabase.from("notification_dispatches").insert({
      kind: "doctor_daily_summary",
      professional_id: professional.id,
      organization_id: professional.organization_id,
      dispatch_date: date,
    })

    sent++
  }

  return { sent }
}

// --------------------------------------------------
// 👤 2) LEMBRETE PARA PACIENTES (07:00)
// --------------------------------------------------

export async function processPatientMorningReminders() {
  const supabase = getSupabase()
  const { start, end, date } = getTodayRange()
  const now = nowInBrazil()

  console.log("👤 [CRON] Processando lembretes de pacientes...")

  // ⏱️ só roda entre 07:00 e 07:04
  if (now.getHours() !== 7 || now.getMinutes() > 4) {
    return { skipped: true }
  }

  // 📅 buscar consultas do dia
  const { data: appointments } = await supabase
    .from("appointments")
    .select(`
      id,
      start_time,
      organization_id,
      customer:customers ( id, name, phone ),
      professional:professionals ( name )
    `)
    .gte("start_time", start)
    .lte("start_time", end)
    .in("status", ["pending", "scheduled", "confirmed"])

  if (!appointments || appointments.length === 0) {
    return { sent: 0 }
  }

  let sent = 0

  for (const appt of appointments) {
    const customer = appt.customer

    if (!customer?.phone) continue

    // 🚫 evitar duplicado
    const { data: alreadySent } = await supabase
      .from("notification_dispatches")
      .select("id")
      .eq("kind", "patient_day_reminder")
      .eq("appointment_id", appt.id)
      .eq("dispatch_date", date)
      .maybeSingle()

    if (alreadySent) continue

    const time = new Date(appt.start_time)
      .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

    const firstName = customer.name.split(" ")[0]

    const message = `Olá, ${firstName}! 👋

Lembrete da sua consulta hoje às ${time} com ${appt.professional?.name || "o profissional"}.

Responda:
- *SIM* para confirmar
- *REMARCAR* para alterar
- *CANCELAR* para cancelar`

    // 📤 envio
    await sendWhatsAppMessage({
      phone: customer.phone,
      message,
      organizationId: appt.organization_id,
    })

    // 📝 log
    await supabase.from("notification_dispatches").insert({
      kind: "patient_day_reminder",
      appointment_id: appt.id,
      customer_id: customer.id,
      organization_id: appt.organization_id,
      dispatch_date: date,
    })

    sent++
  }

  return { sent }
}