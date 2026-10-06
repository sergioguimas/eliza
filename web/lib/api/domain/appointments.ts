import "server-only"

import { checkOrganizationBusinessHours, checkProfessionalAvailability } from "@/lib/appointment-config"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { ApiError, notFound } from "../http"
import type { Db } from "../handler"
import { utcParaHoraLocal as toLocalString } from "@/lib/domain/tempo"

export const APPOINTMENT_STATUSES = [
  "pending",
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "canceled",
  "no_show",
] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

// Status que ocupam agenda (mesmo conjunto da exclusion constraint).
const ACTIVE: AppointmentStatus[] = ["pending", "scheduled", "confirmed", "arrived"]
const EDITABLE: AppointmentStatus[] = ["pending", "scheduled", "confirmed"]

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["scheduled", "confirmed", "canceled"],
  scheduled: ["confirmed", "arrived", "completed", "no_show", "canceled"],
  confirmed: ["arrived", "completed", "no_show", "canceled"],
  arrived: ["completed", "no_show", "canceled"],
  completed: [],
  canceled: [],
  no_show: [],
}

const SELECT = `
  id, status, start_time, end_time, notes, price, payment_status, payment_method,
  paid_at, created_at, updated_at, customer_id, professional_id, service_id,
  customers ( id, name, phone ),
  services ( id, title, duration_minutes ),
  professionals ( id, name )
`

type AppointmentRow = {
  id: string
  status: string | null
  start_time: string
  end_time: string
  notes: string | null
  price: number | null
  payment_status: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
  updated_at: string | null
  customer_id: string
  professional_id: string | null
  service_id: string | null
  customers: { id: string; name: string; phone: string } | null
  services: { id: string; title: string; duration_minutes: number } | null
  professionals: { id: string; name: string } | null
}

export function serializeAppointment(row: AppointmentRow) {
  return {
    id: row.id as string,
    status: row.status as string,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    start_local: toLocalString(row.start_time),
    end_local: toLocalString(row.end_time),
    customer: row.customers
      ? { id: row.customers.id, name: row.customers.name, phone: row.customers.phone }
      : { id: row.customer_id, name: null, phone: null },
    service: row.services
      ? { id: row.services.id, title: row.services.title, duration_minutes: row.services.duration_minutes }
      : null,
    professional: row.professionals ? { id: row.professionals.id, name: row.professionals.name } : null,
    price: row.price as number | null,
    payment_status: row.payment_status as string | null,
    payment_method: row.payment_method as string | null,
    paid_at: row.paid_at as string | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string | null,
  }
}

type Serialized = ReturnType<typeof serializeAppointment>

/** Todo acesso por id passa por aqui: id E tenant, senão 404. */
async function loadRow(db: Db, organizationId: string, id: string): Promise<AppointmentRow> {
  const { data, error } = await db
    .from("appointments")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    // 22P02: id que não é UUID.
    if (error.code === "22P02") throw notFound("Agendamento")
    console.error("[api:appointments:load]", error.message)
    throw new ApiError(500, "INTERNAL_ERROR", "Erro interno.")
  }

  if (!data) throw notFound("Agendamento")

  return data as unknown as AppointmentRow
}

export async function getAppointment(db: Db, organizationId: string, id: string): Promise<Serialized> {
  return serializeAppointment(await loadRow(db, organizationId, id))
}

export async function listAppointments(
  db: Db,
  organizationId: string,
  f: {
    status?: AppointmentStatus[]
    from?: Date
    to?: Date
    customerId?: string
    professionalId?: string
    limit: number
    offset: number
  }
) {
  let q = db
    .from("appointments")
    .select(SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .order("start_time", { ascending: true })
    .range(f.offset, f.offset + f.limit - 1)

  if (f.status?.length) q = q.in("status", f.status)
  if (f.from) q = q.gte("start_time", f.from.toISOString())
  if (f.to) q = q.lt("start_time", f.to.toISOString())
  if (f.customerId) q = q.eq("customer_id", f.customerId)
  if (f.professionalId) q = q.eq("professional_id", f.professionalId)

  const { data, error, count } = await q

  if (error) {
    console.error("[api:appointments:list]", error.message)
    throw new ApiError(500, "INTERNAL_ERROR", "Erro interno.")
  }

  return { items: (data as unknown as AppointmentRow[]).map(serializeAppointment), total: count ?? 0 }
}

type Actor = { keyPrefix: string }

async function audit(db: Db, actor: Actor, action: string, row: { id: string; customer_id: string }, detail?: string) {
  const { error } = await db.from("appointment_logs").insert({
    appointment_id: row.id,
    customer_id: row.customer_id,
    action,
    source: `api:${actor.keyPrefix}`,
    raw_message: detail ?? null,
  })

  if (error) console.error("[api:appointments:audit]", error.message)
}

function formatWhen(iso: string) {
  const [date, time] = toLocalString(iso).split("T")
  const [y, m, d] = date.split("-")

  return { dia: `${d}/${m}/${y}`, hora: time }
}

async function notifyCustomer(organizationId: string, row: AppointmentRow, message: (nome: string, servico: string) => string) {
  const customer = row.customers
  const phone = customer?.phone

  if (!customer || !phone) return false

  try {
    const result = await sendWhatsAppMessage({
      phone,
      organizationId,
      message: message(customer.name, row.services?.title || "atendimento"),
    })

    return !!result?.success
  } catch (error) {
    console.error("[api:appointments:notify]", error)
    return false
  }
}

function mapInsertError(error: { code?: string; message: string }): never {
  if (error.code === "23P01") {
    throw new ApiError(409, "SLOT_UNAVAILABLE", "Este horário acabou de ser ocupado. Escolha outro.")
  }

  console.error("[api:appointments:write]", error.message)
  throw new ApiError(500, "INTERNAL_ERROR", "Erro ao salvar agendamento.")
}

async function assertBookable(
  db: Db,
  organizationId: string,
  professionalId: string,
  start: Date,
  end: Date
) {
  if (start.getTime() < Date.now()) {
    throw new ApiError(422, "VALIDATION_ERROR", "O horário informado já passou.")
  }

  const org = await checkOrganizationBusinessHours(db, organizationId, start, end)
  if (!org.available) throw new ApiError(409, "SLOT_UNAVAILABLE", org.message as string)

  const prof = await checkProfessionalAvailability(db, professionalId, start, end)
  if (!prof.available) throw new ApiError(409, "SLOT_UNAVAILABLE", prof.message as string)
}

async function requireProfessional(db: Db, organizationId: string, id: string) {
  const { data } = await db
    .from("professionals")
    .select("id, name")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) throw notFound("Profissional")
  return data
}

