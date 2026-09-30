import { apiRoute } from "@/lib/api/handler"
import { changeStatus } from "@/lib/api/domain/appointments"
import { confirmBody } from "@/lib/api/schemas"

/** pending/scheduled -> confirmed. */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { notify } = await body(confirmBody)

  return { data: await changeStatus(db, organizationId, { keyPrefix }, params.id, "confirmed", { notify }) }
})
