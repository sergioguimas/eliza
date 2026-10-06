import "server-only"

import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import type { z } from "zod"
import { createAdminClient } from "@/utils/supabase/admin"
import type { Database } from "@/utils/database.types"
import { getClientIp } from "@/lib/demo/rate-limit"
import type { Db } from "@/lib/domain/db"
import { ApiError, internalError, paraApiError, validation, zodDetails } from "./erros"
import { corpoDeErro, corpoDeSucesso, jsonResponse, type ApiResult } from "./resposta"

export type { ApiResult }

export type ContextoBase = {
  req: NextRequest
  db: Db
  requestId: string
  params: Record<string, string>
  query: URLSearchParams
  /** Valida o corpo JSON: INVALID_JSON (400) ou VALIDATION_ERROR (422). */
  body<T extends z.ZodType>(schema: T): Promise<z.infer<T>>
  /** Valida a query string: VALIDATION_ERROR (422). */
  parseQuery<T extends z.ZodType>(schema: T): z.infer<T>
}

/** O que a auditoria recebe de cada requisição. Nunca body nem query string. */
export type RegistroRequisicao = {
  requestId: string
  method: string
  path: string
  status: number
  errorCode: string | null
  durationMs: number
  ip: string
  userAgent: string | null
}

export type BaseDeAutenticacao<A> = {
  requestId: string
  ip: string
  /**
   * Quem foi identificado (ex.: a chave). Chamar assim que souber, ANTES de
   * checar escopo/org/limite: se a autenticação falhar depois, a requisição
   * ainda é auditada em nome dele.
   */
  identificar: (auditado: A) => void
}

/** Lança `ApiError` se a requisição não puder prosseguir. `C` é o contexto que o handler recebe. */
export type Autenticador<C, A = C> = (req: NextRequest, db: Db, base: BaseDeAutenticacao<A>) => Promise<C>

type OpcoesDaRota<C, A> = {
  autenticar: Autenticador<C, A>
  /** v1: api_request_logs. Falha aqui nunca derruba a resposta. */
  auditar?: (auditado: A, registro: RegistroRequisicao, db: Db) => Promise<void>
  handler: (ctx: C & ContextoBase) => Promise<ApiResult>
}

type ParametrosDaRota = { params: Promise<Record<string, string>> }

/**
 * Casca comum das rotas HTTP do Eliza (api-v1 §3):
 *   1. autentica (plugável: API key, ticket...) e resolve o contexto;
 *   2. executa o handler: `ApiError` e `DomainError` viram resposta no envelope
 *      único, o resto vira 500 genérico (o detalhe só vai para o console);
 *   3. audita pelo callback do autenticador, se houver.
 */
export function criarRota<C, A = C>(opcoes: OpcoesDaRota<C, A>) {
  return async (req: NextRequest, rotaCtx: ParametrosDaRota) => {
    const inicio = Date.now()
    const requestId = randomUUID()
    const ip = getClientIp(req)
    const db = createAdminClient<Database>()

    let auditado: A | undefined
    let status = 500
    let errorCode: string | null = null

    const responder = (corpo: unknown, codigo: number, headers?: Record<string, string>) => {
      status = codigo
      return jsonResponse(corpo, codigo, requestId, headers)
    }

    const falhar = (error: ApiError) => {
      errorCode = error.code
      return responder(corpoDeErro(error, requestId), error.status, error.headers)
    }

    try {
      const contexto = await opcoes.autenticar(req, db, {
        requestId,
        ip,
        identificar: (a) => {
          auditado = a
        },
      })

      const base: ContextoBase = {
        req,
        db,
        requestId,
        params: await rotaCtx.params,
        query: req.nextUrl.searchParams,
        async body(schema) {
          let bruto: unknown

          try {
            bruto = await req.json()
          } catch {
            throw new ApiError("INVALID_JSON", "Corpo da requisição não é um JSON válido.")
          }

          const lido = schema.safeParse(bruto)

          if (!lido.success) throw validation("Dados inválidos.", zodDetails(lido.error))

          return lido.data
        },
        parseQuery(schema) {
          const lido = schema.safeParse(Object.fromEntries(req.nextUrl.searchParams))

          if (!lido.success) throw validation("Parâmetros inválidos.", zodDetails(lido.error))

          return lido.data
        },
      }

      const resultado = await opcoes.handler({ ...contexto, ...base })

      return responder(corpoDeSucesso(resultado), resultado.status ?? 200)
    } catch (error) {
      const apiError = paraApiError(error)

      if (apiError) return falhar(apiError)

      console.error("[api:v1] erro inesperado:", { requestId, error })
      return falhar(internalError())
    } finally {
      if (auditado !== undefined && opcoes.auditar) {
        try {
          await opcoes.auditar(
            auditado,
            {
              requestId,
              method: req.method,
              path: req.nextUrl.pathname,
              status,
              errorCode,
              durationMs: Date.now() - inicio,
              ip,
              userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
            },
            db
          )
        } catch (error) {
          console.error("[api:v1] falha ao auditar:", { requestId, error })
        }
      }
    }
  }
}
