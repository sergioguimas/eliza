import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { Database } from "@/utils/database.types"

const CONFIRMATION_KEYWORDS = [
  "sim",
  "confirmar",
  "confirmo",
  "ok",
  "pode ser",
  "confirmado",
  "tá bom",
  "ta bom",
  "estarei",
  "vou sim",
  "claro",
]

const CANCELLATION_KEYWORDS = [
  "não",
  "nao",
  "cancelar",
  "cancela",
  "desmarcar",
  "desmarca",
  "não vou",
  "nao vou",
  "infelizmente",
  "impossivel",
  "impossível",
  "outro dia",
  "reagendar",
  "remarcar",
]

export const dynamic = "force-dynamic"

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function extractMessageText(messageContent: any) {
  if (messageContent?.conversation) {
    return messageContent.conversation
  }

  if (messageContent?.extendedTextMessage?.text) {
    return messageContent.extendedTextMessage.text
  }

  if (messageContent?.buttonsResponseMessage?.selectedButtonId) {
    return messageContent.buttonsResponseMessage.selectedButtonId
  }

  if (messageContent?.buttonsResponseMessage?.selectedDisplayText) {
    return messageContent.buttonsResponseMessage.selectedDisplayText
  }

  if (messageContent?.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return messageContent.listResponseMessage.singleSelectReply.selectedRowId
  }

  if (messageContent?.listResponseMessage?.title) {
    return messageContent.listResponseMessage.title
  }

  return ""
}

function extractIncomingNumber(body: any) {
  const rawNumber =
    body.data?.key?.remoteJidAlt ||
    body.sender ||
    body.data?.key?.participant ||
    body.data?.key?.remoteJid

  return String(rawNumber || "")
    .replace(/@.*/, "")
    .replace(/\D/g, "")
}

function extractInstanceName(body: any) {
  return (
    body.instance ||
    body.instanceName ||
    body.data?.instance ||
    body.data?.instanceName ||
    body.server_url ||
    null
  )
}

function classifyIntent(text: string): "confirmed" | "canceled" | null {
  const normalized = normalizeText(text)

  // Cancelamento primeiro para evitar casos como "não confirmo"
  if (CANCELLATION_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) {
    return "canceled"
  }

  if (CONFIRMATION_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)))) {
    return "confirmed"
  }

  return null
}

