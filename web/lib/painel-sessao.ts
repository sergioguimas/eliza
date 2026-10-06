import "server-only"

import { createClient } from "@/utils/supabase/server"
import type { Ator } from "@/lib/domain/agendamentos"
import type { Database } from "@/utils/database.types"

/**
 * Org do usuário logado, lida do perfil da sessão. As actions do painel rodam
 * o domínio com service role (o RLS não escopa nada), então a org NUNCA pode
 * vir do FormData nem de argumento: quem chama a action direto escolheria a
 * org que quisesse.
 */
export async function organizacaoDaSessao(): Promise<{ organizationId: string } | { error: string }> {
  const session = await createClient<Database>()

  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) return { error: "Sessão expirada. Entre novamente." }

  const { data: profile } = await session.from("profiles").select("organization_id").eq("id", user.id).single()

  if (!profile?.organization_id) return { error: "Seu perfil não está vinculado a uma organização." }

  return { organizationId: profile.organization_id }
}

/** Ator do painel; `notificar` liga o aviso por WhatsApp ao cliente. */
export function atorDoPainel(organizationId: string, notificar: boolean): Ator {
  return {
    canal: "painel",
    organizationId,
    origem: "painel",
    podeNotificar: notificar ? async () => true : null,
  }
}
