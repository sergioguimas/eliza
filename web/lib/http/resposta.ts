import { NextResponse } from "next/server"
import { HEADER_REQUEST_ID } from "@/contracts/comum/envelope"
import type { ApiError } from "./erros"

export type ApiResult = {
  data: unknown
  status?: number
  meta?: Record<string, unknown>
}

/** Toda resposta, de sucesso ou erro, leva o id da requisição e nunca é cacheada. */
export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      [HEADER_REQUEST_ID]: requestId,
      "Cache-Control": "no-store",
      ...headers,
    },
  })
}

export function corpoDeSucesso(resultado: ApiResult) {
  return { data: resultado.data, ...(resultado.meta ? { meta: resultado.meta } : {}) }
}

export function corpoDeErro(error: ApiError, requestId: string) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
      request_id: requestId,
    },
  }
}
