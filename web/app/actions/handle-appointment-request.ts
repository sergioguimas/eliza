'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { mudarStatus } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

export async function handleAppointmentRequest(
  appointmentId: string,
  action: 'confirm' | 'reject'
) {
  // A org vem do perfil da sessão, nunca de argumento: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  // `action` chega do navegador: qualquer outro valor não vira transição.
  if (action !== 'confirm' && action !== 'reject') {
    return { error: "Ação inválida." }
  }

  try {
    // aoResponderPedido: o cliente recebe o texto de pedido aprovado/recusado
    // (com o nome da organização), e não o de confirmação/cancelamento comum.
    // A falha do WhatsApp não desfaz a mudança: o domínio só loga.
    await mudarStatus(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, true),
      appointmentId,
      action === 'confirm' ? 'confirmed' : 'canceled',
      { aoResponderPedido: true }
    )
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao processar agendamento:", error)
    return { error: "Não foi possível atualizar o status do agendamento." }
  }

  // Revalida a página de agendamentos e a dashboard para atualizar as listas
  revalidatePath('/agendamentos')
  revalidatePath('/dashboard')

  return { success: true }
}
