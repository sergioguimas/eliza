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
  // 07: contém enumeração de nomes e download de mídia por um atendente em loop.
  "aa-nome": { windowMs: HORA, max: 10 },
  "aa-midia": { windowMs: HORA, max: 30 },
  // 08 §8: canal web. O de org é a trava do Eliza contra custo, independente do teto do agens.
  "aa-web-sessao": { windowMs: 2 * HORA, max: 20 },
  "aa-web-ip": { windowMs: HORA, max: 60 },
  "aa-web-org": { windowMs: 24 * HORA, max: 1000 },
} as const

export type PrefixoDeLimite = keyof typeof LIMITES

/**
 * Consome uma unidade do limite ou lança RATE_LIMITED (429) com `Retry-After`
 * e `details.retry_after_seconds`, como a v1. Identificador = org + telefone do
 * ticket; `aa-msg-org` conta só a org.
 */
export async function consumirLimite(db: Db, prefixo: PrefixoDeLimite, p: { org: string; telefone: string }) {
  const identificador = prefixo === "aa-msg-org" ? p.org : `${p.org}:${p.telefone}`

  await consumir(db, prefixo, identificador)
}

/** Limites do canal web (08 §8). Visitante não tem telefone: a chave é sessão, IP e org. */
export async function consumirLimiteWeb(db: Db, p: { org: string; sess: string; ip: string }) {
  await consumir(db, "aa-web-sessao", `${p.org}:${p.sess}`)
  await consumir(db, "aa-web-ip", p.ip)
  await consumir(db, "aa-web-org", p.org)
}

async function consumir(db: Db, prefixo: PrefixoDeLimite, identificador: string) {
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
