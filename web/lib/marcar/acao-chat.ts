import type { AcaoPreencherAgendamento } from "@/contracts/autoatendimento"

/**
 * Regras de `aplicarAcao` (contrato 08 §7.3) sem React, para testar. O agente
 * sugere; quem decide o que entra no formulário é a página.
 */

export type EscolhasValidas = {
  servicoId?: string
  profissionalId?: string
  data?: string
  hora?: string
  /** Algo da ação não é desta página: id de outra org, data passada ou domingo. */
  descartou: boolean
}

/** `null` se a data não existe: o `Date` rola 2026-99-99 para o futuro em vez de recusar. */
function dataLocal(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number)
  const data = new Date(ano, mes - 1, dia)

  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia ? data : null
}

/** Passo 1: filtra pelo que a página conhece. */
export function filtrarAcao(
  acao: AcaoPreencherAgendamento,
  pagina: { servicoIds: string[]; profissionalIds: string[]; hoje: Date }
): EscolhasValidas {
  const inicioDeHoje = new Date(pagina.hoje.getFullYear(), pagina.hoje.getMonth(), pagina.hoje.getDate())
  const out: EscolhasValidas = { descartou: false, hora: acao.hora }

  if (acao.servicoId) {
    if (pagina.servicoIds.includes(acao.servicoId)) out.servicoId = acao.servicoId
    else out.descartou = true
  }
  if (acao.profissionalId) {
    if (pagina.profissionalIds.includes(acao.profissionalId)) out.profissionalId = acao.profissionalId
    else out.descartou = true
  }
  if (acao.data) {
    const data = dataLocal(acao.data)
    const valida = data !== null && data >= inicioDeHoje && data.getDay() !== 0

    if (valida) out.data = acao.data
    else out.descartou = true
  }

  return out
}

/** Passo 5: a primeira etapa com escolha faltando. */
export function etapaDaEscolha(f: { servicoId: string; profissionalId: string; data: unknown; hora: string }) {
  if (!f.servicoId || !f.profissionalId) return 1
  if (!f.data || !f.hora) return 2

  return 3
}

export { dataLocal }
