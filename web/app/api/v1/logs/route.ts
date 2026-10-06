import { z } from "zod"
import { apiRoute } from "@/lib/api/handler"
import { ApiError, validation } from "@/lib/http/erros"

const q = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  scope: z.enum(["key", "organization"]).default("key"),
})

/**
 * Auditoria da própria API. Por padrão só as requisições DESTA chave;
 * `scope=organization` traz as de todas as chaves do tenant. Nunca cruza tenant.
 */
export const GET = apiRoute("read", async ({ db, organizationId, apiKeyId, query }) => {
  const parsed = q.safeParse(Object.fromEntries(query))

  if (!parsed.success) throw validation("Parâmetros inválidos.")

  const { limit, offset, scope } = parsed.data

  let builder = db
    .from("api_request_logs")
    .select("id, key_prefix, request_id, method, path, status_code, error_code, duration_ms, ip, user_agent, created_at", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (scope === "key") builder = builder.eq("api_key_id", apiKeyId)

  const { data, error, count } = await builder

  if (error) {
    console.error("[api:logs]", error.message)
    throw new ApiError("INTERNAL_ERROR", "Erro interno.")
  }

  return { data, meta: { total: count ?? 0, limit, offset } }
})
