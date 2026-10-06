/**
 * Tráfego de mensagens nos dois sentidos.
 * Documentação: docs/contratos/autoatendimento/06-mensagens-e-encaminhamento.md
 */
import { z } from "zod"
import { InstanteUtc, Telefone, Uuid, apiSuccess } from "./comum"
import { TicketEmitido } from "./ticket"

// ---------------------------------------------------------------------------
// Eliza -> atendente: POST {ATENDENTE_URL}/v1/mensagens
// ---------------------------------------------------------------------------

/** hex(HMAC-SHA256(ATENDENTE_ENCAMINHAMENTO_SECRET, `${timestamp}.${corpoBruto}`)) */
export const HEADER_ASSINATURA = "X-Eliza-Assinatura"
/** epoch em segundos; o atendente rejeita se |agora - timestamp| > 300 */
export const HEADER_TIMESTAMP = "X-Eliza-Timestamp"

export const MensagemEncaminhada = z.object({
  versao: z.literal(1),
  /** id da mensagem no WhatsApp; chave de deduplicação no atendente */
  mensagemId: z.string().min(1),
  recebidaEm: InstanteUtc,
  organizacao: z.object({ id: Uuid, nome: z.string() }),
  /** A outra ponta da conversa — o cliente —, tanto em recebidas quanto em deMim. */
  contato: z.object({
    telefone: Telefone,
    nomeExibicao: z.string().nullable(),
  }),
  /**
   * true = mensagem enviada PELO número do estabelecimento. Pode ser eco do
   * próprio atendente (o id bate com um EnviarMensagemResposta.mensagemId) ou
   * alguém da equipe respondendo pelo celular (pausa o atendente).
   */
  deMim: z.boolean(),
  conteudo: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("texto"), texto: z.string().min(1) }),
    z.object({ tipo: z.literal("nao_suportado"), tipoOriginal: z.string() }),
  ]),
  /** null quando deMim = true */
  ticket: TicketEmitido.nullable(),
})

/** O atendente responde 202 assim que valida e enfileira. */
export const RespostaEncaminhamento = z.object({ aceito: z.literal(true) })

// ---------------------------------------------------------------------------
// atendente -> Eliza: POST /api/v1/autoatendimento/mensagens
// ---------------------------------------------------------------------------

export const EnviarMensagemBody = z
  .object({
    texto: z.string().trim().min(1).max(4000),
  })
  .strict()

export const EnviarMensagemResposta = apiSuccess(
  z.object({
    /** id devolvido pela Evolution; volta depois como MensagemEncaminhada.deMim */
    mensagemId: z.string().nullable(),
  })
)

// ---------------------------------------------------------------------------
// atendente -> Eliza: POST /api/v1/autoatendimento/escalonamentos
// ---------------------------------------------------------------------------

export const EscalonarBody = z
  .object({
    motivo: z.enum([
      "pedido_do_cliente",
      "cliente_ambiguo",
      "fora_da_politica",
      "nao_entendi",
      "reclamacao",
      "outro",
    ]),
    /** Resumo para a equipe. Sem dado sensível além do necessário. */
    resumo: z.string().trim().min(1).max(1000),
  })
  .strict()

export const EscalonarResposta = apiSuccess(
  z.object({
    /** false quando a org não configurou contato humano */
    equipeNotificada: z.boolean(),
  })
)

export type MensagemEncaminhada = z.infer<typeof MensagemEncaminhada>
export type EnviarMensagemBody = z.infer<typeof EnviarMensagemBody>
export type EscalonarBody = z.infer<typeof EscalonarBody>
