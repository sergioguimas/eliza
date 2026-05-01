'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database } from "@/utils/database.types"

type AppointmentMessageType = "pending" | "created" | "canceled"

type TemplateData = {
  name?: string
  date?: string
  time?: string
  service?: string
  professional?: string
}

function replaceVariables(template: string, data: TemplateData) {
  return template
    .replace(/{name}/g, data.name || "")
    .replace(/{date}/g, data.date || "")
    .replace(/{time}/g, data.time || "")
    .replace(/{service}/g, data.service || "")
    .replace(/{professional}/g, data.professional || "")
}

function normalizeEvolutionUrl(url?: string | null) {
  return url?.replace(/\/$/, "") || ""
}

function normalizePhoneBR(phone?: string | null) {
  const raw = phone?.replace(/\D/g, "") || ""

  if (!raw) return null

  return raw.startsWith("55") ? raw : `55${raw}`
}

function getFirstName(name?: string | null) {
  return name?.trim().split(" ")[0] || ""
}

function getMessageTemplate(params: {
  type: AppointmentMessageType
  settings: any
}) {
  const { type, settings } = params

  if (type === "pending") {
    return (
      settings?.msg_appointment_pending ||
      "Olá {name}, recebemos sua solicitação de agendamento para {service} em {date} às {time}. Em breve nossa equipe confirmará o horário."
    )
  }

  if (type === "canceled") {
    return (
      settings?.msg_appointment_canceled ||
      "Olá {name}, seu agendamento para {service} em {date} às {time} foi cancelado."
    )
  }

  return (
    settings?.msg_appointment_created ||
    "Olá {name}, seu agendamento para {service} em {date} às {time} foi confirmado com {professional}."
  )
}

async function sendAppointmentMessage(
  appointmentId: string,
  type: AppointmentMessageType
) {
  const supabase = createAdminClient<Database>()

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(`
      id,
      status,
      start_time,
      customers (
        name,
        phone
      ),
      services (
        title
      ),
      professionals (
        name
      ),
      organizations (
        slug,
        evolution_api_url,
        evolution_api_key,
        organization_settings (
          msg_appointment_pending,
          msg_appointment_created,
          msg_appointment_canceled
        )
      )
    `)
    .eq("id", appointmentId)
    .single() as any

  if (error || !appointment) {
    console.error("❌ [WhatsApp] Agendamento não encontrado:", error)
    return { error: "Agendamento não encontrado." }
  }

  const organization = appointment.organizations
  const customer = appointment.customers
  const service = appointment.services
  const professional = appointment.professionals
  const settings =
    organization?.organization_settings?.[0] ||
    organization?.organization_settings

  const phone = normalizePhoneBR(customer?.phone)

  if (!phone) {
    console.error(`❌ [WhatsApp] Agendamento ${appointmentId}: cliente sem telefone.`)
    return { error: "Cliente sem telefone." }
  }

  if (!organization?.slug) {
    console.error(`❌ [WhatsApp] Agendamento ${appointmentId}: organização sem slug.`)
    return { error: "Organização sem instância WhatsApp." }
  }

  const evolutionUrl = normalizeEvolutionUrl(
    process.env.EVOLUTION_API_URL || organization.evolution_api_url
  )

  const apiKey =
    process.env.EVOLUTION_API_KEY ||
    organization.evolution_api_key ||
    ""

  if (!evolutionUrl || !apiKey) {
    console.error("❌ [WhatsApp] Configuração da Evolution ausente.")
    return { error: "Configuração do WhatsApp ausente." }
  }

  const dateObj = new Date(appointment.start_time)
  const date = format(dateObj, "dd/MM/yyyy", { locale: ptBR })
  const time = format(dateObj, "HH:mm", { locale: ptBR })

  const template = getMessageTemplate({
    type,
    settings,
  })

  const text = replaceVariables(template, {
    name: getFirstName(customer?.name),
    date,
    time,
    service: service?.title || "Consulta",
    professional: professional?.name || "Profissional",
  })

  try {
    console.log(`📤 [WhatsApp] Enviando mensagem "${type}" para ${phone}`)

    const response = await fetch(
      `${evolutionUrl}/message/sendText/${organization.slug}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text,
        }),
      }
    )

    if (!response.ok) {
      const responseText = await response.text()

      console.error(
        `❌ [WhatsApp] Evolution recusou envio (${response.status}):`,
        responseText
      )

      return { error: "A API do WhatsApp recusou o envio." }
    }

    console.log(`✅ [WhatsApp] Mensagem "${type}" enviada com sucesso.`)

    return { success: true }
  } catch (err: any) {
    console.error("🔥 [WhatsApp] Falha de conexão:", err?.cause || err)
    return { error: "Erro crítico de conexão com a Evolution API." }
  }
}

export async function sendAppointmentConfirmation(appointmentId: string) {
  const supabase = createAdminClient<Database>()

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .single()

  if (error || !appointment) {
    console.error("❌ [WhatsApp] Não foi possível identificar status:", error)
    return { error: "Agendamento não encontrado." }
  }

  const messageType: AppointmentMessageType =
    appointment.status === "pending" ? "pending" : "created"

  return sendAppointmentMessage(appointmentId, messageType)
}

export async function sendAppointmentCancellation(appointmentId: string) {
  return sendAppointmentMessage(appointmentId, "canceled")
}