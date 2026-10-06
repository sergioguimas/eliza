// PURO de propósito: sem banco, sem segredo, sem `server-only`. Os componentes
// do painel (client) importam este arquivo para decidir quais ações mostrar
// (`acoesDisponiveis`), e o domínio (server) o usa para recusar a mesma ação.
// Uma função só nos dois lados é o que impede os menus de divergirem da regra.
//
// Regra (D4, ditada pelo dono do produto): `completed`, `no_show` e `canceled`
// são finais. Depois de `completed` só se registra pagamento.

export const STATUS = [
  "pending",
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "canceled",
  "no_show",
] as const

export type Status = (typeof STATUS)[number]

/** Ocupam agenda: mesmo conjunto da exclusion constraint appointments_professional_overlap_idx. */
export const ATIVOS: Status[] = ["pending", "scheduled", "confirmed", "arrived"]

/** Podem ser remarcados/editados. */
export const EDITAVEIS: Status[] = ["pending", "scheduled", "confirmed"]

export const FINAIS: Status[] = ["completed", "canceled", "no_show"]

export const TRANSICOES: Record<Status, Status[]> = {
  pending: ["scheduled", "confirmed", "canceled"],
  scheduled: ["confirmed", "arrived", "completed", "no_show", "canceled"],
  confirmed: ["arrived", "completed", "no_show", "canceled"],
  // Quem chegou não é falta: arrived não vira no_show.
  arrived: ["completed", "canceled"],
  completed: [],
  canceled: [],
  no_show: [],
}

export function ehStatus(valor: unknown): valor is Status {
  return typeof valor === "string" && (STATUS as readonly string[]).includes(valor)
}

/**
 * `→ no_show` só vale depois do horário de início (D11), em todos os canais:
 * não se marca falta antecipada. Repetir o status atual NÃO é transição
 * (quem escreve trata como idempotente antes de chamar aqui).
 */
export function podeTransicionar(de: Status, para: Status, inicio: Date, agora: Date): boolean {
  if (!TRANSICOES[de]?.includes(para)) return false
  if (para === "no_show") return inicio.getTime() <= agora.getTime()

  return true
}

export function podeEditar(s: Status): boolean {
  return EDITAVEIS.includes(s)
}

/** Sinal antes de concluir é permitido (D10). Sem taxa de falta: canceled e no_show não recebem. */
export function podeReceberPagamento(s: Status): boolean {
  return s !== "canceled" && s !== "no_show"
}

// = appointments_payment_method_check no banco.
export const METODOS_PAGAMENTO = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "outro"] as const
export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number]

export const STATUS_DE_PAGAMENTO = ["pending", "paid", "partially_paid", "refunded"] as const
export type StatusPagamento = (typeof STATUS_DE_PAGAMENTO)[number]

export type AcoesDisponiveis = {
  confirmar: boolean
  chegou: boolean
  finalizar: boolean
  faltou: boolean
  cancelar: boolean
  editar: boolean
  pagar: boolean
}

/**
 * Para a UI: quais ações o painel mostra para este agendamento agora.
 * Derivada SÓ das funções acima, sem `if` próprio, para o menu nunca oferecer
 * o que o domínio vai recusar.
 */
export function acoesDisponiveis(
  a: { status: Status; inicio: Date; pagamento: string | null },
  agora: Date
): AcoesDisponiveis {
  return {
    confirmar: podeTransicionar(a.status, "confirmed", a.inicio, agora),
    chegou: podeTransicionar(a.status, "arrived", a.inicio, agora),
    finalizar: podeTransicionar(a.status, "completed", a.inicio, agora),
    faltou: podeTransicionar(a.status, "no_show", a.inicio, agora),
    cancelar: podeTransicionar(a.status, "canceled", a.inicio, agora),
    editar: podeEditar(a.status),
    pagar: podeReceberPagamento(a.status) && a.pagamento !== "paid",
  }
}
