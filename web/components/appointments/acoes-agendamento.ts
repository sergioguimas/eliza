// Ponte entre o agendamento que o painel carrega (status como string solta,
// vindo do banco) e a regra de domínio. Os dois menus (card e clique direito),
// o diálogo de edição, a agenda e o financeiro perguntam AQUI o que está
// disponível: nenhum deles compara status para decidir ação, e por isso os
// menus não divergem entre si nem do que a action vai recusar.
//
// Só importa `lib/domain/status` (puro). Nada server-only entra num componente client.

import {
  acoesDisponiveis,
  ehStatus,
  METODOS_PAGAMENTO,
  type AcoesDisponiveis,
  type MetodoPagamento,
} from "@/lib/domain/status"

const NENHUMA: AcoesDisponiveis = {
  confirmar: false,
  chegou: false,
  finalizar: false,
  faltou: false,
  cancelar: false,
  editar: false,
  pagar: false,
}

type AgendamentoDoPainel = {
  status?: string | null
  start_time?: string | null
  payment_status?: string | null
}

/**
 * `agora` é lido a cada render: "Faltou" só aparece depois do horário (D11).
 * Se o menu ficou aberto de antes do horário, a action ainda recusa — a
 * máquina de status é a palavra final, isto aqui só evita oferecer o que
 * sabidamente vai falhar.
 */
export function acoesDoAgendamento(
  agendamento: AgendamentoDoPainel,
  agora: Date = new Date()
): AcoesDisponiveis {
  // Status desconhecido ou linha incompleta: não oferece nada em vez de adivinhar.
  if (!ehStatus(agendamento.status) || !agendamento.start_time) return NENHUMA

  return acoesDisponiveis(
    {
      status: agendamento.status,
      inicio: new Date(agendamento.start_time),
      pagamento: agendamento.payment_status ?? null,
    },
    agora
  )
}

/** Métodos que os menus oferecem. Valores são os do enum do banco (METODOS_PAGAMENTO). */
export const METODOS_NOS_MENUS: MetodoPagamento[] = METODOS_PAGAMENTO.filter(
  (m) => m !== "outro"
)

/** As actions devolvem `{ error }` em vez de lançar; isto separa o erro do sucesso. */
export type ResultadoAction = { success?: boolean; error?: string }

/**
 * Para `toast.promise`: transforma `{ error }` em rejeição, senão o toast
 * mostraria sucesso mesmo quando a action recusou. A mensagem da action
 * (já em português, vinda do domínio) chega ao toast por `Error.message`.
 */
export async function lancarSeErro<T extends ResultadoAction>(
  promessa: Promise<T>
): Promise<T> {
  const resultado = await promessa

  if (resultado.error) throw new Error(resultado.error)

  return resultado
}

/** Rótulo do método no menu; o dicionário do nicho pode renomear, o valor gravado é sempre o do enum. */
export function rotuloMetodo(metodo: MetodoPagamento, labels: Record<string, string>): string {
  switch (metodo) {
    case "pix":
      return "Pix"
    case "cartao_credito":
      return labels.credit_card || "Cartão de crédito"
    case "cartao_debito":
      return labels.debit_card || "Cartão de débito"
    case "dinheiro":
      return labels.cash || "Dinheiro"
    default:
      return labels.other || "Outro"
  }
}
