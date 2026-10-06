import { ConfirmBody } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { mudarStatusPelaChave } from "@/lib/api/mudar-status"

/** pending/scheduled -> confirmed (máquina de status do domínio). */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { notify } = await body(ConfirmBody)

  return mudarStatusPelaChave(db, { organizationId, keyPrefix }, params.id, "confirmed", { notify })
})