function renderMessage(template: string | null | undefined, vars: Record<string, string>) {
  if (!template) return null

  return template.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, key) => {
    return vars[key] ?? ""
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const eventType = body.event || body.type

    if (eventType !== "messages.upsert") {
      return NextResponse.json({ status: "ignored_not_message" })
    }

    const messageData = body.data
    const key = messageData?.key

    if (!messageData || !key) {
      return NextResponse.json({ status: "ignored_invalid_payload" })
    }

    if (key.fromMe) {
      return NextResponse.json({ status: "ignored_from_me" })
    }

    const messageTimestamp = messageData?.messageTimestamp
    const nowSeconds = Math.floor(Date.now() / 1000)

    if (messageTimestamp && nowSeconds - messageTimestamp > 600) {
      return NextResponse.json({ status: "ignored_old_message" })
    }

    const rawText = extractMessageText(messageData.message)

    if (!rawText) {
      return NextResponse.json({ status: "no_text_content" })
    }

    const text = normalizeText(rawText)

    console.log(`📩 [Webhook] Texto recebido e normalizado: "${text}"`)

    const intent = classifyIntent(text)

    if (!intent) {
      return NextResponse.json({ status: "ignored_no_keyword" })
    }

    const result = await handleStatusChange(body, intent, text)

    return NextResponse.json({
      status: intent === "confirmed"
        ? "processed_confirmation"
        : "processed_cancellation",
      result,
    })
  } catch (error: any) {
    console.error("🔥 Erro no Webhook:", error)

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

async function handleStatusChange(
  body: any,
  newStatus: "confirmed" | "canceled",
  text: string
) {
  console.log(`🔔 [Webhook] Iniciando processo para status: ${newStatus.toUpperCase()}`)

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const incomingClean = extractIncomingNumber(body)
  const instanceName = extractInstanceName(body)

  if (incomingClean.length < 8) {
    console.log("⚠️ [Webhook] Identificador numérico inválido ou muito curto:", incomingClean)

    return {
      ok: false,
      reason: "invalid_phone",
    }
  }

  const last8 = incomingClean.slice(-8)
  const last4 = incomingClean.slice(-4)

  console.log(`✅ [Webhook] Remetente identificado: ${incomingClean}`)
  console.log(`🏢 [Webhook] Instância identificada: ${instanceName ?? "não informada"}`)

  let organizationId: string | null = null

  if (instanceName) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name, whatsapp_instance_name")
      .eq("whatsapp_instance_name", instanceName)
      .maybeSingle()

    if (organizationError) {
      console.error("🔥 [Webhook] Erro ao buscar organização:", organizationError)

      return {
        ok: false,
        reason: "organization_lookup_error",
      }
    }

    if (organization) {
      organizationId = organization.id
    }
  }

  if (!organizationId) {
    console.log("⚠️ [Webhook] Organização não encontrada pela instância.")

    return {
      ok: false,
      reason: "organization_not_found",
      instanceName,
    }
  }

  console.log(`🔍 [Webhook] Buscando cliente na organização ${organizationId} com final ${last4}`)

  const { data: candidates, error: customersError } = await supabase
    .from("customers")
    .select("id, name, phone, organization_id")
    .eq("organization_id", organizationId)
    .or(`phone.ilike.%${last8},phone.ilike.%${last4}`)

  if (customersError) {
    console.error("🔥 [Webhook] Erro ao buscar cliente:", customersError)

    return {
      ok: false,
      reason: "customer_lookup_error",
    }
  }

  if (!candidates || candidates.length === 0) {
    console.log(`⚠️ [Webhook] Cliente não encontrado para o final ${last4}`)

    return {
      ok: false,
      reason: "customer_not_found",
    }
  }

  const foundCustomer = candidates.find((customer) => {
    if (!customer.phone) return false

    return customer.phone.replace(/\D/g, "").endsWith(last8)
  }) ?? candidates[0]

  if (!foundCustomer) {
    return {
      ok: false,
      reason: "customer_not_matched",
    }
  }

  const now = new Date().toISOString()

  console.log(`📅 [Webhook] Buscando próximo agendamento para cliente ${foundCustomer.id}`)

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(`
      id,
      status,
      start_time,
      organization_id,
      customer_id,
      professional:professionals(name),
      service:services(title)
    `)
    .eq("organization_id", organizationId)
    .eq("customer_id", foundCustomer.id)
    .in("status", ["pending", "scheduled", "confirmed"])
    .gte("start_time", now)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (appointmentError) {
    console.error("🔥 [Webhook] Erro ao buscar agendamento:", appointmentError)

    return {
      ok: false,
      reason: "appointment_lookup_error",
    }
  }

  if (!appointment) {
    console.log(`⚠️ [Webhook] Nenhum agendamento futuro encontrado para cliente ${foundCustomer.id}`)

    return {
      ok: false,
      reason: "appointment_not_found",
    }
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointment.id)

  if (updateError) {
    console.error("🔥 [Webhook] Erro ao atualizar agendamento:", updateError)

    return {
      ok: false,
      reason: "appointment_update_error",
    }
  }

  const { error: logError } = await supabase
    .from("appointment_logs")
    .insert({
      appointment_id: appointment.id,
      customer_id: foundCustomer.id,
      action: newStatus,
      source: "whatsapp_webhook",
      raw_message: text,
      push_name: body.data?.pushName || "Desconhecido",
    })

  if (logError) {
    console.warn("⚠️ [Webhook] Agendamento atualizado, mas falhou ao gravar log:", logError)
  }

  console.log(`🎉 [Webhook] Agendamento ${appointment.id} atualizado para: ${newStatus.toUpperCase()}`)

  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("msg_appointment_canceled")
    .eq("organization_id", appointment.organization_id)
    .maybeSingle()

  if (settingsError) {
    console.warn("⚠️ [Webhook] Erro ao buscar configurações da organização:", settingsError)
  }

  const firstName = foundCustomer.name?.split(" ")[0] ?? foundCustomer.name ?? ""

  let replyMessage = ""

  if (newStatus === "confirmed") {
    replyMessage = `✅ *Confirmado, ${firstName || "tudo certo"}!* Já deixei seu agendamento confirmado na agenda. Te aguardamos!`
  }

  if (newStatus === "canceled") {
    const customCanceledMessage = renderMessage(settings?.msg_appointment_canceled, {
      name: firstName,
    })

    replyMessage =
      customCanceledMessage ||
      `👌 *Entendido, ${firstName || "tudo certo"}.* O agendamento foi cancelado. Quando quiser remarcar, é só chamar!`
  }

  if (replyMessage) {
    await sendWhatsAppMessage({
      phone: foundCustomer.phone || incomingClean,
      message: replyMessage,
      organizationId: appointment.organization_id,
    })
  }

  return {
    ok: true,
    appointmentId: appointment.id,
    customerId: foundCustomer.id,
    organizationId: appointment.organization_id,
    newStatus,
  }
}