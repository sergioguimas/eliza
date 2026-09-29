/**
 * API de Autoatendimento — tipos compartilhados.
 *
 * Contrato TO-BE. Fonte da verdade: este diretório. O serviço `eliza-atendente`
 * mantém uma cópia versionada dele; os dois lados conferem CONTRATO_VERSAO.
 * Documentação: docs/contratos/autoatendimento/README.md
 */
import { z } from "zod"

export const CONTRATO_VERSAO = "1" as const

export const HEADER_VERSAO = "X-Autoatendimento-Versao"
export const HEADER_TICKET = "X-Autoatendimento-Ticket"

export const FUSO_HORARIO = "America/Sao_Paulo" as const

export const Uuid = z.uuid()

/** Data de calendário em America/Sao_Paulo. Ex.: "2026-10-05" */
export const DataLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")

/** Hora de relógio em America/Sao_Paulo. Ex.: "14:30" */
export const HoraLocal = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")

/** Data e hora de relógio em America/Sao_Paulo, sem offset. Ex.: "2026-10-05T14:30" */
export const DataHoraLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Use AAAA-MM-DDTHH:mm")

/** Instante absoluto em UTC. Ex.: "2026-10-05T17:30:00.000Z" */
export const InstanteUtc = z.iso.datetime()

/** Telefone só com dígitos, como chega do WhatsApp (com DDI). */
export const Telefone = z.string().regex(/^\d{10,15}$/)

/** Todo horário devolvido pela API vem nas duas formas. */
export const Momento = z.object({
  utc: InstanteUtc,
  local: DataHoraLocal,
})

export const StatusAgendamento = z.enum([
  "pending",
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "canceled",
  "no_show",
])

export const CodigoErro = z.enum([
  // 401
  "TOKEN_INVALIDO",
  "TICKET_AUSENTE",
  "TICKET_INVALIDO",
  "TICKET_EXPIRADO",
  // 400
  "VERSAO_INCOMPATIVEL",
  // 403
  "ADDON_INATIVO",
  // 404
  "NAO_ENCONTRADO",
  // 409
  "CLIENTE_NAO_IDENTIFICADO",
  "CLIENTE_AMBIGUO",
  "CLIENTE_JA_CADASTRADO",
  "HORARIO_INDISPONIVEL",
  "TRANSICAO_INVALIDA",
  "LIMITE_AGENDAMENTOS_ATIVOS",
  // 422
  "VALIDACAO",
  "FORA_DA_JANELA",
  "ANTECEDENCIA_INSUFICIENTE",
  // 429
  "LIMITE_TAXA",
  // 5xx
  "WHATSAPP_INDISPONIVEL",
  "ERRO_INTERNO",
])

export const STATUS_HTTP_POR_CODIGO: Record<z.infer<typeof CodigoErro>, number> = {
  TOKEN_INVALIDO: 401,
  TICKET_AUSENTE: 401,
  TICKET_INVALIDO: 401,
  TICKET_EXPIRADO: 401,
  VERSAO_INCOMPATIVEL: 400,
  ADDON_INATIVO: 403,
  NAO_ENCONTRADO: 404,
  CLIENTE_NAO_IDENTIFICADO: 409,
  CLIENTE_AMBIGUO: 409,
  CLIENTE_JA_CADASTRADO: 409,
  HORARIO_INDISPONIVEL: 409,
  TRANSICAO_INVALIDA: 409,
  LIMITE_AGENDAMENTOS_ATIVOS: 409,
  VALIDACAO: 422,
  FORA_DA_JANELA: 422,
  ANTECEDENCIA_INSUFICIENTE: 422,
  LIMITE_TAXA: 429,
  WHATSAPP_INDISPONIVEL: 502,
  ERRO_INTERNO: 500,
}

export const Erro = z.object({
  codigo: CodigoErro,
  /** Português, pronto para o atendente repassar. Nunca contém dado de outro cliente. */
  mensagem: z.string(),
  detalhes: z.record(z.string(), z.unknown()).optional(),
})

export const RespostaErro = z.object({
  ok: z.literal(false),
  erro: Erro,
})

export function respostaOk<T extends z.ZodType>(dados: T) {
  return z.object({
    ok: z.literal(true),
    dados,
  })
}

export type CodigoErro = z.infer<typeof CodigoErro>
export type Erro = z.infer<typeof Erro>
export type Momento = z.infer<typeof Momento>
export type StatusAgendamento = z.infer<typeof StatusAgendamento>
