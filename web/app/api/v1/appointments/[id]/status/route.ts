import { StatusBody } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { mudarStatusPelaChave } from "@/lib/api/mudar-status"

/** Mudança de status pela máquina do domínio (chegou, finalizado, faltou...). */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { status, reason, notify } = await body(StatusBody)

  return mudarStatusPelaChave(db, { organizationId, keyPrefix }, params.id, status, { motivo: reason, notify })
})
