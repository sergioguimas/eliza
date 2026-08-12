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
 * Leitura seguida de escrita, sem transação: duas requisições simultâneas com
 * a mesma chave podem contar como uma. O desvio é de poucas unidades e o pior
 * caso é um punhado de tenants demo a mais, que o cleanup recolhe em 24h. Se
 * algum dia isso precisar ser exato — o teto de mensagens da Fase 8 é o
 * candidato —, o caminho é uma função Postgres com `insert ... on conflict do
 * update` devolvendo o contador.
 */
export async function consumeRateLimit(
  supabaseAdmin: AdminClient,
  key: string,
  { windowMs, max }: RateLimitWindow
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date()

  const { data: existing, error: readError } = await supabaseAdmin
    .from("demo_rate_limits")
    .select("key, window_start, count")
    .eq("key", key)
    .maybeSingle()

  if (readError) {
    // Falha do contador não pode virar porta aberta: nega e loga.
    console.error("❌ [DemoRateLimit] Erro ao ler contador:", readError.message)
    return { allowed: false }
  }

  const windowStart = existing ? new Date(existing.window_start) : null
  const windowExpired =
    !windowStart || now.getTime() - windowStart.getTime() >= windowMs

  if (!existing || windowExpired) {
    const { error: upsertError } = await supabaseAdmin
      .from("demo_rate_limits")
      .upsert(
        {
          key,
          window_start: now.toISOString(),
          count: 1,
          updated_at: now.toISOString(),
        },
        { onConflict: "key" }
      )

    if (upsertError) {
      console.error(
        "❌ [DemoRateLimit] Erro ao abrir janela:",
        upsertError.message
      )
      return { allowed: false }
    }

    return { allowed: true }
  }

  if (existing.count >= max) {
    const elapsed = now.getTime() - windowStart!.getTime()

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)),
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("demo_rate_limits")
    .update({ count: existing.count + 1, updated_at: now.toISOString() })
    .eq("key", key)

  if (updateError) {
    console.error(
      "❌ [DemoRateLimit] Erro ao incrementar contador:",
      updateError.message
    )
    return { allowed: false }
  }

  return { allowed: true }
}
