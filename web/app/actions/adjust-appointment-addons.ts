'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { AdicionaisEscolhidos } from "@/contracts/comum/adicionais"
import { ajustarAdicionais } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

/** Ajusta os adicionais de um agendamento ainda não pago; recalcula o valor no servidor. */
export async function adjustAppointmentAddons(appointmentId: string, adicionais: unknown) {
  // A org vem do perfil da sessão, nunca de argumento: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  const lidos = AdicionaisEscolhidos.safeParse(adicionais)

  if (!lidos.success) return { error: "Adicionais inválidos." }

  try {
    const { alterado } = await ajustarAdicionais(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, false),
      appointmentId,
      lidos.data
    )

    revalidatePath("/agendamentos")
    revalidatePath("/dashboard")
    revalidatePath("/clientes")

    return { success: true, alterado }
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao ajustar adicionais:", error)
    return { error: "Não foi possível ajustar os adicionais." }
  }
}
