import { CancelarAgendamentoBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { corpoOpcional } from "@/lib/autoatendimento/corpo"
import { cancelarDoCliente, idDoAgendamento } from "@/lib/autoatendimento/escrita"
import { exigirIdentificado } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { criarRota } from "@/lib/http/rota"

/** Cancela o próprio agendamento (04): `status = canceled`, o registro continua existindo. */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, req, org, telefone, config, params }) => {
    const entrada = await corpoOpcional(req, CancelarAgendamentoBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })

    const cliente = await exigirIdentificado(db, org, telefone)
    const agendamento = await cancelarDoCliente(
      db,
      { orgId: org, clienteId: cliente.clienteId, config },
      idDoAgendamento(params),
      entrada
    )

    return { data: { agendamento } }
  },
})
