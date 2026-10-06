import { CriarAgendamentoBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { listarAgendamentosDoCliente } from "@/lib/autoatendimento/agendamentos"
import { criarDoCliente } from "@/lib/autoatendimento/escrita"
import { exigirIdentificado } from "@/lib/autoatendimento/identificar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { criarRota } from "@/lib/http/rota"

const MAX_AGENDAMENTOS = 20

/**
 * Agendamentos futuros e ativos do cliente do ticket (04). Posse: a consulta
 * filtra por org E cliente, então nada de outro cliente aparece.
 */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, config }) => {
    const cliente = await exigirIdentificado(db, org, telefone)

    const agendamentos = await listarAgendamentosDoCliente(db, {
      orgId: org,
      clienteId: cliente.clienteId,
      config,
      limite: MAX_AGENDAMENTOS,
    })

    return { data: { agendamentos: agendamentos.map((a) => a.resumo) } }
  },
})

/**
 * Cria um agendamento `pending` (D8) para o cliente do ticket (04). O cliente é
 * sempre o do ticket, nunca do body (`.strict()` rejeita `customerId`).
 */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, config, body }) => {
    const entrada = await body(CriarAgendamentoBody)

    await consumirLimite(db, "aa-escrita", { org, telefone })
    await consumirLimite(db, "aa-criar", { org, telefone })

    const cliente = await exigirIdentificado(db, org, telefone)
    const agendamento = await criarDoCliente(db, { orgId: org, clienteId: cliente.clienteId, config }, entrada)

    return { status: 201, data: { agendamento } }
  },
})
