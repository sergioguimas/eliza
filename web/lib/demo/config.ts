/**
 * Configuração do tenant de demonstração.
 *
 * Este módulo é importado por código de servidor e de cliente (o seletor de
 * nicho da página /demo/start), então não pode ler variáveis de ambiente
 * secretas aqui.
 */

import type { NicheId } from "@/lib/niche-config"

/**
 * Nichos oferecidos na demonstração.
 *
 * Subconjunto deliberado do `nicheConfig`: fica de fora `certificado`, que não
 * é um nicho promovido comercialmente. Todo valor daqui precisa existir no
 * CHECK `organizations_niche_check` do banco, senão o insert falha.
 */
export const DEMO_NICHES = [
  "clinica",
  "psicologia",
  "barbearia",
  "salao",
  "advocacia",
  "tatuador",
  "generico",
] as const satisfies readonly NicheId[]

export type DemoNiche = (typeof DEMO_NICHES)[number]

export function isDemoNiche(value: unknown): value is DemoNiche {
  return (
    typeof value === "string" && DEMO_NICHES.includes(value as DemoNiche)
  )
}

/** Tempo de vida do tenant demo. O cleanup coleta o que passar disso. */
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Tetos de criação de tenant por IP.
 *
 * Existem para conter automação, não para policiar uso legítimo: uma pessoa
 * refazendo o tour algumas vezes precisa passar sem atrito.
 */
export const DEMO_RATE_LIMITS = {
  perHour: { windowMs: 60 * 60 * 1000, max: 20 },
  perDay: { windowMs: 24 * 60 * 60 * 1000, max: 60 },
} as const

/** Rota para onde o visitante é levado depois que o tenant nasce. */
export const DEMO_ENTRY_PATH = "/dashboard?tour=demo"