async function requireService(db: Db, organizationId: string, id: string) {
  const { data } = await db
    .from("services")
    .select("id, title, duration_minutes, price")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle()

  if (!data) throw notFound("Serviço")
  return data
}

export type CustomerInput =
  | { customer_id: string }
  | { name: string; phone: string; document?: string; birth_date?: string; gender?: string }

const digits = (v?: string | null) => v?.replace(/\D/g, "") || null

async function resolveCustomer(db: Db, organizationId: string, input: CustomerInput) {
  if ("customer_id" in input) {
    const { data } = await db
      .from("customers")
      .select("id")
      .eq("id", input.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (!data) throw notFound("Cliente")
    return data.id
  }

  const phone = digits(input.phone)
  const document = digits(input.document)

  if (!phone) throw new ApiError(422, "VALIDATION_ERROR", "Telefone do cliente inválido.")

  const filters = [`phone.eq.${phone}`, document ? `document.eq.${document}` : null].filter(Boolean).join(",")

  const { data: existing } = await db
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .or(filters)
    .limit(1)
    .maybeSingle()

  // Cliente existente é REUSADO, nunca sobrescrito: dados de cadastro só
  // mudam pelo painel.
  if (existing) return existing.id

  const { data: created, error } = await db
    .from("customers")
    .insert({
      organization_id: organizationId,
      name: input.name,
      phone,
      document,
      birth_date: input.birth_date ?? null,
      gender: input.gender ?? null,
      active: true,
    })
    .select("id")
    .single()

  if (error || !created) {
    console.error("[api:appointments:customer]", error?.message)
    throw new ApiError(500, "INTERNAL_ERROR", "Erro ao cadastrar o cliente.")
  }

  return created.id
}

export async function createAppointment(
  db: Db,
  organizationId: string,
  actor: Actor,
  input: {
    customer: CustomerInput
    professional_id: string
    service_id: string
    start: Date
    notes?: string | null
    status: "pending" | "scheduled" | "confirmed"
    notify: boolean
  }
) {
  const [professional, service] = await Promise.all([
    requireProfessional(db, organizationId, input.professional_id),
    requireService(db, organizationId, input.service_id),
  ])

  const end = new Date(input.start.getTime() + (service.duration_minutes || 30) * 60000)

  await assertBookable(db, organizationId, professional.id, input.start, end)

  const customerId = await resolveCustomer(db, organizationId, input.customer)

  const { data, error } = await db
    .from("appointments")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      professional_id: professional.id,
      service_id: service.id,
      start_time: input.start.toISOString(),
      end_time: end.toISOString(),
      notes: input.notes ?? null,
      price: service.price ?? 0,
      payment_status: "pending",
      status: input.status,
    })
    .select("id")
    .single()

  if (error || !data) return mapInsertError(error ?? { message: "insert vazio" })

  const row = await loadRow(db, organizationId, data.id)
  await audit(db, actor, "created", row)

  if (input.notify) {
    const { dia, hora } = formatWhen(row.start_time)
    await notifyCustomer(
      organizationId,
      row,
      (nome, servico) => `Olá ${nome}, seu ${servico} foi marcado com sucesso para ${dia} às ${hora}. Aguardamos por você!`
    )
  }

  return serializeAppointment(row)
}

