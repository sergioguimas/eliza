import { AppointmentStatus, ListAppointmentsQuery } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { createAppointment } from "@/lib/api/domain/appointments"
import { listarAgendamentos } from "@/lib/api/leitura-agendamentos"
import { paraAppointment } from "@/lib/api/serializar"
import { validation } from "@/lib/http/erros"
import { createAppointmentBody } from "@/lib/api/schemas"
import { horaLocalParaUtc, limitesDoDiaUtc } from "@/lib/domain/tempo"

const dateOnly = /^\d{4}-\d{2}-\d{2}$/

// `from`/`to` aceitam "YYYY-MM-DD" (dia inteiro em São Paulo) ou data/hora.
const bound = (v: string, edge: "from" | "to") =>
  dateOnly.test(v)
    ? edge === "from"
      ? limitesDoDiaUtc(v).inicio
      : limitesDoDiaUtc(v).fim
    : horaLocalParaUtc(v, edge)

export const GET = apiRoute("read", async ({ db, organizationId, parseQuery }) => {
  const f = parseQuery(ListAppointmentsQuery)
  const pedidos = f.status?.split(",").map((s) => s.trim()).filter(Boolean)
  const status = pedidos?.map((s) => AppointmentStatus.safeParse(s))

  if (status?.some((s) => !s.success)) {
    throw validation(`Status inválido. Valores: ${AppointmentStatus.options.join(", ")}.`)
  }

  const { itens, total } = await listarAgendamentos(db, organizationId, {
    status: status?.map((s) => s.data!),
    de: f.from ? bound(f.from, "from") : undefined,
    ate: f.to ? bound(f.to, "to") : undefined,
    clienteId: f.customer_id,
    profissionalId: f.professional_id,
    limite: f.limit,
    deslocamento: f.offset,
  })

  return { data: itens.map(paraAppointment), meta: { total, limit: f.limit, offset: f.offset } }
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
