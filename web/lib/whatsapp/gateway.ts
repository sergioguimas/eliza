import "server-only"

import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { getEvolutionServer } from "@/lib/evolution"
import { createAdminClient } from "@/utils/supabase/admin"

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

export type ResultadoMidia =
  | {
      ok: true
      mime: string
      /** bytes já decodificados */
      tamanho: number
      base64: string
    }
  | {
      ok: false
      /** `nao_encontrada` = a Evolution não tem mais a mensagem; `indisponivel` = qualquer outra falha. */
      motivo: "nao_encontrada" | "indisponivel"
      /** só para o log de quem chama: nunca devolver ao atendente */
      erro: string
    }

const TIMEOUT_MIDIA_MS = 15000

/**
 * Baixa a mídia de UMA mensagem já recebida, pela instância da organização
 * (Evolution v2: `POST /chat/getBase64FromMediaMessage/{instancia}`). Nada é
 * gravado. O formato é o da v2; se o servidor pedir outro, a adaptação é só aqui.
 * O servidor vem de `getEvolutionServer` e a instância de
 * `organizations.whatsapp_instance_name`, sem fallback global (como o envio).
 */
export async function baixarMidia(p: { organizationId: string; mensagemId: string }): Promise<ResultadoMidia> {
  const server = getEvolutionServer()

  if (!server) return { ok: false, motivo: "indisponivel", erro: "servidor Evolution não configurado" }

  const { data: org, error } = await createAdminClient()
    .from("organizations")
    .select("whatsapp_instance_name")
    .eq("id", p.organizationId)
    .maybeSingle()

  if (error) return { ok: false, motivo: "indisponivel", erro: `erro ao buscar a organização: ${error.message}` }

  const instancia = org?.whatsapp_instance_name

  if (!instancia) return { ok: false, motivo: "indisponivel", erro: "organização sem instância de WhatsApp" }

  try {
    const resposta = await fetch(`${server.url}/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: server.apiKey },
      body: JSON.stringify({ message: { key: { id: p.mensagemId } }, convertToMp4: false }),
      signal: AbortSignal.timeout(TIMEOUT_MIDIA_MS),
      cache: "no-store",
    })

    const corpo: unknown = await resposta.json().catch(() => null)
    const dados = (corpo && typeof corpo === "object" ? corpo : {}) as { base64?: unknown; mimetype?: unknown }

    if (!resposta.ok) {
      // A v2 responde 400/404 "Message not found" (o texto vem em `response.message`) quando o id é desconhecido ou a mensagem já saiu do banco dela.
      const naoAchou = resposta.status === 404 || /not found/i.test(JSON.stringify(corpo ?? ""))

      return { ok: false, motivo: naoAchou ? "nao_encontrada" : "indisponivel", erro: `Evolution respondeu ${resposta.status}` }
    }

    if (typeof dados.base64 !== "string" || !dados.base64) {
      return { ok: false, motivo: "indisponivel", erro: "resposta da Evolution sem base64" }
    }

    // Alguns servidores devolvem data URI; o contrato entrega base64 puro.
    const base64 = dados.base64.replace(/^data:[^,]*,/, "")

    return {
      ok: true,
      mime: typeof dados.mimetype === "string" && dados.mimetype ? dados.mimetype : "application/octet-stream",
      tamanho: Buffer.byteLength(base64, "base64"),
      base64,
    }
  } catch (error) {
    const nome = (error as Error)?.name ?? "desconhecido"

    return { ok: false, motivo: "indisponivel", erro: nome === "TimeoutError" ? "timeout" : `erro de rede (${nome})` }
  }
}
