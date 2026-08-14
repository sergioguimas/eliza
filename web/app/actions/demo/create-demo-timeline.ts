'use server'

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"

const TZ = "America/Sao_Paulo"

export type DemoTimelineEvent = {
  eventType: "reminder_1h" | "client_confirmed" | "appointment_time"
  simulatedTime: string
  messageText: string | null
  responseText: string | null
}

export type DemoTimelineResult =
  | { ok: true; events: DemoTimelineEvent[]; appointmentTime: string }
  | { ok: false; error: string }

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  })
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0]
}

/**
 * Monta a sequência de avisos simulados em torno do próximo compromisso da
 * organização — não necessariamente o que o visitante acabou de criar no
 * passo anterior do tour. Derivar assim, em vez de receber um `appointmentId`
 * do cliente, elimina a necessidade de carregar esse id entre passos e rotas:
 * o seed sempre garante pelo menos um agendamento `scheduled`, então a busca
 * nunca fica sem resposta.
 *
 * Idempotente: reabrir o passo, ou refazer o tour, não duplica os três
 * eventos — a segunda chamada só devolve o que já existe.
 */
export async function createDemoTimeline(): Promise<DemoTimelineResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Erro de configuração." }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Sessão expirada." }
  }

  const supabaseAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return { ok: false, error: "Organização não encontrada." }
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, niche, is_demo")
    .eq("id", profile.organization_id)
    .maybeSingle()

  if (!organization?.is_demo) {
    return { ok: false, error: "Esta organização não é de demonstração." }
  }

  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, start_time, customers(name), services(title), professionals(name)"
    )
    .eq("organization_id", organization.id)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!appointment) {
    return { ok: false, error: "Nenhum agendamento futuro encontrado." }
  }

  const { data: existing } = await supabaseAdmin
    .from("demo_timeline_events")
    .select("event_type, simulated_time, message_text, response_text")
    .eq("appointment_id", appointment.id)
    .order("simulated_time", { ascending: true })

  if (existing && existing.length > 0) {
    return {
      ok: true,
      appointmentTime: appointment.start_time,
      events: existing.map((event) => ({
        eventType: event.event_type as DemoTimelineEvent["eventType"],
        simulatedTime: event.simulated_time,
        messageText: event.message_text,
        responseText: event.response_text,
      })),
    }
  }

  const dict = getDictionary(organization.niche)
  const agendamento = dict.entities.agendamento.toLowerCase()

  const customer = appointment.customers as { name: string } | null
  const professional = appointment.professionals as { name: string } | null
  const service = appointment.services as { title: string } | null

  const customerFirst = customer ? firstName(customer.name) : "tudo bem"
  const professionalFirst = professional ? firstName(professional.name) : null
  const serviceTitle = service?.title ?? agendamento
  const appointmentTime = new Date(appointment.start_time)
  const timeLabel = formatTime(appointmentTime)

  const reminderAt = new Date(appointmentTime.getTime() - 60 * 60_000)
  const confirmedAt = new Date(appointmentTime.getTime() - 45 * 60_000)

  const reminderMessage = professionalFirst
    ? `Oi ${customerFirst}! Passando para lembrar da sua ${serviceTitle} com ${professionalFirst} hoje às ${timeLabel}. Confirma pra gente?`
    : `Oi ${customerFirst}! Passando para lembrar da sua ${serviceTitle} hoje às ${timeLabel}. Confirma pra gente?`

  const rows: Array<{
    organization_id: string
    appointment_id: string
    event_type: DemoTimelineEvent["eventType"]
    simulated_time: string
    message_text: string | null
    response_text: string | null
    delivered_for_real: boolean
  }> = [
    {
      organization_id: organization.id,
      appointment_id: appointment.id,
      event_type: "reminder_1h",
      simulated_time: reminderAt.toISOString(),
      message_text: reminderMessage,
      response_text: null,
      delivered_for_real: false,
    },
    {
      organization_id: organization.id,
      appointment_id: appointment.id,
      event_type: "client_confirmed",
      simulated_time: confirmedAt.toISOString(),
      message_text: null,
      response_text: "Perfeito, até lá! 👍",
      delivered_for_real: false,
    },
    {
      organization_id: organization.id,
      appointment_id: appointment.id,
      event_type: "appointment_time",
      simulated_time: appointment.start_time,
      message_text: `Chegou a hora da ${serviceTitle} de ${customerFirst}.`,
      response_text: null,
      delivered_for_real: false,
    },
  ]

  const { data: inserted, error } = await supabaseAdmin
    .from("demo_timeline_events")
    .insert(rows)
    .select("event_type, simulated_time, message_text, response_text")
    .order("simulated_time", { ascending: true })

  if (error || !inserted) {
    console.error("🔥 [DemoTimeline] Falha ao gravar eventos:", error?.message)
    return { ok: false, error: "Não foi possível montar a linha do tempo." }
  }

  return {
    ok: true,
    appointmentTime: appointment.start_time,
    events: inserted.map((event) => ({
      eventType: event.event_type as DemoTimelineEvent["eventType"],
      simulatedTime: event.simulated_time,
      messageText: event.message_text,
      responseText: event.response_text,
    })),
  }
}
