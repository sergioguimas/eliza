/**
 * Ticket de conversa.
 *
 * Emitido pelo Eliza a cada mensagem encaminhada ao atendente e exigido em toda
 * chamada à API. É dele — e nunca de header, query ou body — que a API tira a
 * organização e o telefone do cliente. Um atendente com bug ou comprometido só
 * consegue agir sobre quem mandou mensagem nos últimos TICKET_TTL_SEGUNDOS.
 *
 * Formato do token: `<payload>.<assinatura>`
 *   payload    = base64url(JSON.stringify(TicketPayload))
 *   assinatura = base64url(HMAC-SHA256(AUTOATENDIMENTO_TICKET_SECRET, payload))
 *
 * O segredo existe só no Eliza. O atendente trata o token como opaco.
 */
import { z } from "zod"
import { InstanteUtc, Telefone, Uuid } from "./comum"

export const TICKET_TTL_SEGUNDOS = 30 * 60

export const TicketPayload = z.object({
  v: z.literal(1),
  /** organizations.id, resolvido pela instância que recebeu a mensagem */
  org: Uuid,
  /** Telefone do contato, só dígitos, exatamente como veio do WhatsApp */
  tel: Telefone,
  /** organizations.whatsapp_instance_name no momento da emissão */
  inst: z.string().min(1),
  /** id da mensagem do WhatsApp que originou o ticket */
  msg: z.string().min(1),
  /** epoch em segundos */
  iat: z.number().int(),
  exp: z.number().int(),
})

/** Como o ticket chega ao atendente, dentro da mensagem encaminhada. */
export const TicketEmitido = z.object({
  token: z.string().min(1),
  expiraEm: InstanteUtc,
})

export type TicketPayload = z.infer<typeof TicketPayload>
export type TicketEmitido = z.infer<typeof TicketEmitido>
