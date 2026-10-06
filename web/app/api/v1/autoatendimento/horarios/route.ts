import { HorariosQuery } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { consultarHorarios } from "@/lib/autoatendimento/horarios"
import { criarRota } from "@/lib/http/rota"

/**
 * Horários livres de um serviço num dia (03). Query estrita: `organizationId`,
 * telefone etc. dão 422. Não exige cliente identificado.
 */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, config, parseQuery }) => ({
    data: await consultarHorarios(db, org, config, parseQuery(HorariosQuery)),
  }),
})
