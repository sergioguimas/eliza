'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { mudarStatus } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

// Única action de cancelamento do painel (antes havia duas, em arquivos
// diferentes, com textos e regras diferentes). Cancelar um agendamento
// finalizado ou faltoso é recusado pela máquina de status.
export async function cancelAppointment(appointmentId: string) {
  // A org vem do perfil da sessão, nunca de argumento: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  try {
    await mudarStatus(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, true),
      appointmentId,
      "canceled"
    )
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao cancelar:", error)
    return { error: "Erro ao cancelar agendamento" }
  }

  revalidatePath('/agendamentos')
  revalidatePath('/dashboard')
  revalidatePath('/')

  return { success: true }
}
