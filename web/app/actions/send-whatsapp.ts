'use server'

import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"

const DEFAULT_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || ""
const DEFAULT_KEY = process.env.EVOLUTION_API_KEY || ""
const DEFAULT_INSTANCE = "admin-painel-1768703535"

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

function normalizePhone(phone: string) {
  let cleanPhone = phone.replace(/\D/g, "")

  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`
  }

  return cleanPhone
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

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("slug, evolution_api_url, evolution_api_key")
    .eq("id", organizationId)
    .single()

  if (orgError) {
    console.error("❌ [SendWhatsApp] Erro ao buscar organização:", orgError.message)
  }

  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("whatsapp_instance_name")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (settingsError) {
    console.error("❌ [SendWhatsApp] Erro ao buscar settings:", settingsError.message)
  }

  let evolutionUrl =
    process.env.EVOLUTION_API_URL ||
    org?.evolution_api_url ||
    DEFAULT_URL

  evolutionUrl = evolutionUrl.replace(/\/$/, "")

  const apiKey =
    process.env.EVOLUTION_API_KEY ||
    org?.evolution_api_key ||
    DEFAULT_KEY

  const instanceName =
    settings?.whatsapp_instance_name ||
    DEFAULT_INSTANCE

  if (!evolutionUrl || !apiKey || !instanceName) {
    return {
      success: false,
      error: "Configuração da Evolution API incompleta.",
    }
  }

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

  const { data: org } = await supabase
    .from("organizations")
    .select("slug, evolution_api_url, evolution_api_key")
    .eq("id", organizationId)
    .single()

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("whatsapp_instance_name")
    .eq("organization_id", organizationId)
    .maybeSingle()

  let evolutionUrl =
    process.env.EVOLUTION_API_URL ||
    org?.evolution_api_url ||
    DEFAULT_URL

  evolutionUrl = evolutionUrl.replace(/\/$/, "")

  const apiKey =
    process.env.EVOLUTION_API_KEY ||
    org?.evolution_api_key ||
    DEFAULT_KEY

  const instanceName =
    settings?.whatsapp_instance_name ||
    DEFAULT_INSTANCE

  if (!evolutionUrl || !apiKey || !instanceName) {
    return {
      success: false,
      error: "Configuração da Evolution API incompleta.",
    }
  }

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