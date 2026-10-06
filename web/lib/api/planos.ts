/**
 * Gate de plano da API B2B (D7). Sem `server-only` de propósito: a tela de chaves
 * usa a mesma regra para avisar o admin, e a regra é só dado + uma função pura.
 */

/** Planos com acesso à API. "todos" = sem gate (estado inicial). Ligar o gate é trocar esta constante. */
export const PLANOS_COM_API: readonly string[] | "todos" = "todos"

export const MENSAGEM_PLANO_SEM_API = "O plano da organização não inclui acesso à API"

/**
 * Fonte única da regra: autenticador de chave, server action de criar chave e tela
 * dependem desta função, então a UI nunca promete o que o servidor recusaria.
 * Plano nulo (org sem plano gravado) conta como fora da lista quando há gate.
 */
export function planoPermiteApi(plano: string | null | undefined): boolean {
  if (PLANOS_COM_API === "todos") return true

  return !!plano && PLANOS_COM_API.includes(plano)
}
