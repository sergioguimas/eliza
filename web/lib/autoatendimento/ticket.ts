import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { TICKET_TTL_SEGUNDOS, TicketPayload, TicketVisitantePayload, type TicketEmitido } from "@/contracts/autoatendimento"

/**
 * Ticket de conversa (README §2): `base64url(JSON).base64url(HMAC-SHA256)`.
 * Sem biblioteca de JWT: `node:crypto` basta e o formato é propositalmente mínimo.
 * Contrato do payload: contracts/autoatendimento/ticket.ts.
 */

/** Segredos curtos demais enfraquecem o HMAC: abaixo disto a env conta como não configurada. */
export const TAMANHO_MINIMO_SEGREDO = 32

/** Lê AUTOATENDIMENTO_TICKET_SECRET. Ausente ou curto -> lança (falha fechada). */
export function segredoDoTicket(): string {
  const segredo = process.env.AUTOATENDIMENTO_TICKET_SECRET || ""

  if (segredo.length < TAMANHO_MINIMO_SEGREDO) {
    throw new Error("AUTOATENDIMENTO_TICKET_SECRET ausente ou com menos de 32 caracteres.")
  }

  return segredo
}

type Opcoes = { segredo?: string; agora?: Date }

function assinar(payload: string, segredo: string) {
  return createHmac("sha256", segredo).update(payload).digest("base64url")
}

export type DadosDoTicket = Pick<TicketPayload, "org" | "tel" | "inst" | "msg">

export function emitirTicket(dados: DadosDoTicket, opcoes: Opcoes = {}): TicketEmitido {
  const segredo = opcoes.segredo ?? segredoDoTicket()
  const iat = Math.floor((opcoes.agora ?? new Date()).getTime() / 1000)
  const exp = iat + TICKET_TTL_SEGUNDOS

  const payload = Buffer.from(JSON.stringify({ v: 1, ...dados, iat, exp } satisfies TicketPayload)).toString("base64url")

  return {
    token: `${payload}.${assinar(payload, segredo)}`,
    expiraEm: new Date(exp * 1000).toISOString(),
  }
}

/** Ticket do canal web (contrato 08 §2): mesmo formato, segredo e TTL do de conversa. */
export function emitirTicketVisitante(dados: Pick<TicketVisitantePayload, "org" | "sess">, opcoes: Opcoes = {}): TicketEmitido {
  const segredo = opcoes.segredo ?? segredoDoTicket()
  const iat = Math.floor((opcoes.agora ?? new Date()).getTime() / 1000)
  const exp = iat + TICKET_TTL_SEGUNDOS

  const payload = Buffer.from(
    JSON.stringify({ v: 1, tipo: "visitante", ...dados, iat, exp } satisfies TicketVisitantePayload)
  ).toString("base64url")

  return {
    token: `${payload}.${assinar(payload, segredo)}`,
    expiraEm: new Date(exp * 1000).toISOString(),
  }
}

export type ResultadoDoTicket =
  | { ok: true; tipo: "conversa"; payload: TicketPayload }
  | { ok: true; tipo: "visitante"; payload: TicketVisitantePayload }
  | { ok: false; motivo: "invalido" | "expirado" }

/**
 * Assinatura primeiro (timingSafeEqual), expiração depois: um ticket forjado
 * nunca descobre se "expiraria". Qualquer defeito de forma vira `invalido`.
 */
export function validarTicket(token: string, opcoes: Opcoes = {}): ResultadoDoTicket {
  const segredo = opcoes.segredo ?? segredoDoTicket()
  const partes = token.split(".")

  if (partes.length !== 2 || !partes[0] || !partes[1]) return { ok: false, motivo: "invalido" }

  const [payload, assinatura] = partes
  const esperada = Buffer.from(assinar(payload, segredo))
  const recebida = Buffer.from(assinatura)

  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return { ok: false, motivo: "invalido" }
  }

  let bruto: unknown

  try {
    bruto = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return { ok: false, motivo: "invalido" }
  }

  const conversa = TicketPayload.safeParse(bruto)
  const visitante = conversa.success ? null : TicketVisitantePayload.safeParse(bruto)
  const exp = conversa.success ? conversa.data.exp : visitante?.success ? visitante.data.exp : null

  if (exp === null) return { ok: false, motivo: "invalido" }

  const agoraSegundos = Math.floor((opcoes.agora ?? new Date()).getTime() / 1000)

  if (exp <= agoraSegundos) return { ok: false, motivo: "expirado" }

  if (conversa.success) return { ok: true, tipo: "conversa", payload: conversa.data }

  return { ok: true, tipo: "visitante", payload: visitante!.data! }
}
