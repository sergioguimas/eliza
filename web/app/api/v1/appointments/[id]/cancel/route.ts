import { CancelBody } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { mudarStatusPelaChave } from "@/lib/api/mudar-status"

/** Cancela mantendo o registro (status "canceled"). */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { reason, notify } = await body(CancelBody)

  return mudarStatusPelaChave(db, { organizationId, keyPrefix }, params.id, "canceled", { motivo: reason, notify })
})
