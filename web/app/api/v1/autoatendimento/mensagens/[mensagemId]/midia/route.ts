import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { consumirLimite } from "@/lib/autoatendimento/limites"
import { baixarMidiaDaMensagem } from "@/lib/autoatendimento/midia"
import { ApiError } from "@/lib/http/erros"
import { criarRota } from "@/lib/http/rota"

/**
 * Mídia da mensagem que gerou o ticket (07 §4.2), em base64 dentro do envelope.
 * O ticket só abre a mídia DAQUELA mensagem: outro id, ou mensagem de outra
 * conversa, responde NOT_FOUND. Nada é gravado.
 */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org, telefone, mensagemId, params }) => {
    if (params.mensagemId !== mensagemId) {
      throw new ApiError("NOT_FOUND", "Mídia não encontrada.")
    }

    await consumirLimite(db, "aa-midia", { org, telefone })

    return { data: await baixarMidiaDaMensagem({ org, mensagemId }) }
  },
})
