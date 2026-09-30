import { apiRoute } from "@/lib/api/handler"
import { changeStatus } from "@/lib/api/domain/appointments"
import { cancelBody } from "@/lib/api/schemas"

/** Cancela mantendo o registro (status "canceled"). */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { notify, reason } = await body(cancelBody)

  return { data: await changeStatus(db, organizationId, { keyPrefix }, params.id, "canceled", { notify, reason }) }
})
