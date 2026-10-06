import { apiRoute } from "@/lib/api/handler"
import { ApiError } from "@/lib/http/erros"

export const GET = apiRoute("read", async ({ db, organizationId }) => {
  const { data, error } = await db
    .from("professionals")
    .select("id, name, specialty")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("[api:professionals]", error.message)
    throw new ApiError("INTERNAL_ERROR", "Erro interno.")
  }

  return { data }
})
