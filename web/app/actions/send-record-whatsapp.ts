'use server'

import { createClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { sendWhatsAppMedia } from "./send-whatsapp"

// PDF gerado no navegador; 5 MB em base64 cobre com folga um prontuário.
const MAX_MEDIA_BASE64_LENGTH = 7_000_000

/**
 * Envia o PDF de um registro de atendimento para o WhatsApp do cliente.
 *
 * Substitui a chamada direta de `sendWhatsAppMedia` pelo client component, que
 * aceitava telefone e organização vindos do navegador. Aqui:
 *   - exige sessão;
 *   - a org sai do perfil, nunca do client;
 *   - o telefone sai do cadastro do cliente, lido com o client de sessão
 *     (RLS) e filtrado pela org do perfil.
 */
export async function sendServiceRecordPdf(input: {
  customerId: string
  caption: string
  media: string
  fileName: string
}) {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Usuário não autenticado." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { success: false, error: "Perfil sem organização." }
  }

  if (!input.media || input.media.length > MAX_MEDIA_BASE64_LENGTH) {
    return { success: false, error: "Arquivo inválido." }
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("phone")
    .eq("id", input.customerId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  if (!customer?.phone) {
    return { success: false, error: "Cliente sem telefone." }
  }

  return sendWhatsAppMedia({
    phone: customer.phone,
    caption: input.caption,
    media: input.media,
    fileName: input.fileName,
    organizationId: profile.organization_id,
  })
}
