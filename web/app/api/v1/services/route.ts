import { apiRoute } from "@/lib/api/handler"
import { ApiError } from "@/lib/api/http"

export const GET = apiRoute("read", async ({ db, organizationId }) => {
  const { data, error } = await db
    .from("services")
    .select("id, title, description, duration_minutes, price")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("title")

  if (error) {
    console.error("[api:services]", error.message)
    throw new ApiError(500, "INTERNAL_ERROR", "Erro interno.")
  }

  return { data }
})
