'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { registrarPagamento } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

// `method` é obrigatório e precisa estar no enum do banco. O antigo default
// 'Outros' violava o CHECK de payment_method e só quebrava em chamada direta.
export async function updateAppointmentPayment(appointmentId: string, method: string) {
  // A org vem do perfil da sessão, nunca de argumento: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  try {
    await registrarPagamento(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, false),
      appointmentId,
      { metodo: method, status: "paid" }
    )
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao baixar pagamento:", error)
    return { error: "Falha ao processar pagamento." }
  }

  revalidatePath('/dashboard/financas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard')
  return { success: true }
}
