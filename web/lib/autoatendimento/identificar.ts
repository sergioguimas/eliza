import "server-only"

import { ApiError } from "@/lib/http/erros"
import { buscarPorTelefone } from "@/lib/domain/clientes"
import type { Db } from "@/lib/domain/db"

export type Identificacao =
  | { situacao: "identificado"; clienteId: string; primeiroNome: string }
  | { situacao: "desconhecido" }
  | { situacao: "ambiguo" }

/**
 * Quem é o telefone do ticket nesta org (02). `buscarPorTelefone` já casa as
 * variantes BR (com/sem DDI, com/sem 9º dígito), só cadastros não apagados.
 *
 * NUNCA desempata: 2 ou mais cadastros é `ambiguo`, e a equipe resolve. Não
 * pegar a primeira linha, a mais recente nem a que "parece" certa.
 */
export async function identificarCliente(db: Db, orgId: string, telefoneDoTicket: string): Promise<Identificacao> {
  const achados = await buscarPorTelefone(db, orgId, telefoneDoTicket)

  if (achados.length === 0) return { situacao: "desconhecido" }
  if (achados.length > 1) return { situacao: "ambiguo" }

  return {
    situacao: "identificado",
    clienteId: achados[0].id,
    primeiroNome: achados[0].nome.trim().split(/\s+/)[0] ?? "",
  }
}

/**
 * Porta dos endpoints que exigem cliente identificado (04 e 05). Desconhecido
 * e ambíguo viram o erro do canal, com texto que o atendente repassa.
 */
export async function exigirIdentificado(db: Db, orgId: string, telefoneDoTicket: string) {
  const identificacao = await identificarCliente(db, orgId, telefoneDoTicket)

  if (identificacao.situacao === "desconhecido") {
    throw new ApiError(
      "CUSTOMER_NOT_IDENTIFIED",
      "Ainda não há cadastro com este número de WhatsApp. É preciso se cadastrar antes."
    )
  }

  if (identificacao.situacao === "ambiguo") {
    throw new ApiError(
      "CUSTOMER_AMBIGUOUS",
      "Não foi possível identificar o cadastro com segurança. A equipe do estabelecimento precisa resolver."
    )
  }

  return identificacao
}
