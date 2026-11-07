import "server-only"

import { lerAgendaVisivelDias } from "@/lib/domain/agenda-visivel"
import type { Db } from "@/lib/domain/db"

/** Política do add-on para uma org (01-configuracao). Colunas em camelCase. */
export type ConfigAutoatendimento = {
  antecedenciaMinimaMinutos: number
  /** Vem de organization_settings.agenda_visivel_dias (11). 0 = agenda fechada. */
  janelaMaximaDias: number
  maxAgendamentosAtivos: number
  /** Só o Eliza usa (escalonamento). Nunca vai para o contexto do atendente. */
  contatoHumanoTelefone: string | null
  instrucoesAtendimento: string | null
  /** Personalização do atendente (07 §5). Todas nulas = "use o padrão". */
  atendentePersona: string | null
  atendenteTom: string | null
  pausaHumanaHoras: number | null
  respostaConfirmado: string | null
  respostaCancelado: string | null
  respostaFalhaTecnica: string | null
  respostaMidiaNaoSuportada: string | null
  respostaAudioLongo: string | null
  respostaEquipeSemContato: string | null
  palavrasConfirmar: string[] | null
  palavrasCancelar: string[] | null
  /** Chat da página pública (08). Sozinho não liga nada: exige a config ativa. */
  canalWeb: boolean
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

  // A janela mora no núcleo (11); autoatendimento_config.janela_maxima_dias é obsoleta e não é lida.
  const janelaMaximaDias = await lerAgendaVisivelDias(db, orgId)

  return {
    antecedenciaMinimaMinutos: data.antecedencia_minima_minutos,
    janelaMaximaDias,
    maxAgendamentosAtivos: data.max_agendamentos_ativos,
    contatoHumanoTelefone: data.contato_humano_telefone,
    instrucoesAtendimento: data.instrucoes_atendimento,
    atendentePersona: data.atendente_persona,
    atendenteTom: data.atendente_tom,
    pausaHumanaHoras: data.pausa_humana_horas,
    respostaConfirmado: data.resposta_confirmado,
    respostaCancelado: data.resposta_cancelado,
    respostaFalhaTecnica: data.resposta_falha_tecnica,
    respostaMidiaNaoSuportada: data.resposta_midia_nao_suportada,
    respostaAudioLongo: data.resposta_audio_longo,
    respostaEquipeSemContato: data.resposta_equipe_sem_contato,
    palavrasConfirmar: data.palavras_confirmar,
    palavrasCancelar: data.palavras_cancelar,
    canalWeb: data.canal_web,
  }
}

/** Chat ativo = serviço configurado, config ativa e `canal_web` ligado (08 §1). */
export function canalWebLigado(config: ConfigAutoatendimento | null) {
  return Boolean(process.env.ATENDENTE_URL?.trim()) && config?.canalWeb === true
}

export async function chatWebAtivo(db: Db, orgId: string) {
  if (!process.env.ATENDENTE_URL?.trim()) return false

  return canalWebLigado(await carregarConfig(db, orgId))
}
