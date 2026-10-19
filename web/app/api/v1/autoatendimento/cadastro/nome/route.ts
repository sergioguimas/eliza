import { VerificarNomeQuery } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { identificarCliente } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { existeClienteComNome } from "@/lib/domain/clientes"
import { ApiError } from "@/lib/http/erros"
import { criarRota } from "@/lib/http/rota"

/**
 * "Já existe cadastro com este nome?" (07 §2). Só para `desconhecido`, devolve
 * só `existe` e compara o nome completo exato: quem diz o nome de outra pessoa
 * não ganha acesso nem confirmação de dado. O nome pesquisado nunca vai para o log.
 */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, parseQuery }) => {
    const { nome } = parseQuery(VerificarNomeQuery)

    const identificacao = await identificarCliente(db, org, telefone)

    if (identificacao.situacao === "identificado") {
      throw new ApiError("CUSTOMER_CONFLICT", "Este número já tem cadastro.")
    }

    if (identificacao.situacao === "ambiguo") {
      throw new ApiError(
        "CUSTOMER_AMBIGUOUS",
        "Não foi possível identificar o cadastro com segurança. A equipe do estabelecimento precisa resolver."
      )
    }

    await consumirLimite(db, "aa-nome", { org, telefone })

    const existe = await existeClienteComNome(db, org, nome)

    console.log(`[autoatendimento:cadastro-nome] existe=${existe}`)

    return { data: { existe } }
  },
})
