import "server-only"

import type { Db } from "@/lib/domain/db"

/** Política do add-on para uma org (01-configuracao). Colunas em camelCase. */
export type ConfigAutoatendimento = {
  antecedenciaMinimaMinutos: number
  janelaMaximaDias: number
  maxAgendamentosAtivos: number
  /** Só o Eliza usa (escalonamento). Nunca vai para o contexto do atendente. */
  contatoHumanoTelefone: string | null
  instrucoesAtendimento: string | null
}

/**
 * `null` = o add-on não atende esta org: sem linha, `ativo = false` ou org de
 * demonstração (que nunca é atendida, com ou sem linha). Quem recebe `null`
 * responde ADDON_INACTIVE. O código nunca cria a linha.
 */
export async function carregarConfig(db: Db, orgId: string): Promise<ConfigAutoatendimento | null> {
  const { data, error } = await db
    .from("autoatendimento_config")
    .select("*, organizations ( is_demo )")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) {
    console.error("[autoatendimento:config]", error)
    throw error
  }

  if (!data || !data.ativo || data.organizations?.is_demo) return null

  return {
    antecedenciaMinimaMinutos: data.antecedencia_minima_minutos,
    janelaMaximaDias: data.janela_maxima_dias,
    maxAgendamentosAtivos: data.max_agendamentos_ativos,
    contatoHumanoTelefone: data.contato_humano_telefone,
    instrucoesAtendimento: data.instrucoes_atendimento,
  }
}
