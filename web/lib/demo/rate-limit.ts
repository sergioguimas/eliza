import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/utils/database.types"

/**
 * Contadores de abuso da demonstração, em `demo_rate_limits`.
 *
 * Mora no Postgres porque não há Redis no stack e contador em memória não
 * sobrevive ao restart do container — e um limite que zera a cada deploy não
 * é limite.
 *
 * A chave é genérica para atender aos dois eixos de abuso:
 *   `ip:<hash>`    → quantos tenants demo um IP cria
 *   `phone:<hash>` → quantas mensagens um número recebe (Fase 8)
 */

type AdminClient = SupabaseClient<Database>

export type RateLimitWindow = {
  windowMs: number
  max: number
}

/**
 * O IP nunca é gravado em claro: serve só para comparar requisições entre si,
 * então o hash basta e evita guardar dado pessoal por 24h.
 */
export function hashIdentifier(prefix: string, value: string) {
  const salt = process.env.DEMO_RATE_LIMIT_SALT || ""
  const digest = createHash("sha256").update(`${salt}:${value}`).digest("hex")

  return `${prefix}:${digest}`
}

/**
 * Extrai o IP do cliente. Atrás do Traefik, o valor confiável é o primeiro
 * item de `x-forwarded-for` — os seguintes são proxies intermediários.
 *
 * Cabeçalho é falsificável se a aplicação for exposta sem proxy na frente;
 * como o deploy é sempre atrás do Traefik, o primeiro item é escrito por ele.
 */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")

  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }

  return request.headers.get("x-real-ip") || "unknown"
}

/**
 * Consome uma unidade da janela e diz se a requisição passa.
 *
 * Antes fazia leitura (`select`) seguida de escrita (`upsert`/`update`) em
 * duas idas separadas ao banco, sem transação — uma rajada concorrente da
 * mesma chave lia "abaixo do teto" em todas as requisições simultâneas antes
 * de qualquer uma delas gravar (30 requisições do mesmo IP passaram todas
 * com teto de 20/h). Agora o incremento e a decisão de janela acontecem numa
 * única chamada RPC (`consume_demo_rate_limit`, ver
 * `supabase/migrations/20260828120000_demo_rate_limit_atomic.sql`): a função
 * faz tudo dentro de um `insert ... on conflict do update` atômico, cuja row
 * lock serializa concorrência pela mesma chave. A política de limite (o que
 * é "permitido") continua aqui — a função só garante que o incremento em si
 * não perde contagem.
 *
 * A migration precisa ser aplicada ANTES deste código ir para produção — a
 * função é dependência da RPC abaixo e o retorno é fail-closed, então sem ela
 * no banco toda criação de demo passaria a ser recusada. Ver nota de ordem de
 * deploy no topo do arquivo da migration.
 */
export async function consumeRateLimit(
  supabaseAdmin: AdminClient,
  key: string,
  { windowMs, max }: RateLimitWindow
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const { data, error } = await supabaseAdmin.rpc("consume_demo_rate_limit", {
    p_key: key,
    p_window_ms: windowMs,
    p_max: max,
  })

  if (error) {
    // Falha do contador não pode virar porta aberta: nega e loga.
    console.error(
      "❌ [DemoRateLimit] Erro ao incrementar contador:",
      error.message
    )
    return { allowed: false }
  }

  const row = data?.[0]

  if (!row) {
    console.error("❌ [DemoRateLimit] RPC não devolveu contador.")
    return { allowed: false }
  }

  if (row.count > max) {
    const windowStart = new Date(row.window_start)
    const elapsed = Date.now() - windowStart.getTime()

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)),
    }
  }

  return { allowed: true }
}
