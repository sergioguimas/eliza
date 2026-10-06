/**
 * Envelope e catálogo de erros ÚNICOS das APIs HTTP do Eliza (decisão D3,
 * docs/contratos/DECISOES_API.md). Valem para:
 *   - API v1 B2B          (/api/v1/*, API key por tenant)
 *   - API Autoatendimento (/api/v1/autoatendimento/*, token de serviço + ticket)
 *
 * Formato herdado da v1 (commit a0ff88a). Códigos em inglês; `message` em
 * português, pronta para o usuário final, nunca com dado de outro cliente.
 * Documentação: docs/contratos/api-v1/README.md §3–§4
 */
import { z } from "zod"

export const ErrorCode = z.enum([
  // 400
  "INVALID_JSON",
  "VERSION_MISMATCH", //       autoatendimento: header de versão diferente
  // 401
  "UNAUTHORIZED", //           API key ou token de serviço ausente/inválido/revogado/expirado
  "TICKET_MISSING", //         autoatendimento
  "TICKET_INVALID", //         autoatendimento
  "TICKET_EXPIRED", //         autoatendimento
  // 403
  "FORBIDDEN", //              chave sem o escopo exigido
  "ORGANIZATION_SUSPENDED", // org suspensa ou demo
  "PLAN_REQUIRED", //          plano da org não inclui a API (D7)
  "ADDON_INACTIVE", //         autoatendimento sem config ativa
  // 404
  "NOT_FOUND", //              inexistente OU de outro tenant/cliente — nunca diferenciar
  // 409
  "CONFLICT",
  "SLOT_UNAVAILABLE",
  "INVALID_TRANSITION",
  "CUSTOMER_AMBIGUOUS",
  "CUSTOMER_CONFLICT", //      documento já pertence a outro cliente
  "CUSTOMER_NOT_IDENTIFIED", // autoatendimento: telefone do ticket sem cadastro
  "ACTIVE_LIMIT_REACHED", //   autoatendimento: max_agendamentos_ativos
  // 422
  "VALIDATION_ERROR",
  "OUT_OF_WINDOW", //          autoatendimento: data fora de [hoje, hoje + janela]
  "NOTICE_TOO_SHORT", //       autoatendimento: antes da antecedência mínima
  // 429
  "RATE_LIMITED",
  // 5xx
  "WHATSAPP_UNAVAILABLE",
  "INTERNAL_ERROR",
])

export type ErrorCode = z.infer<typeof ErrorCode>

export const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_JSON: 400,
  VERSION_MISMATCH: 400,
  UNAUTHORIZED: 401,
  TICKET_MISSING: 401,
  TICKET_INVALID: 401,
  TICKET_EXPIRED: 401,
  FORBIDDEN: 403,
  ORGANIZATION_SUSPENDED: 403,
  PLAN_REQUIRED: 403,
  ADDON_INACTIVE: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SLOT_UNAVAILABLE: 409,
  INVALID_TRANSITION: 409,
  CUSTOMER_AMBIGUOUS: 409,
  CUSTOMER_CONFLICT: 409,
  CUSTOMER_NOT_IDENTIFIED: 409,
  ACTIVE_LIMIT_REACHED: 409,
  VALIDATION_ERROR: 422,
  OUT_OF_WINDOW: 422,
  NOTICE_TOO_SHORT: 422,
  RATE_LIMITED: 429,
  WHATSAPP_UNAVAILABLE: 502,
  INTERNAL_ERROR: 500,
}

/** `DomainError.codigo` (web/lib/domain/erros.ts) -> código HTTP público. Mesmo nome, por construção. */
export const DOMAIN_CODES = [
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "SLOT_UNAVAILABLE",
  "INVALID_TRANSITION",
  "CUSTOMER_AMBIGUOUS",
  "CUSTOMER_CONFLICT",
] as const satisfies readonly ErrorCode[]

export const ApiErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
    request_id: z.string(),
  }),
})

export function apiSuccess<T extends z.ZodType>(data: T, meta?: z.ZodType) {
  return z.object({
    data,
    ...(meta ? { meta } : {}),
  })
}

/** Toda resposta, de sucesso ou erro, traz este header com o mesmo id do log. */
export const HEADER_REQUEST_ID = "X-Request-Id"

export const PageMeta = z.object({
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})
