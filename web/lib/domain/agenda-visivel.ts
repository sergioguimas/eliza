import "server-only"

import type { Db } from "./db"

/** Dias à frente liberados quando a org não tem linha em organization_settings. */
export const AGENDA_VISIVEL_PADRAO = 60

/** Textos de recusa no /marcar (11 §4); `agenda_closed` quando o valor é 0. */
export const MENSAGEM_FORA_DA_JANELA = "Data fora do período liberado para agendamento online."
export const MENSAGEM_AGENDA_FECHADA = "A agenda online está fechada no momento."

/** Dias à frente que atendente e /marcar podem usar. Linha ausente = padrão. */
export async function lerAgendaVisivelDias(db: Db, orgId: string): Promise<number> {
  const { data, error } = await db
    .from("organization_settings")
    .select("agenda_visivel_dias")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) {
    console.error("[agenda-visivel]", error)
    throw error
  }

  return data?.agenda_visivel_dias ?? AGENDA_VISIVEL_PADRAO
}

/** Soma dias a uma data de calendário "AAAA-MM-DD" sem passar por fuso. */
function somar(data: string, dias: number) {
  const [y, m, d] = data.split("-").map(Number)

  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

/**
 * Pura: a data local `data` (AAAA-MM-DD) está em [hoje, hoje + dias]?
 * `dias = 0` é agenda fechada: nenhuma data vale, nem hoje.
 */
export function dentroDaAgendaVisivel(data: string, hoje: string, dias: number): boolean {
  if (dias <= 0) return false

  return data >= hoje && data <= somar(hoje, dias)
}
