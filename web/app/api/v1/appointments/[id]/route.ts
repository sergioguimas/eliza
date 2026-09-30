import { apiRoute } from "@/lib/api/handler"
import { deleteAppointment, getAppointment, rescheduleAppointment } from "@/lib/api/domain/appointments"
import { updateAppointmentBody } from "@/lib/api/schemas"
import { parseApiDateTime } from "@/lib/api/tempo"
import { z } from "zod"

export const GET = apiRoute("read", async ({ db, organizationId, params }) => ({
  data: await getAppointment(db, organizationId, params.id),
}))

/** Remarcar/alterar: horário, profissional, serviço e/ou observação. */
export const PATCH = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const input = await body(updateAppointmentBody)

  const data = await rescheduleAppointment(db, organizationId, { keyPrefix }, params.id, {
    start: input.start_time ? parseApiDateTime(input.start_time) : undefined,
    professional_id: input.professional_id,
    service_id: input.service_id,
    notes: input.notes,
    notify: input.notify,
  })

  return { data }
})

/** Exclusão definitiva. Para manter histórico, prefira POST .../cancel. */
export const DELETE = apiRoute("write", async ({ db, organizationId, keyPrefix, params, query }) => {
  const notify = z.enum(["true", "false"]).catch("false").parse(query.get("notify")) === "true"

  await deleteAppointment(db, organizationId, { keyPrefix }, params.id, { notify })

  return { data: { id: params.id, deleted: true } }
})
