/**
 * Gate de plano da biblioteca de fotos e da vitrine (decisão MV12, contrato midia-vitrine). Mesmo molde de
 * lib/api/planos.ts: só dado + função pura, então a tela e o servidor usam a mesma regra.
 */

/** Planos com acesso. "todos" = sem gate (estado inicial). Ligar o gate é trocar esta constante. */
export const PLANOS_COM_VITRINE: readonly string[] | "todos" = "todos"

export const MENSAGEM_PLANO_SEM_VITRINE = "O plano da organização não inclui fotos e vitrine"

/** Plano nulo (org sem plano gravado) conta como fora da lista quando há gate. */
export function planoPermiteVitrine(plano: string | null | undefined): boolean {
  if (PLANOS_COM_VITRINE === "todos") return true

  return !!plano && PLANOS_COM_VITRINE.includes(plano)
}
