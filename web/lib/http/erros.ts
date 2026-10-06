import type { z } from "zod"
import { HTTP_STATUS_BY_CODE, type ErrorCode } from "@/contracts/comum/envelope"
import { DomainError } from "@/lib/domain/erros"

/**
 * Erro de HTTP das duas APIs (v1 B2B e Autoatendimento). O status sai sempre
 * de `HTTP_STATUS_BY_CODE`: um código, um status, em um lugar só.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>
  ) {
    super(message)
    this.name = "ApiError"
    this.status = HTTP_STATUS_BY_CODE[code]
  }
}

export const notFound = (what: string) => new ApiError("NOT_FOUND", `${what} não encontrado(a).`)

export const validation = (message: string, details?: unknown) =>
  new ApiError("VALIDATION_ERROR", message, details)

export const internalError = () => new ApiError("INTERNAL_ERROR", "Erro interno.")

/** `details` de VALIDATION_ERROR: `[{ field, message }]`; `field` nulo quando a regra é do objeto todo. */
export function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || null,
    message: issue.message,
  }))
}

/**
 * `DomainError` -> `ApiError` com o mesmo código (os nomes coincidem por
 * construção, ver `DOMAIN_CODES`), a mensagem em português do domínio e os
 * `detalhes` (ex.: `{ motivo, sugestoes }` do SLOT_UNAVAILABLE) adiante.
 */
export function deDominio(error: DomainError) {
  return new ApiError(error.codigo, error.message, error.detalhes)
}

/** `ApiError` e `DomainError` viram `ApiError`; qualquer outra coisa é inesperada (null) e o chamador responde 500. */
export function paraApiError(error: unknown) {
  if (error instanceof ApiError) return error
  if (error instanceof DomainError) return deDominio(error)

  return null
}
