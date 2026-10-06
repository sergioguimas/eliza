import { EscalonarBody } from "@/contracts/autoatendimento"
import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { escalarParaEquipe } from "@/lib/autoatendimento/escalonamento"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { criarRota } from "@/lib/http/rota"

/** O atendente pede ajuda humana (06). Não exige cliente identificado. */
export const POST = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, config, body }) => {
    const entrada = await body(EscalonarBody)

    await consumirLimite(db, "aa-escalar", { org, telefone })

    return { data: { equipeNotificada: await escalarParaEquipe(db, { org, telefone, config, entrada }) } }
  },
})
