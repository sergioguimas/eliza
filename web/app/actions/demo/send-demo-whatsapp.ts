'use server'

import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { getEvolutionServer } from "@/lib/evolution"

interface SendDemoMessageProps {
  phone: string
  message: string
  organizationId: string
}

function normalizePhone(phone: string) {
  let cleanPhone = phone.replace(/\D/g, "")

  if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`
  }

  return cleanPhone
}

/**
 * Envio de WhatsApp do tour de demonstração.
 *
 * Existe separado de `sendWhatsAppMessage` por um motivo de segurança, não de
 * organização de código: o tenant demo é operado por um visitante anônimo que
 * recebe uma sessão `authenticated` de verdade. Esse visitante tem
 * `GRANT UPDATE(whatsapp_instance_name)` em `organizations` e a policy
 * "Users can update own org" permitiria alterar a própria org.
 *
 * A migration 20260811120000 tirou `whatsapp_instance_name` do alcance do papel
 * `authenticated` (nem SELECT nem UPDATE), então o ataque direto — ler a
 * instância de um tenant real e reapontar a org demo para ela — está fechado
 * no banco.
 *
 * A instância da demo continua vindo de `DEMO_WHATSAPP_INSTANCE`, do ambiente,
 * com `organizations.whatsapp_instance_name` da org demo nula: é a segunda
 * camada. Mesmo que um grant volte por engano numa migration futura, nada que o
 * visitante escreva no banco muda de qual número a mensagem sai.
 *
 * Esta função é o primitivo de envio. Os controles de abuso do tour — opt-in
 * explícito, teto por sessão, um número por janela de 24h e catálogo fixo de
 * mensagens — são responsabilidade de quem chama. Nunca exponha esta função a
 * um texto livre digitado pelo visitante.
 */
export async function sendDemoWhatsAppMessage({
  phone,
  message,
  organizationId,
}: SendDemoMessageProps) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const server = getEvolutionServer()

  if (!server) {
    console.error(
      "❌ [SendDemoWhatsApp] Servidor Evolution não configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY)."
    )

    return { success: false, error: "Configuração da Evolution API incompleta." }
  }

  const instanceName = process.env.DEMO_WHATSAPP_INSTANCE || null

  // Sem chip dedicado configurado a demo não envia. Cair na instância de
  // qualquer outra org seria exatamente o vazamento que este arquivo evita.
  if (!instanceName) {
    console.warn(
      "🚫 [SendDemoWhatsApp] Envio ignorado: DEMO_WHATSAPP_INSTANCE não configurada."
    )

    return {
      success: false,
      error: "Demonstração sem WhatsApp configurado.",
    }
  }

  // A org precisa ser demo de verdade. Sem esta checagem, um tenant real que
  // chamasse esta função por engano passaria a enviar pelo chip da demo.
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, is_demo, expires_at")
    .eq("id", organizationId)
    .single()

  if (orgError || !org) {
    console.error(
      "❌ [SendDemoWhatsApp] Organização não encontrada:",
      orgError?.message
    )

    return { success: false, error: "Organização não encontrada." }
  }

  if (!org.is_demo) {
    console.error(
      "🚫 [SendDemoWhatsApp] Bloqueado: organização não é demo.",
      { organizationId }
    )

    return { success: false, error: "Organização não é de demonstração." }
  }

  if (org.expires_at && new Date(org.expires_at) < new Date()) {
    console.warn(
      "🚫 [SendDemoWhatsApp] Bloqueado: demonstração expirada.",
      { organizationId }
    )

    return { success: false, error: "Demonstração expirada." }
  }

  const cleanPhone = normalizePhone(phone)
  const finalEndpoint = `${server.url}/message/sendText/${instanceName}`

  try {
    const response = await fetch(finalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: server.apiKey,
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
      console.error("❌ [SendDemoWhatsApp] API recusou:", data)
      return { success: false, error: data }
    }

    console.log("✅ [SendDemoWhatsApp] Enviado com sucesso!")
    return { success: true, data }
  } catch (err: any) {
    console.error("🔥 [SendDemoWhatsApp] Falha de conexão:", err.message)
    return { success: false, error: "Erro de conexão com API" }
  }
}
