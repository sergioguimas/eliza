import { createHash, timingSafeEqual } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { Database } from "@/utils/database.types"
import { brPhoneVariants } from "@/lib/phone-br"

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

/**
 * Número de quem mandou a mensagem, só para conversa 1:1.
 *
 * `body.sender` NÃO entra: no payload da Evolution ele é o número da própria
 * instância (o tenant), não o do cliente. Grupo (`@g.us`) e JID `@lid` sem
 * `remoteJidAlt` não identificam um telefone e são descartados.
 */
function extractIncomingNumber(body: any) {
  const key = body.data?.key
  const candidates = [key?.remoteJidAlt, key?.remoteJid]

  for (const jid of candidates) {
    if (typeof jid === "string" && jid.endsWith("@s.whatsapp.net")) {
      return jid.replace(/@.*/, "").replace(/\D/g, "")
    }
  }

  return ""
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

/**
 * Segredo compartilhado com a Evolution (env WHATSAPP_WEBHOOK_SECRET).
 *
 * Aceito em dois lugares porque a Evolution tem dois jeitos de configurar
 * webhook e só um deles manda header:
 *   - no caminho: /api/webhooks/whatsapp/<segredo> — funciona no webhook
 *     GLOBAL (env WEBHOOK_GLOBAL_URL, que não envia header nenhum) e sobrevive
 *     ao `byEvents`, que anexa `/messages-upsert` ao fim da URL (query string
 *     quebraria ali);
 *   - no header `x-webhook-secret` ou `Authorization: Bearer` — webhook por
 *     instância (`/webhook/set/{instance}` com `headers`).
 *
 * Sem o env configurado a rota recusa tudo: fail-closed. Antes disto qualquer
 * POST com um nome de instância (derivado do slug, público) confirmava ou
 * cancelava agendamento de cliente e ainda disparava resposta pelo WhatsApp.
 */
function digest(value: string) {
  return createHash("sha256").update(value).digest()
}

function isAuthorized(req: Request, slug: string[] | undefined) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET

  if (!secret) return null

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  const provided = [
    slug?.[0],
    req.headers.get("x-webhook-secret"),
    bearer,
  ].filter((value): value is string => Boolean(value))

  const expected = digest(secret)

  return provided.some((value) => timingSafeEqual(digest(value), expected))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await params
  const authorized = isAuthorized(req, slug)

  if (authorized === null) {
    console.error("🚫 [Webhook] WHATSAPP_WEBHOOK_SECRET não configurado — recusando.")
    return NextResponse.json({ error: "not_configured" }, { status: 503 })
  }

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

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
      { error: "internal_error" },
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

  if (incomingClean.length < 10) {
    console.log("⚠️ [Webhook] Identificador numérico inválido ou muito curto:", incomingClean)

    return {
      ok: false,
      reason: "invalid_phone",
    }
  }

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

  // Igualdade exata em phone_normalized (índice único por org). O matching
  // antigo era `phone ilike %últimos4` com fallback no primeiro candidato —
  // bastava coincidir o final do número para mexer no agendamento de outro
  // cliente.
  const phoneVariants = brPhoneVariants(incomingClean)

  console.log(`🔍 [Webhook] Buscando cliente na organização ${organizationId}`)

  const { data: candidates, error: customersError } = await supabase
    .from("customers")
    .select("id, name, phone, organization_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("phone_normalized", phoneVariants)

  if (customersError) {
    console.error("🔥 [Webhook] Erro ao buscar cliente:", customersError)

    return {
      ok: false,
      reason: "customer_lookup_error",
    }
  }

  if (!candidates || candidates.length === 0) {
    console.log("⚠️ [Webhook] Cliente não encontrado para o número recebido.")

    return {
      ok: false,
      reason: "customer_not_found",
    }
  }

  // O mesmo celular gravado em duas formas (com e sem 9, com e sem DDI) vira
  // dois cadastros. Não dá para saber qual é o certo: não mexe em nada.
  if (candidates.length > 1) {
    console.warn(
      "⚠️ [Webhook] Número casa com mais de um cliente; ignorando.",
      candidates.map((customer) => customer.id)
    )

    return {
      ok: false,
      reason: "customer_ambiguous",
    }
  }

  const foundCustomer = candidates[0]

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