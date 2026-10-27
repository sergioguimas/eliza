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
    z.object({
      tipo: z.literal("audio"),
      /** audioMessage.seconds */
      duracaoS: z.number().int().nonnegative(),
      /** audioMessage.mimetype, ex.: "audio/ogg; codecs=opus" */
      mime: z.string().min(1),
      /** audioMessage.fileLength em bytes; 0 se a Evolution não informou */
      tamanho: z.number().int().nonnegative(),
      /** contextInfo.isForwarded || contextInfo.forwardingScore > 0 */
      encaminhado: z.boolean(),
    }),
    z.object({ tipo: z.literal("nao_suportado"), tipoOriginal: z.string() }),
  ]),
  /** null quando deMim = true */
  ticket: TicketEmitido.nullable(),
  /**
   * Só com deMim: a mensagem é um envio automático do próprio sistema
   * (lembrete, notificação...), não a equipe respondendo. O atendente guarda o
   * texto como contexto, NÃO pausa e não responde (09-avisos-do-sistema).
   * null = mensagem do cliente, eco do atendente ou equipe.
   */
  aviso: z
    .object({
      tipo: z.enum(["lembrete", "resumo_profissional", "notificacao", "resposta_automatica", "escalonamento"]),
    })
    .nullable(),
}).refine((m) => m.aviso === null || m.deMim, { message: "aviso só existe com deMim", path: ["aviso"] })

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
      "numero_novo",
      "falha_tecnica",
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

// ---------------------------------------------------------------------------
// atendente -> Eliza: GET /api/v1/autoatendimento/mensagens/{mensagemId}/midia
// ---------------------------------------------------------------------------

/** `tamanho` = bytes já decodificados. Nada disto é gravado no Eliza. */
export const MidiaResposta = apiSuccess(
  z.object({ mime: z.string(), tamanho: z.number().int().nonnegative(), base64: z.string() })
)

export type MensagemEncaminhada = z.infer<typeof MensagemEncaminhada>
export type EnviarMensagemBody = z.infer<typeof EnviarMensagemBody>
export type EscalonarBody = z.infer<typeof EscalonarBody>
