import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { TICKET_TTL_SEGUNDOS, TicketPayload, type TicketEmitido } from "@/contracts/autoatendimento"

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

export type ResultadoDoTicket =
  | { ok: true; payload: TicketPayload }
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

  const lido = TicketPayload.safeParse(bruto)

  if (!lido.success) return { ok: false, motivo: "invalido" }

  const agoraSegundos = Math.floor((opcoes.agora ?? new Date()).getTime() / 1000)

  if (lido.data.exp <= agoraSegundos) return { ok: false, motivo: "expirado" }

  return { ok: true, payload: lido.data }
}
