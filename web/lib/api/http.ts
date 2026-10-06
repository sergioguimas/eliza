import { NextResponse } from "next/server"
import { DomainError } from "@/lib/domain/erros"
import { horaLocalParaUtc } from "@/lib/domain/tempo"

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ORGANIZATION_SUSPENDED"
  | "RATE_LIMITED"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SLOT_UNAVAILABLE"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>
  ) {
    super(message)
  }
}

export const notFound = (what: string) =>
  new ApiError(404, "NOT_FOUND", `${what} não encontrado(a).`)

export const validation = (message: string, details?: unknown) =>
  new ApiError(422, "VALIDATION_ERROR", message, details)

/**
 * Converte o `start_time`/`from`/`to` da API em instante UTC pelo domínio
 * (lib/domain/tempo). O DomainError de entrada malformada vira 422 com a mesma
 * mensagem de sempre; qualquer outro erro sobe como está.
 */
export function parseApiDateTime(raw: string, field = "start_time") {
  try {
    return horaLocalParaUtc(raw, field)
  } catch (error) {
    if (error instanceof DomainError && error.codigo === "VALIDATION_ERROR") {
      throw new ApiError(422, "VALIDATION_ERROR", error.message)
    }

    throw error
  }
}

export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
      ...headers,
    },
  })
}
