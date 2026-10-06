import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { ApiScope } from "@/contracts/api-v1"

export const API_KEY_PREFIX = "elz_live_"
// Fonte única dos escopos: o enum do contrato (api-v1/comum.ts). Reexportado aqui para quem já importa de keys.
export const API_SCOPES = ApiScope.options
export type { ApiScope }

export function hashApiKey(plain: string) {
  return createHash("sha256").update(plain).digest("hex")
}

/**
 * 32 bytes aleatórios (256 bits). O texto em claro só existe na resposta da
 * criação; o banco guarda o SHA-256 e um prefixo curto para identificação.
 */
export function generateApiKey() {
  const plain = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`

  return {
    plain,
    hash: hashApiKey(plain),
    prefix: plain.slice(0, API_KEY_PREFIX.length + 6),
  }
}

export function isWellFormedApiKey(value: string) {
  return value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 32 && value.length <= 128
}
