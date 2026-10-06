import "server-only"

import { criarRota, type ApiResult, type ContextoBase } from "@/lib/http/rota"
import { auditarChave, autenticarChave, type ContextoChave } from "./autenticar-chave"
import type { ApiScope } from "./keys"

export type { ApiResult }
export type ApiContext = ContextoChave & ContextoBase

/**
 * Atalho das rotas /api/v1: `criarRota` com autenticação por API key (escopo
 * exigido pela rota) e auditoria em api_request_logs.
 */
export function apiRoute(scope: ApiScope, handler: (ctx: ApiContext) => Promise<ApiResult>) {
  return criarRota({
    autenticar: autenticarChave(scope),
    auditar: auditarChave,
    handler,
  })
}
