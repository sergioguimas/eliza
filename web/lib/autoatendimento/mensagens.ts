import "server-only"

import { enviarTexto } from "@/lib/whatsapp/gateway"
import { ApiError } from "@/lib/http/erros"

/**
 * Atendente -> cliente (06). Destino e instância saem SÓ do ticket: o telefone
 * vem do ticket e a instância é a da org (o gateway resolve por `organizationId`).
 * Não existe campo de destino no body. O texto sai como está, sem template.
 *
 * Devolve o id que a Evolution deu à mensagem (ou null), para o atendente
 * reconhecer o próprio eco quando ele voltar como `deMim`.
 */
export async function enviarAoCliente(p: { org: string; telefone: string; texto: string }) {
  const envio = await enviarTexto({ organizationId: p.org, telefone: p.telefone, texto: p.texto })

  if (!envio.ok) {
    // O motivo (corpo da Evolution) fica só no log; o atendente recebe texto fixo.
    console.error("[autoatendimento:mensagens] falha ao enviar pelo WhatsApp:", envio.erro)

    throw new ApiError(
      "WHATSAPP_UNAVAILABLE",
      "Não foi possível enviar a mensagem pelo WhatsApp agora. Tente novamente em instantes."
    )
  }

  return envio.mensagemId
}
