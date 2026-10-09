import "server-only"

import { ApiError } from "@/lib/http/erros"
import { baixarMidia } from "@/lib/whatsapp/gateway"

/** 16 MB decodificados. Áudio de WhatsApp é bem menor (opus, ~100 KB por minuto). */
const TAMANHO_MAXIMO_BYTES = 16 * 1024 * 1024

/**
 * Mídia da mensagem do ticket, para o atendente transcrever (07 §4.2). A
 * quem pode pedir qual mensagem a rota decide; aqui só se busca e se confere o
 * tamanho. Nada é gravado e nada do conteúdo vai para o log.
 */
export async function baixarMidiaDaMensagem(p: { org: string; mensagemId: string }) {
  const midia = await baixarMidia({ organizationId: p.org, mensagemId: p.mensagemId })

  if (!midia.ok) {
    if (midia.motivo === "nao_encontrada") {
      console.warn("[autoatendimento:midia] mensagem não encontrada na Evolution")

      throw new ApiError("NOT_FOUND", "Mídia não encontrada. Ela pode ter expirado.")
    }

    // O motivo fica só no log; o atendente recebe texto fixo.
    console.error("[autoatendimento:midia] falha ao baixar:", midia.erro)

    throw new ApiError(
      "WHATSAPP_UNAVAILABLE",
      "Não foi possível baixar a mídia pelo WhatsApp agora. Tente novamente em instantes."
    )
  }

  if (midia.tamanho > TAMANHO_MAXIMO_BYTES) {
    console.warn(`[autoatendimento:midia] acima do limite tamanho=${midia.tamanho}`)

    throw new ApiError("MEDIA_TOO_LARGE", "A mídia é grande demais para ser processada.")
  }

  console.log(`[autoatendimento:midia] ok tamanho=${midia.tamanho}`)

  return { mime: midia.mime, tamanho: midia.tamanho, base64: midia.base64 }
}
