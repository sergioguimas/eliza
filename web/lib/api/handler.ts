import "server-only"

import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { z } from "zod"
import { createAdminClient } from "@/utils/supabase/admin"
import type { Database } from "@/utils/database.types"
import { consumeRateLimit, getClientIp, hashIdentifier } from "@/lib/demo/rate-limit"
import { ApiError, jsonResponse, validation } from "./http"
import { hashApiKey, isWellFormedApiKey, type ApiScope } from "./keys"

export type Db = SupabaseClient<Database>

export type ApiContext = {
  req: NextRequest
  db: Db
  /** Tenant da chave. Nunca vem de body, query ou header: só da chave. */
  organizationId: string
  apiKeyId: string
  keyPrefix: string
  requestId: string
  params: Record<string, string>
  query: URLSearchParams
  body<T extends z.ZodType>(schema: T): Promise<z.infer<T>>
}

export type ApiResult = {
  data: unknown
  status?: number
  meta?: Record<string, unknown>
}

type RouteParams = { params: Promise<Record<string, string>> }

// Teto por chave. Contém um agente em loop sem atrapalhar uso normal.
const RATE_LIMIT = { windowMs: 60 * 1000, max: 120 }
const LAST_USED_REFRESH_MS = 60 * 1000

function zodDetails(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || null,
    message: issue.message,
  }))
}

/**
 * Envelope de toda rota /api/v1:
 *   1. autentica pela API key (Bearer), resolve o tenant e o escopo;
 *   2. aplica rate limit por chave;
 *   3. executa o handler; ApiError vira resposta, o resto vira 500 genérico;
 *   4. grava UMA linha em api_request_logs (tenant + chave) para auditoria.
 *
 * Chave ausente/inexistente não gera log de tenant (não há tenant a quem
 * atribuir) — só aviso no console, com o IP.
 */
export function apiRoute(
  scope: ApiScope,
  handler: (ctx: ApiContext) => Promise<ApiResult>
) {
  return async (req: NextRequest, routeCtx: RouteParams) => {
    const startedAt = Date.now()
    const requestId = randomUUID()
    const ip = getClientIp(req)
    const db = createAdminClient<Database>()

    let key: Database["public"]["Tables"]["api_keys"]["Row"] | null = null
    let status = 500
    let errorCode: string | null = null

    const finish = (body: unknown, code: number, headers?: Record<string, string>) => {
      status = code
      return jsonResponse(body, code, requestId, headers)
    }

    const fail = (error: ApiError) => {
      errorCode = error.code

      return finish(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
            request_id: requestId,
          },
        },
        error.status,
        error.headers
      )
    }

    try {
      const header = req.headers.get("authorization") || ""
      const token = header.match(/^Bearer\s+(\S+)$/i)?.[1]

      if (!token || !isWellFormedApiKey(token)) {
        console.warn("[api:v1] chave ausente ou malformada", { ip, path: req.nextUrl.pathname })
        return fail(new ApiError(401, "UNAUTHORIZED", "API key ausente ou inválida."))
      }

      const { data: found, error: keyError } = await db
        .from("api_keys")
        .select("*")
        .eq("key_hash", hashApiKey(token))
        .maybeSingle()

      if (keyError) {
        console.error("[api:v1] erro ao consultar chave:", keyError.message)
        return fail(new ApiError(500, "INTERNAL_ERROR", "Erro interno."))
      }

      if (!found) {
        console.warn("[api:v1] chave desconhecida", { ip, path: req.nextUrl.pathname })
        return fail(new ApiError(401, "UNAUTHORIZED", "API key ausente ou inválida."))
      }

      key = found

      if (key.revoked_at || (key.expires_at && new Date(key.expires_at) <= new Date())) {
        return fail(new ApiError(401, "UNAUTHORIZED", "API key revogada ou expirada."))
      }

      if (!key.scopes.includes(scope)) {
        return fail(new ApiError(403, "FORBIDDEN", `A chave não tem o escopo "${scope}".`))
      }

      const { data: org } = await db
        .from("organizations")
        .select("subscription_status, is_demo")
        .eq("id", key.organization_id)
        .maybeSingle()

      if (!org || org.is_demo || org.subscription_status === "suspended") {
        return fail(new ApiError(403, "ORGANIZATION_SUSPENDED", "Organização indisponível para uso da API."))
      }

      const limit = await consumeRateLimit(db, hashIdentifier("api-key", key.id), RATE_LIMIT)

      if (!limit.allowed) {
        return fail(
          new ApiError(
            429,
            "RATE_LIMITED",
            "Limite de requisições excedido. Tente novamente em instantes.",
            { retry_after_seconds: limit.retryAfterSeconds ?? 60 },
            { "Retry-After": String(limit.retryAfterSeconds ?? 60) }
          )
        )
      }

      const params = await routeCtx.params

      const result = await handler({
        req,
        db,
        organizationId: key.organization_id,
        apiKeyId: key.id,
        keyPrefix: key.key_prefix,
        requestId,
        params,
        query: req.nextUrl.searchParams,
        async body(schema) {
          let raw: unknown

          try {
            raw = await req.json()
          } catch {
            throw new ApiError(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido.")
          }

          const parsed = schema.safeParse(raw)

          if (!parsed.success) {
            throw validation("Dados inválidos.", zodDetails(parsed.error))
          }

          return parsed.data
        },
      })

      return finish(
        { data: result.data, ...(result.meta ? { meta: result.meta } : {}) },
        result.status ?? 200
      )
    } catch (error) {
      if (error instanceof ApiError) return fail(error)

      console.error("[api:v1] erro inesperado:", { requestId, error })
      return fail(new ApiError(500, "INTERNAL_ERROR", "Erro interno."))
    } finally {
      if (key) {
        // Auditoria: falha ao gravar o log não derruba a resposta, mas é
        // registrada no console para não passar em silêncio.
        const { error: logError } = await db.from("api_request_logs").insert({
          organization_id: key.organization_id,
          api_key_id: key.id,
          key_prefix: key.key_prefix,
          request_id: requestId,
          method: req.method,
          path: req.nextUrl.pathname,
          status_code: status,
          error_code: errorCode,
          duration_ms: Date.now() - startedAt,
          ip,
          user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        })

        if (logError) {
          console.error("[api:v1] falha ao gravar log de auditoria:", { requestId, message: logError.message })
        }

        const stale =
          !key.last_used_at || Date.now() - new Date(key.last_used_at).getTime() > LAST_USED_REFRESH_MS

        if (stale) {
          await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id)
        }
      }
    }
  }
}
