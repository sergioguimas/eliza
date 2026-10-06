import { z } from "zod"
import { apiRoute } from "@/lib/api/handler"
import { validation } from "@/lib/http/erros"
import { APPOINTMENT_STATUSES, type AppointmentStatus, createAppointment, listAppointments } from "@/lib/api/domain/appointments"
import { createAppointmentBody } from "@/lib/api/schemas"
import { horaLocalParaUtc, limitesDoDiaUtc } from "@/lib/domain/tempo"

const listQuery = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const dateOnly = /^\d{4}-\d{2}-\d{2}$/

// `from`/`to` aceitam "YYYY-MM-DD" (dia inteiro em São Paulo) ou data/hora.
const bound = (v: string, edge: "from" | "to") =>
  dateOnly.test(v)
    ? edge === "from"
      ? limitesDoDiaUtc(v).inicio
      : limitesDoDiaUtc(v).fim
    : horaLocalParaUtc(v, edge)

export const GET = apiRoute("read", async ({ db, organizationId, query }) => {
  const parsed = listQuery.safeParse(Object.fromEntries(query))

  if (!parsed.success) {
    throw validation("Parâmetros inválidos.", parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })))
  }

  const f = parsed.data
  const statuses = f.status?.split(",").map((s) => s.trim()).filter(Boolean)

  if (statuses?.some((s) => !(APPOINTMENT_STATUSES as readonly string[]).includes(s))) {
    throw validation(`Status inválido. Valores: ${APPOINTMENT_STATUSES.join(", ")}.`)
  }

  const { items, total } = await listAppointments(db, organizationId, {
    status: statuses as AppointmentStatus[] | undefined,
    from: f.from ? bound(f.from, "from") : undefined,
    to: f.to ? bound(f.to, "to") : undefined,
    customerId: f.customer_id,
    professionalId: f.professional_id,
    limit: f.limit,
    offset: f.offset,
  })

  return { data: items, meta: { total, limit: f.limit, offset: f.offset } }
})

export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, body }) => {
  const input = await body(createAppointmentBody)

  const appointment = await createAppointment(db, organizationId, { keyPrefix }, {
    customer: input.customer,
    professional_id: input.professional_id,
    service_id: input.service_id,
    start: horaLocalParaUtc(input.start_time),
    notes: input.notes,
    status: input.status,
    notify: input.notify,
  })

  return { data: appointment, status: 201 }
})
