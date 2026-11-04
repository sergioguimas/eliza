import { createHmac } from "node:crypto"

/** hex(HMAC-SHA256(segredo, `${timestamp}.${corpo}`)) sobre a string exata que vai no corpo. */
export function assinarEncaminhamento(segredo: string, timestamp: string, corpo: string) {
  return createHmac("sha256", segredo).update(`${timestamp}.${corpo}`).digest("hex")
}

/**
 * Assinatura do treino (contrato 10 §3). Método e caminho entram para uma
 * assinatura não valer em outra rota: a de um `GET /perfil` não pode zerar o
 * perfil. `caminho` é o que vem depois de `/v1/treino`, com a query. `conteudo` é
 * o corpo; sem corpo, `${tenant}.${id}.${papel}`.
 */
export function assinarTreino(segredo: string, timestamp: string, metodo: string, caminho: string, conteudo: string) {
  return assinarEncaminhamento(segredo, timestamp, `${metodo}.${caminho}.${conteudo}`)
}
