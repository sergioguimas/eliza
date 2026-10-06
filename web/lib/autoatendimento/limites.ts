import "server-only"

import { consumeRateLimit, hashIdentifier } from "@/lib/demo/rate-limit"
import type { Db } from "@/lib/domain/db"
import { ApiError } from "@/lib/http/erros"

const HORA = 60 * 60 * 1000

/** Valores fechados do README §6. Contêm um atendente em loop, não o cliente. */
const LIMITES = {
  "aa-escrita": { windowMs: HORA, max: 20 },
  "aa-criar": { windowMs: 24 * HORA, max: 5 },
  "aa-msg-contato": { windowMs: HORA, max: 60 },
  "aa-msg-org": { windowMs: HORA, max: 600 },
  "aa-escalar": { windowMs: HORA, max: 3 },
} as const

export type PrefixoDeLimite = keyof typeof LIMITES

/**
 * Consome uma unidade do limite ou lança RATE_LIMITED (429) com `Retry-After`
 * e `details.retry_after_seconds`, como a v1. Identificador = org + telefone do
 * ticket; `aa-msg-org` conta só a org.
 */
export async function consumirLimite(db: Db, prefixo: PrefixoDeLimite, p: { org: string; telefone: string }) {
  const identificador = prefixo === "aa-msg-org" ? p.org : `${p.org}:${p.telefone}`
  const limite = await consumeRateLimit(db, hashIdentifier(prefixo, identificador), LIMITES[prefixo])

  if (limite.allowed) return

  const espera = limite.retryAfterSeconds ?? 60

  throw new ApiError(
    "RATE_LIMITED",
    "Muitas solicitações em pouco tempo. Tente de novo em alguns minutos.",
    { retry_after_seconds: espera },
    { "Retry-After": String(espera) }
  )
}
