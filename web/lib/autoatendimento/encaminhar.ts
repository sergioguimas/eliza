import "server-only"

import { createHmac } from "node:crypto"
import {
  HEADER_ASSINATURA,
  HEADER_TIMESTAMP,
  MensagemEncaminhada,
  type TicketEmitido,
} from "@/contracts/autoatendimento"
import type { Db } from "@/lib/domain/db"
import { extractIncomingNumber, extractInstanceName, extractMessageText } from "@/lib/whatsapp/extrair-mensagem"
import { createAdminClient } from "@/utils/supabase/admin"
import { carregarConfig } from "./config"
import { emitirTicket } from "./ticket"

/**
 * Ramo de encaminhamento do webhook do WhatsApp (06). O webhook só chama
 * `encaminharParaAtendente`; tudo daqui é do add-on e sai junto com ele.
 *
 * Contrato da função: NUNCA lança e devolve se o atendente aceitou (`true`).
 * `false` = siga o fluxo atual do webhook, sem nada mudado. Isso vale para
 * "não se aplica" (add-on desligado, org demo, grupo...) e para falha de envio.
 */

const TIMEOUT_MS = 3000
/** Mesma guarda do webhook: mensagem velha não ganha ticket novo (o ticket diz "escreveu há < 30 min"). */
const IDADE_MAXIMA_SEGUNDOS = 600

export type DependenciasDoEncaminhamento = {
  db?: Db
  fetch?: typeof fetch
  agora?: () => Date
}

/** hex(HMAC-SHA256(segredo, `${timestamp}.${corpo}`)) sobre a string exata que vai no corpo. */
export function assinarEncaminhamento(segredo: string, timestamp: string, corpo: string) {
  return createHmac("sha256", segredo).update(`${timestamp}.${corpo}`).digest("hex")
}

/** Primeira chave de `data.message` (ignora o envelope `messageContextInfo`), para `nao_suportado`. */
function tipoOriginal(message: unknown) {
  if (!message || typeof message !== "object") return "desconhecido"

  return Object.keys(message).find((chave) => chave !== "messageContextInfo") ?? "desconhecido"
}

function segundosParaData(valor: unknown, agora: Date) {
  const segundos = Number(valor)

  return Number.isFinite(segundos) && segundos > 0 ? new Date(segundos * 1000) : agora
}

/** Só o que o encaminhamento lê do `messages.upsert` da Evolution (o resto do payload é ignorado). */
type PayloadDaEvolution = {
  data?: {
    key?: { id?: unknown; remoteJid?: unknown; fromMe?: unknown }
    message?: unknown
    messageTimestamp?: unknown
    pushName?: unknown
  }
}

export async function encaminharParaAtendente(body: PayloadDaEvolution, deps: DependenciasDoEncaminhamento = {}): Promise<boolean> {
  const base = process.env.ATENDENTE_URL?.trim()

  // Add-on desligado globalmente: o webhook fica exatamente como era (nem consulta o banco).
  if (!base) return false

  let deMim = false

  try {
    const data = body?.data
    const key = data?.key
    const remoteJid = key?.remoteJid
    const agora = deps.agora?.() ?? new Date()

    deMim = Boolean(key?.fromMe)

    // Grupo e status/broadcast nunca são encaminhados.
    if (!data || typeof key?.id !== "string" || !key.id) return false
    if (typeof remoteJid !== "string" || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) return false

    const telefone = extractIncomingNumber(body)

    if (!telefone) return false

    const recebidaEm = segundosParaData(data.messageTimestamp, agora)

    if (agora.getTime() - recebidaEm.getTime() > IDADE_MAXIMA_SEGUNDOS * 1000) return false

    const instancia: unknown = extractInstanceName(body)

    if (typeof instancia !== "string" || !instancia) return false

    const db = deps.db ?? createAdminClient()

    const { data: org, error: erroDaOrg } = await db
      .from("organizations")
      .select("id, name, whatsapp_instance_name")
      .eq("whatsapp_instance_name", instancia)
      .maybeSingle()

    if (erroDaOrg) {
      console.error("[autoatendimento:encaminhar] erro ao resolver a organização:", erroDaOrg.message)
      return false
    }

    // Sem org, sem linha de config, config inativa ou org demo: fluxo atual.
    if (!org || !(await carregarConfig(db, org.id))) return false

    return await enviarAoAtendente({ base, id: key.id, data, org, instancia, telefone, recebidaEm, deMim, fetchFn: deps.fetch ?? fetch })
  } catch (error) {
    return recuar(deMim, `erro_inesperado (${error instanceof Error ? error.message : "desconhecido"})`)
  }
}

async function enviarAoAtendente(p: {
  base: string
  id: string
  data: NonNullable<PayloadDaEvolution["data"]>
  org: { id: string; name: string }
  instancia: string
  telefone: string
  recebidaEm: Date
  deMim: boolean
  fetchFn: typeof fetch
}) {
  const segredo = process.env.ATENDENTE_ENCAMINHAMENTO_SECRET

  if (!segredo) return recuar(p.deMim, "segredo_de_encaminhamento_ausente")

  const texto = extractMessageText(p.data.message)
  let ticket: TicketEmitido | null = null

  if (!p.deMim) {
    try {
      ticket = emitirTicket({ org: p.org.id, tel: p.telefone, inst: p.instancia, msg: p.id })
    } catch {
      return recuar(p.deMim, "segredo_do_ticket_invalido")
    }
  }

  const mensagem = MensagemEncaminhada.safeParse({
    versao: 1,
    mensagemId: p.id,
    recebidaEm: p.recebidaEm.toISOString(),
    organizacao: { id: p.org.id, nome: p.org.name },
    contato: {
      telefone: p.telefone,
      nomeExibicao: !p.deMim && typeof p.data.pushName === "string" && p.data.pushName ? p.data.pushName : null,
    },
    deMim: p.deMim,
    conteudo: texto
      ? { tipo: "texto", texto }
      : { tipo: "nao_suportado", tipoOriginal: tipoOriginal(p.data.message) },
    ticket,
  })

  if (!mensagem.success) return recuar(p.deMim, "payload_invalido")

  // O corpo é serializado UMA vez: a assinatura é sobre esta string exata.
  const corpo = JSON.stringify(mensagem.data)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await p.fetchFn(`${p.base.replace(/\/+$/, "")}/v1/mensagens`, {
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

    // O corpo da resposta não interessa; só o status.
    resposta.body?.cancel().catch(() => {})

    // Sem retentativa: a Evolution já retenta o webhook e o atendente deduplica por mensagemId.
    return resposta.status === 202 ? true : recuar(p.deMim, `resposta_${resposta.status}`)
  } catch (error) {
    return recuar(p.deMim, controle.signal.aborted ? "timeout" : `erro_de_rede (${(error as Error)?.name ?? "desconhecido"})`)
  } finally {
    clearTimeout(prazo)
  }
}

/**
 * Falha depois de decidir encaminhar. Recebida do cliente: cai no fluxo atual
 * de palavra-chave (D5), com o log do contrato. `deMim`: não há fluxo atual a
 * cumprir (o webhook já descartava `fromMe`), então só registra. Sempre `false`.
 */
function recuar(deMim: boolean, motivo: string) {
  console.warn(
    deMim ? `[autoatendimento:encaminhar] deMim descartado ${motivo}` : `[autoatendimento:encaminhar] fallback ${motivo}`
  )

  return false
}
