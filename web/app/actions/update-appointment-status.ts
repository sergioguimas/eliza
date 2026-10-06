'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from 'next/cache'
import { Database } from "@/utils/database.types"
import { mudarStatus } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { ehStatus } from "@/lib/domain/status"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

export async function updateAppointmentStatus(appointmentId: string, newStatus: string) {
  // A org vem do perfil da sessão, nunca de argumento: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  // O argumento chega do navegador como string qualquer; valor fora do enum nem entra no domínio.
  if (!ehStatus(newStatus)) return { error: "Status inválido." }

  try {
    // Sem aviso ao cliente: esta action nunca mandou WhatsApp (só cancelAppointment
    // e a fila de pedidos mandam), e confirmar/chegou/finalizar pelo menu não deve começar agora.
    await mudarStatus(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, false),
      appointmentId,
      newStatus
    )
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao atualizar status:", error)
    return { error: "Erro ao atualizar status" }
  }

  revalidatePath('/')
  revalidatePath('/agendamentos')
  return { success: true }
}
