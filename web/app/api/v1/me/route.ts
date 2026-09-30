import { apiRoute } from "@/lib/api/handler"

export const GET = apiRoute("read", async ({ db, organizationId, apiKeyId }) => {
  const [{ data: org }, { data: key }] = await Promise.all([
    db.from("organizations").select("id, name, slug, niche").eq("id", organizationId).single(),
    db.from("api_keys").select("id, name, key_prefix, scopes, created_at, expires_at").eq("id", apiKeyId).single(),
  ])

  return { data: { organization: org, api_key: key } }
})
