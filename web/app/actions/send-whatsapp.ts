'use server'

import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"

// 🛡️ CONFIGURAÇÃO DE SEGURANÇA (FALLBACK)
const DEFAULT_URL =  process.env.NEXT_PUBLIC_EVOLUTION_API_URL || ""
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

export async function sendWhatsAppMessage({ phone, message, organizationId }: SendMessageProps) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log(`📤 [SendWhatsApp] Iniciando envio para Org ID: ${organizationId}`)

  // 1. Busca Configurações no Banco (Agora com permissão total)
  const { data: org, error } = await supabase
    .from('organizations')
    .select('slug, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single()

  if (error) {
    // Agora esse erro só vai aparecer se o ID realmente não existir
    console.error("❌ [SendWhatsApp] Erro real ao buscar organização:", error.message)
  }

  let evolutionUrl = process.env.EVOLUTION_API_URL || org?.evolution_api_url || DEFAULT_URL  
  evolutionUrl = evolutionUrl.replace(/\/$/, "")
  const apiKey = (process.env.EVOLUTION_API_KEY || org?.evolution_api_key || DEFAULT_KEY) as string
  const instanceName = DEFAULT_INSTANCE

  // 3. Tratamento do Telefone
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = '55' + cleanPhone
  }

  // 4. Montagem da URL Final
  const finalEndpoint = `${evolutionUrl}/message/sendText/${instanceName}`

  // 5. Disparo
  try {
    const response = await fetch(finalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
        linkPreview: false,
        delay: 1200
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ [SendWhatsApp] API recusou:", data)
      return { success: false, error: data }
    }

    console.log("✅ [SendWhatsApp] Enviado com sucesso!")
    return { success: true, data }

  } catch (err: any) {
    console.error("🔥 [SendWhatsApp] Falha de Conexão:", err.message)
    return { success: false, error: "Erro de conexão com API" }
  }
}

export async function sendWhatsAppMedia({ phone, caption, media, fileName, organizationId }: SendMediaProps) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log(`📤 [SendMedia] Preparando envio de arquivo para Org: ${organizationId}`)

  // 1. Busca Configurações
  const { data: org } = await supabase
    .from('organizations')
    .select('slug, evolution_api_url, evolution_api_key')
    .eq('id', organizationId)
    .single()

  let evolutionUrl = process.env.EVOLUTION_API_URL || org?.evolution_api_url || DEFAULT_URL
  evolutionUrl = evolutionUrl.replace(/\/$/, "")
  const apiKey = (process.env.EVOLUTION_API_KEY || org?.evolution_api_key || DEFAULT_KEY) as string
  const instanceName = DEFAULT_INSTANCE


  // 2. Tratamento do Telefone
  let cleanPhone = phone.replace(/\D/g, '')
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = '55' + cleanPhone
  }

  // 3. Endpoint de Mídia da Evolution API
  const finalEndpoint = `${evolutionUrl}/message/sendMedia/${instanceName}`

  try {
    const response = await fetch(finalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: cleanPhone,
        media: media,
        mediatype: "document",
        mimetype: "application/pdf",
        fileName: fileName,
        caption: caption,
        delay: 1200
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("❌ [SendMedia] API recusou:", data)
      return { success: false, error: data }
    }

    console.log("✅ [SendMedia] Arquivo enviado com sucesso!")
    return { success: true, data }

  } catch (err: any) {
    console.error("🔥 [SendMedia] Falha de Conexão:", err.message)
    return { success: false, error: "Erro de conexão com API" }
  }
}
