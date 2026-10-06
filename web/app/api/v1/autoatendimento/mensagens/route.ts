import { EnviarMensagemBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { enviarAoCliente } from "@/lib/autoatendimento/mensagens"
import { criarRota } from "@/lib/http/rota"

/**
 * O atendente envia texto ao telefone do ticket, pela instância da org (06).
 * `.strict()` no body: nenhum campo de destino é aceito. Não exige cliente
 * identificado (o desconhecido também precisa de resposta).
 */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, body }) => {
    const { texto } = await body(EnviarMensagemBody)

    await consumirLimite(db, "aa-msg-contato", { org, telefone })
    await consumirLimite(db, "aa-msg-org", { org, telefone })

    return { data: { mensagemId: await enviarAoCliente({ org, telefone, texto }) } }
  },
})
