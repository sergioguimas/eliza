import { apiRoute } from "@/lib/api/handler"
import { registerPayment } from "@/lib/api/domain/appointments"
import { paymentBody } from "@/lib/api/schemas"

/** Baixa de pagamento. */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const input = await body(paymentBody)

  return { data: await registerPayment(db, organizationId, { keyPrefix }, params.id, input) }
})