export async function rescheduleAppointment(
  db: Db,
  organizationId: string,
  actor: Actor,
  id: string,
  input: {
    start?: Date
    professional_id?: string
    service_id?: string
    notes?: string | null
    notify: boolean
  }
) {
  const row = await loadRow(db, organizationId, id)

  if (!EDITABLE.includes(row.status as AppointmentStatus)) {
    throw new ApiError(409, "INVALID_TRANSITION", `Agendamento com status "${row.status}" não pode ser alterado.`)
  }

  const serviceId = input.service_id ?? row.service_id
  const professionalId = input.professional_id ?? row.professional_id

  if (!serviceId || !professionalId) {
    throw new ApiError(422, "VALIDATION_ERROR", "Agendamento sem serviço ou profissional: informe ambos.")
  }

  const [service] = await Promise.all([
    requireService(db, organizationId, serviceId),
    requireProfessional(db, organizationId, professionalId),
  ])

  const start = input.start ?? new Date(row.start_time)
  const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000)
  const timeChanged = start.getTime() !== new Date(row.start_time).getTime() || professionalId !== row.professional_id || end.getTime() !== new Date(row.end_time).getTime()

  if (timeChanged) await assertBookable(db, organizationId, professionalId, start, end)

  const update: Record<string, unknown> = {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    professional_id: professionalId,
    service_id: serviceId,
    updated_at: new Date().toISOString(),
  }

  if (input.notes !== undefined) update.notes = input.notes

  // Horário novo: o cron de lembretes precisa avisar de novo.
  if (timeChanged) {
    update.reminder_sent_at = null
    update.reminder_morning_sent_at = null
  }

  const { error } = await db
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) return mapInsertError(error)

  const updated = await loadRow(db, organizationId, id)
  await audit(db, actor, "rescheduled", updated, `${toLocalString(row.start_time)} -> ${toLocalString(updated.start_time)}`)

  if (input.notify && timeChanged) {
    const { dia, hora } = formatWhen(updated.start_time)
    await notifyCustomer(
      organizationId,
      updated,
      (nome, servico) => `Olá ${nome}, atenção: seu agendamento de *${servico}* foi *alterado* para dia ${dia} às ${hora}.`
    )
  }

  return serializeAppointment(updated)
}

export async function changeStatus(
  db: Db,
  organizationId: string,
  actor: Actor,
  id: string,
  next: AppointmentStatus,
  opts: { notify: boolean; reason?: string | null }
) {
  const row = await loadRow(db, organizationId, id)
  const current = row.status as AppointmentStatus

  // Repetir o estado atual é idempotente (retentativa do cliente da API).
  if (current === next) return serializeAppointment(row)

  if (!TRANSITIONS[current]?.includes(next)) {
    throw new ApiError(409, "INVALID_TRANSITION", `Não é possível mudar de "${current}" para "${next}".`)
  }

  const { error } = await db
    .from("appointments")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) return mapInsertError(error)

  const updated = await loadRow(db, organizationId, id)
  await audit(db, actor, next === "canceled" ? "canceled" : `status:${next}`, updated, opts.reason ?? undefined)

  if (opts.notify && (next === "canceled" || next === "confirmed")) {
    const { dia, hora } = formatWhen(updated.start_time)

    await notifyCustomer(organizationId, updated, (nome, servico) =>
      next === "canceled"
        ? `Olá ${nome}, seu agendamento de *${servico}* para o dia ${dia} às ${hora} foi *cancelado*.`
        : `✅ *Agendamento confirmado!*\n\nOlá ${nome}, seu horário para *${servico}* em ${dia} às ${hora} está confirmado.`
    )
  }

  return serializeAppointment(updated)
}

export async function registerPayment(
  db: Db,
  organizationId: string,
  actor: Actor,
  id: string,
  input: { method: string; status: "paid" | "pending" | "partially_paid" | "refunded" }
) {
  const row = await loadRow(db, organizationId, id)

  if (row.status === "canceled") {
    throw new ApiError(409, "INVALID_TRANSITION", "Agendamento cancelado não recebe pagamento.")
  }

  const { error } = await db
    .from("appointments")
    .update({
      payment_status: input.status,
      payment_method: input.method,
      paid_at: input.status === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) return mapInsertError(error)

  const updated = await loadRow(db, organizationId, id)
  await audit(db, actor, `payment:${input.status}`, updated, input.method)

  return serializeAppointment(updated)
}

export async function deleteAppointment(
  db: Db,
  organizationId: string,
  actor: Actor,
  id: string,
  opts: { notify: boolean }
) {
  const row = await loadRow(db, organizationId, id)

  // appointment_logs.appointment_id é ON DELETE CASCADE: esta linha some junto
  // com o agendamento. O rastro durável da exclusão é o api_request_logs
  // (DELETE + id na rota), gravado pelo handler.
  const { error } = await db.from("appointments").delete().eq("id", id).eq("organization_id", organizationId)

  if (error) {
    console.error("[api:appointments:delete]", error.message)
    throw new ApiError(500, "INTERNAL_ERROR", "Erro ao excluir agendamento.")
  }

  if (opts.notify) {
    const { dia } = formatWhen(row.start_time)
    await notifyCustomer(
      organizationId,
      row,
      (nome, servico) => `Olá ${nome}, informamos que seu agendamento de *${servico}* no dia ${dia} foi removido da nossa agenda.`
    )
  }
}

export { ACTIVE as ACTIVE_STATUSES }
