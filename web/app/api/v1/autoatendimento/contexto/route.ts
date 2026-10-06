import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { montarContexto } from "@/lib/autoatendimento/contexto"
import { criarRota } from "@/lib/http/rota"

/**
 * Contexto do turno (02): quem é o telefone do ticket, política da org, termos
 * do nicho e agendamentos futuros. Sem query. Org e telefone vêm só do ticket.
 */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, config }) => ({
    data: await montarContexto(db, { org, telefone, config }),
  }),
})
