import { ConfirmarAgendamentoBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { corpoOpcional } from "@/lib/autoatendimento/corpo"
import { confirmarDoCliente, idDoAgendamento } from "@/lib/autoatendimento/escrita"
import { exigirIdentificado } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { criarRota } from "@/lib/http/rota"

/** O cliente diz "vou" (04): só `scheduled`; repetir em `confirmed` devolve 200 sem novo log. */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, req, org, telefone, config, params }) => {
    await corpoOpcional(req, ConfirmarAgendamentoBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })

    const cliente = await exigirIdentificado(db, org, telefone)
    const agendamento = await confirmarDoCliente(
      db,
      { orgId: org, clienteId: cliente.clienteId, config },
      idDoAgendamento(params)
    )

    return { data: { agendamento } }
  },
})
