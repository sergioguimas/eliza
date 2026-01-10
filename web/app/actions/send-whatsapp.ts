'use server'

import { createClient } from "@/utils/supabase/server"

const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY

export async function sendWhatsappMessage(phone: string, message: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations:organization_id(slug, evolution_api_url, evolution_api_key)')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organizations?.slug) return { error: "Organização sem instância." }
  
  const instanceName = profile.organizations.slug
  const EVOLUTION_URL = profile.organizations.evolution_api_url || DEFAULT_EVOLUTION_URL
  const API_KEY = profile.organizations.evolution_api_key || GLOBAL_API_KEY

  const cleanPhone = phone.replace(/\D/g, "")
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Erro Evolution:", data)
      return { error: "Falha ao enviar mensagem." }
    }

    return { success: true, data }

  } catch (error) {
    console.error("Erro de envio:", error)
    return { error: "Erro de conexão com API WhatsApp." }
  }
}