import "server-only"

import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"

/**
 * Único ponto de saída de texto de WhatsApp para quem não é o painel (hoje, o
 * autoatendimento). Encapsula o primitivo de envio e esconde a Evolution: uma
 * troca de gateway (Evolution Go, por exemplo) mexe só aqui.
 *
 * Quem chama decide SE pode enviar (o ticket prova quem escreveu); este módulo
 * só entrega, sempre pela instância da organização, nunca por outra.
 */

export type ResultadoEnvio =
  | {
      ok: true
      /** id da mensagem na Evolution (`key.id`); null se o servidor não devolveu. */
      mensagemId: string | null
    }
  | { ok: false; erro: string }

export async function enviarTexto(p: {
  organizationId: string
  telefone: string
  texto: string
}): Promise<ResultadoEnvio> {
  const envio = await sendWhatsAppMessage({
    organizationId: p.organizationId,
    phone: p.telefone,
    message: p.texto,
  })

  if (!envio.success) {
    // `erro` pode ser o corpo da resposta da Evolution (objeto): vai só para o log de quem chama.
    return {
      ok: false,
      erro: typeof envio.error === "string" ? envio.error : JSON.stringify(envio.error),
    }
  }

  const id = (envio.data as { key?: { id?: unknown } } | undefined)?.key?.id

  return { ok: true, mensagemId: typeof id === "string" && id ? id : null }
}
