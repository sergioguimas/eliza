import { apiRoute } from "@/lib/api/handler"
import { changeStatus } from "@/lib/api/domain/appointments"
import { statusBody } from "@/lib/api/schemas"

/** Mudança de status com validação de transição (chegou, finalizado, faltou...). */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { status, notify, reason } = await body(statusBody)

  return { data: await changeStatus(db, organizationId, { keyPrefix }, params.id, status, { notify, reason }) }
})
