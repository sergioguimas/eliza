import "server-only"

import { randomUUID } from "node:crypto"
import {
  ChatWebResposta,
  HEADER_ASSINATURA,
  HEADER_TIMESTAMP,
  MensagemWeb,
  type FormularioChat,
} from "@/contracts/autoatendimento"
import { assinarEncaminhamento } from "./assinatura"
import { emitirTicketVisitante } from "./ticket"

const TIMEOUT_MS = 45_000

export type ResultadoDoAgens = { ok: true; dados: ChatWebResposta } | { ok: false; motivo: string }

/**
 * Eliza → agens (contrato 08 §6.2). O ticket nasce aqui, a cada mensagem, e vai
 * direto ao agens: nunca chega ao navegador (C14). Nunca lança; quem chama traduz
 * a falha em ATENDENTE_UNAVAILABLE, e o motivo fica só no log.
 */
export async function perguntarAoAtendente(p: {
  org: string
  sess: string
  texto: string
  formulario: FormularioChat
}): Promise<ResultadoDoAgens> {
  const base = process.env.ATENDENTE_URL?.trim().replace(/\/+$/, "")
  const segredo = process.env.ATENDENTE_ENCAMINHAMENTO_SECRET

  if (!base || !segredo) return { ok: false, motivo: "env_ausente" }

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const mensagem = MensagemWeb.parse({
      versao: 1,
      canal: "web",
      mensagemId: randomUUID(),
      orgId: p.org,
      contato: `web:${p.sess}`,
      texto: p.texto,
      recebidaEm: new Date().toISOString(),
      ticket: emitirTicketVisitante({ org: p.org, sess: p.sess }),
      formulario: p.formulario,
    })
    // O corpo é serializado UMA vez: a assinatura é sobre esta string exata.
    const corpo = JSON.stringify(mensagem)
    const timestamp = String(Math.floor(Date.now() / 1000))

    const resposta = await fetch(`${base}/v1/web`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [HEADER_ASSINATURA]: assinarEncaminhamento(segredo, timestamp, corpo),
        [HEADER_TIMESTAMP]: timestamp,
      },
      body: corpo,
      signal: controle.signal,
      cache: "no-store",
    })

    if (resposta.status !== 200) return { ok: false, motivo: `resposta_${resposta.status}` }

    const lido = ChatWebResposta.safeParse(await resposta.json().catch(() => null))

    return lido.success ? { ok: true, dados: lido.data } : { ok: false, motivo: "corpo_invalido" }
  } catch (error) {
    return { ok: false, motivo: controle.signal.aborted ? "timeout" : `erro (${(error as Error)?.name ?? "desconhecido"})` }
  } finally {
    clearTimeout(prazo)
  }
}
