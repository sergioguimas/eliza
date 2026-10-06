import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { listarAgendamentosDoCliente } from "@/lib/autoatendimento/agendamentos"
import { exigirIdentificado } from "@/lib/autoatendimento/identificar"
import { criarRota } from "@/lib/http/rota"

const MAX_AGENDAMENTOS = 20

/**
 * Agendamentos futuros e ativos do cliente do ticket (04). Posse: a consulta
 * filtra por org E cliente, então nada de outro cliente aparece.
 * (O POST desta rota é do bloco B.)
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
