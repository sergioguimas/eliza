import { AtualizarCadastroBody, CriarCadastroBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { atualizarCadastro, criarCadastro, lerCadastro } from "@/lib/autoatendimento/cadastro"
import { exigirIdentificado, identificarCliente } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { ApiError } from "@/lib/http/erros"
import { criarRota } from "@/lib/http/rota"

/**
 * Cadastro do PRÓPRIO cliente (05): sempre o do telefone do ticket. Não existe
 * busca por nome, documento ou outro telefone, e o telefone nunca vem no body.
 */

/** Exige `identificado`. Devolve o Cadastro (sem endereço, observações nem documento completo). */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone }) => {
    const cliente = await exigirIdentificado(db, org, telefone)

    return { data: { cadastro: await lerCadastro(db, org, cliente.clienteId) } }
  },
})

/** Só quando `desconhecido`: `identificado` -> CUSTOMER_CONFLICT; `ambiguo` -> CUSTOMER_AMBIGUOUS. */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, body }) => {
    const entrada = await body(CriarCadastroBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })

    const identificacao = await identificarCliente(db, org, telefone)

    if (identificacao.situacao === "identificado") {
      throw new ApiError("CUSTOMER_CONFLICT", "Este número de WhatsApp já tem cadastro. Use a atualização de cadastro.")
    }

    if (identificacao.situacao === "ambiguo") {
      throw new ApiError(
        "CUSTOMER_AMBIGUOUS",
        "Não foi possível identificar o cadastro com segurança. A equipe do estabelecimento precisa resolver."
      )
    }

    return { status: 201, data: { cadastro: await criarCadastro(db, org, telefone, entrada) } }
  },
})

/** Exige `identificado`. Documento só se o cadastro ainda não tem; telefone nunca muda. */
export const PATCH = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, body }) => {
    const entrada = await body(AtualizarCadastroBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })

    const cliente = await exigirIdentificado(db, org, telefone)

    return { data: { cadastro: await atualizarCadastro(db, org, cliente.clienteId, entrada) } }
  },
})
