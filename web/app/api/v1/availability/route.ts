import { z } from "zod"
import { getAvailableSlots } from "@/app/actions/get-available-slots"
import { apiRoute } from "@/lib/api/handler"
import { ApiError, notFound, parseApiDateTime, validation } from "@/lib/api/http"
import { FUSO, limitesDoDiaUtc, utcParaHoraLocal } from "@/lib/domain/tempo"

const query = z.object({
  professional_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.string().uuid().optional(),
})

/**
 * Horários livres de um profissional num dia. Com `service_id`, descarta os
 * horários em que a duração do serviço invadiria outro agendamento ativo.
 * A validação definitiva é a do POST /appointments (constraint no banco).
 */
export const GET = apiRoute("read", async ({ db, organizationId, query: qs }) => {
  const parsed = query.safeParse(Object.fromEntries(qs))

  if (!parsed.success) {
    throw validation("Parâmetros inválidos.", parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })))
  }

  const { professional_id, date, service_id } = parsed.data

  const result = await getAvailableSlots(professional_id, new Date(limitesDoDiaUtc(date).inicio.getTime() + 12 * 3600000), organizationId)

  if (result.reason === "professional_not_in_organization") throw notFound("Profissional")
  if (result.reason === "error") throw new ApiError(500, "INTERNAL_ERROR", "Erro interno.")

  let slots = result.slots

  const now = Date.now()
  slots = slots.filter((s) => parseApiDateTime(`${date}T${s}`, "slot").getTime() > now)

  if (service_id && slots.length) {
    const { data: service } = await db
      .from("services")
      .select("duration_minutes")
      .eq("id", service_id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle()

    if (!service) throw notFound("Serviço")

    const { inicio: start, fim: end } = limitesDoDiaUtc(date)

    const { data: busy } = await db
      .from("appointments")
      .select("start_time, end_time")
      .eq("organization_id", organizationId)
      .eq("professional_id", professional_id)
      .in("status", ["pending", "scheduled", "confirmed", "arrived"])
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())

    const duration = (service.duration_minutes || 30) * 60000

    slots = slots.filter((s) => {
      const from = parseApiDateTime(`${date}T${s}`, "slot").getTime()
      const to = from + duration

      return !(busy ?? []).some((b) => from < new Date(b.end_time).getTime() && to > new Date(b.start_time).getTime())
    })
  }

  return {
    data: {
      date,
      professional_id,
      slots,
      ...(slots.length === 0 && result.message ? { message: result.message } : {}),
    },
    meta: { timezone: FUSO, example_start_time: slots[0] ? utcParaHoraLocal(parseApiDateTime(`${date}T${slots[0]}`)) : null },
  }
})
