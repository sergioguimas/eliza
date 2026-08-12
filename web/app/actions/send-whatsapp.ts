'use server'

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { getEvolutionServer } from "@/lib/evolution"

interface SendMessageProps {
  phone: string
  message: string
  organizationId: string
}

interface SendMediaProps {
  phone: string
  caption: string
  media: string
  fileName: string
  organizationId: string
}

interface EvolutionConfig {
  evolutionUrl: string
  apiKey: string
  instanceName: string
}

type ResolvedConfig =
  | { ok: true; config: EvolutionConfig }
  | { ok: false; error: string }

function normalizePhone(phone: string) {
  let cleanPhone = phone.replace(/\D/g, "")

  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`
  }

  return cleanPhone
}

/**
 * Resolve o servidor Evolution e a instância de WhatsApp da organização.
 *
 * A instância é a identidade do tenant no WhatsApp — é o número de onde a
 * mensagem sai. Por isso ela nunca tem fallback global: enviar pela instância
 * de outra organização faria o cliente do tenant A receber mensagem do número
 * do tenant B. Sem instância configurada, o envio falha explicitamente.
 */
async function resolveEvolutionConfig(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  logTag: string
): Promise<ResolvedConfig> {
  const server = getEvolutionServer()

  if (!server) {
    console.error(
      `❌ [${logTag}] Servidor Evolution não configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY).`
    )

    return { ok: false, error: "Configuração da Evolution API incompleta." }
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("slug, whatsapp_instance_name")
    .eq("id", organizationId)
    .single()

  if (orgError) {
    console.error(`❌ [${logTag}] Erro ao buscar organização:`, orgError.message)
  }

  // organizations.whatsapp_instance_name é a fonte única: é o que o fluxo de
  // conexão grava e o que o webhook de entrada consulta para achar a org.
  const instanceName = org?.whatsapp_instance_name || null

  if (!instanceName) {
    // Não é erro: conectar um número é opcional. A org simplesmente não tem
    // canal de WhatsApp, e o envio para aqui em vez de sair por outro número.
    console.warn(
      `🚫 [${logTag}] Envio ignorado: organização sem WhatsApp conectado.`,
      { organizationId, slug: org?.slug ?? null }
    )

    return {
      ok: false,
      error:
        "Organização sem WhatsApp conectado. Conecte um número em Configurações > WhatsApp antes de enviar mensagens.",
    }
  }

  return {
    ok: true,
    config: {
      evolutionUrl: server.url,
      apiKey: server.apiKey,
      instanceName,
    },
  }
}

export async function sendWhatsAppMessage({
  phone,
  message,
  organizationId,
}: SendMessageProps) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log(`📤 [SendWhatsApp] Iniciando envio para Org ID: ${organizationId}`)

  const resolved = await resolveEvolutionConfig(
    supabase,
    organizationId,
    "SendWhatsApp"
  )

  if (!resolved.ok) {
    return { success: false, error: resolved.error }
  }

  const { evolutionUrl, apiKey, instanceName } = resolved.config

  const cleanPhone = normalizePhone(phone)
  const finalEndpoint = `${evolutionUrl}/message/sendText/${instanceName}`

  try {
    const response = await fetch(finalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
        linkPreview: false,
        delay: 1200,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ [SendWhatsApp] API recusou:", data)
      return { success: false, error: data }
    }

    console.log("✅ [SendWhatsApp] Enviado com sucesso!")
    return { success: true, data }
  } catch (err: any) {
    console.error("🔥 [SendWhatsApp] Falha de conexão:", err.message)
    return { success: false, error: "Erro de conexão com API" }
  }
}

export async function sendWhatsAppMedia({
  phone,
  caption,
  media,
  fileName,
  organizationId,
}: SendMediaProps) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log(`📤 [SendMedia] Preparando envio de arquivo para Org: ${organizationId}`)

  const resolved = await resolveEvolutionConfig(
    supabase,
    organizationId,
    "SendMedia"
  )

  if (!resolved.ok) {
    return { success: false, error: resolved.error }
  }

  const { evolutionUrl, apiKey, instanceName } = resolved.config

  const cleanPhone = normalizePhone(phone)
  const finalEndpoint = `${evolutionUrl}/message/sendMedia/${instanceName}`

  try {
    const response = await fetch(finalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        media,
        mediatype: "document",
        mimetype: "application/pdf",
        fileName,
        caption,
        delay: 1200,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ [SendMedia] API recusou:", data)
      return { success: false, error: data }
    }

    console.log("✅ [SendMedia] Arquivo enviado com sucesso!")
    return { success: true, data }
  } catch (err: any) {
    console.error("🔥 [SendMedia] Falha de conexão:", err.message)
    return { success: false, error: "Erro de conexão com API" }
  }
}
