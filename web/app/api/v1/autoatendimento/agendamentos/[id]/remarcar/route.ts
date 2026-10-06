import { RemarcarAgendamentoBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { idDoAgendamento, remarcarDoCliente } from "@/lib/autoatendimento/escrita"
import { exigirIdentificado } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { criarRota } from "@/lib/http/rota"

/** Remarca o próprio agendamento (04): mesmo registro, serviço fixo, volta a `pending`. */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, config, params, body }) => {
    const entrada = await body(RemarcarAgendamentoBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })

    const cliente = await exigirIdentificado(db, org, telefone)
    const agendamento = await remarcarDoCliente(
      db,
      { orgId: org, clienteId: cliente.clienteId, config },
      idDoAgendamento(params),
      entrada
    )

    return { data: { agendamento } }
  },
})
