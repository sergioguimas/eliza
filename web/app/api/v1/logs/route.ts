import { LogsQuery } from "@/contracts/api-v1/conta"
import { apiRoute } from "@/lib/api/handler"

/**
 * Auditoria da própria API. Por padrão só as requisições DESTA chave;
 * `scope=organization` traz as de todas as chaves do tenant. Nunca cruza tenant.
 */
export const GET = apiRoute("read", async ({ db, organizationId, apiKeyId, parseQuery }) => {
  const { limit, offset, scope } = parseQuery(LogsQuery)

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
    throw error
  }

  return { data, meta: { total: count ?? 0, limit, offset } }
})
