import "server-only"

import { consumeRateLimit, hashIdentifier } from "@/lib/demo/rate-limit"
import type { Db } from "@/lib/domain/db"
import { ApiError, internalError } from "@/lib/http/erros"
import type { Autenticador, RegistroRequisicao } from "@/lib/http/rota"
import { MENSAGEM_PLANO_SEM_API, planoPermiteApi } from "./planos"
import { hashApiKey, isWellFormedApiKey, type ApiScope } from "./keys"

/** O que a rota recebe da chave. O tenant sai SÓ daqui: nunca de body, query ou header. */
export type ContextoChave = {
  organizationId: string
  apiKeyId: string
  keyPrefix: string
}

/** O que a auditoria precisa da chave. */
export type ChaveAuditada = ContextoChave & { lastUsedAt: string | null }

// Teto por chave. Contém um agente em loop sem atrapalhar uso normal.
const RATE_LIMIT = { windowMs: 60 * 1000, max: 120 }
const LAST_USED_REFRESH_MS = 60 * 1000

/**
 * Autenticação por API key (api-v1 §2). Ordem das checagens: header -> chave
 * existe -> revogada/expirada -> escopo -> org (demo/suspensa) -> plano -> rate limit.
 *
 * Chave ausente/inexistente não gera log de tenant (não há tenant a quem
 * atribuir): só aviso no console, com o IP.
 */
export function autenticarChave(escopo: ApiScope): Autenticador<ContextoChave, ChaveAuditada> {
  return async (req, db, { ip, identificar }) => {
    const cabecalho = req.headers.get("authorization") || ""
    const token = cabecalho.match(/^Bearer\s+(\S+)$/i)?.[1]

    if (!token || !isWellFormedApiKey(token)) {
      console.warn("[api:v1] chave ausente ou malformada", { ip, path: req.nextUrl.pathname })
      throw new ApiError("UNAUTHORIZED", "API key ausente ou inválida.")
    }

    const { data: chave, error } = await db
      .from("api_keys")
      .select("*")
      .eq("key_hash", hashApiKey(token))
      .maybeSingle()

    if (error) {
      console.error("[api:v1] erro ao consultar chave:", error.message)
      throw internalError()
    }

    if (!chave) {
      console.warn("[api:v1] chave desconhecida", { ip, path: req.nextUrl.pathname })
      throw new ApiError("UNAUTHORIZED", "API key ausente ou inválida.")
    }

    // A partir daqui há tenant: toda falha adiante é auditada em nome da chave.
    identificar({
      organizationId: chave.organization_id,
      apiKeyId: chave.id,
      keyPrefix: chave.key_prefix,
      lastUsedAt: chave.last_used_at,
    })

    if (chave.revoked_at || (chave.expires_at && new Date(chave.expires_at) <= new Date())) {
      throw new ApiError("UNAUTHORIZED", "API key revogada ou expirada.")
    }

    if (!chave.scopes.includes(escopo)) {
      throw new ApiError("FORBIDDEN", `A chave não tem o escopo "${escopo}".`)
    }

    const { data: org } = await db
      .from("organizations")
      .select("subscription_status, is_demo, plan")
      .eq("id", chave.organization_id)
      .maybeSingle()

    if (!org || org.is_demo || org.subscription_status === "suspended") {
      throw new ApiError("ORGANIZATION_SUSPENDED", "Organização indisponível para uso da API.")
    }

    // Gate de plano (D7): depois da suspensão e antes do rate limit, para chave de plano sem API não gastar cota.
    if (!planoPermiteApi(org.plan)) {
      throw new ApiError("PLAN_REQUIRED", MENSAGEM_PLANO_SEM_API)
    }

    const limite = await consumeRateLimit(db, hashIdentifier("api-key", chave.id), RATE_LIMIT)

    if (!limite.allowed) {
      const espera = limite.retryAfterSeconds ?? 60

      throw new ApiError(
        "RATE_LIMITED",
        "Limite de requisições excedido. Tente novamente em instantes.",
        { retry_after_seconds: espera },
        { "Retry-After": String(espera) }
      )
    }

    return { organizationId: chave.organization_id, apiKeyId: chave.id, keyPrefix: chave.key_prefix }
  }
}

/** Uma linha em api_request_logs por requisição com chave válida. Falha no log não derruba a resposta. */
export async function auditarChave(chave: ChaveAuditada, registro: RegistroRequisicao, db: Db) {
  const { error } = await db.from("api_request_logs").insert({
    organization_id: chave.organizationId,
    api_key_id: chave.apiKeyId,
    key_prefix: chave.keyPrefix,
    request_id: registro.requestId,
    method: registro.method,
    path: registro.path,
    status_code: registro.status,
    error_code: registro.errorCode,
    duration_ms: registro.durationMs,
    ip: registro.ip,
    user_agent: registro.userAgent,
  })

  if (error) {
    console.error("[api:v1] falha ao gravar log de auditoria:", {
      requestId: registro.requestId,
      message: error.message,
    })
  }

  const defasada = !chave.lastUsedAt || Date.now() - new Date(chave.lastUsedAt).getTime() > LAST_USED_REFRESH_MS

  if (defasada) {
    await db.from("api_keys").update({ last_used_at: new Date().toISOString() })
      .eq("id", chave.apiKeyId)
      .eq("organization_id", chave.organizationId)
  }
}
