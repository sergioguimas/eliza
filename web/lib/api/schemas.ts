import { z } from "zod"
import { APPOINTMENT_STATUSES } from "./domain/appointments"

const uuid = z.string().uuid()
const dateTime = z.string().min(16).max(40)

export const customerInput = z.union([
  z.object({ customer_id: uuid }).strict(),
  z
    .object({
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().min(8).max(20),
      document: z.string().trim().max(20).optional(),
      birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      gender: z.string().trim().max(20).optional(),
    })
    .strict(),
])

const notify = z.boolean().default(false)

export const createAppointmentBody = z
  .object({
    customer: customerInput,
    professional_id: uuid,
    service_id: uuid,
    start_time: dateTime,
    notes: z.string().trim().max(500).nullable().optional(),
    status: z.enum(["pending", "scheduled", "confirmed"]).default("scheduled"),
    notify,
  })
  .strict()

export const updateAppointmentBody = z
  .object({
    start_time: dateTime.optional(),
    professional_id: uuid.optional(),
    service_id: uuid.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    notify,
  })
  .strict()
  .refine(
    (v) => v.start_time !== undefined || v.professional_id !== undefined || v.service_id !== undefined || v.notes !== undefined,
    { message: "Informe ao menos um campo para alterar." }
  )

export const cancelBody = z
  .object({ reason: z.string().trim().max(300).optional(), notify })
  .strict()

export const confirmBody = z.object({ notify }).strict()

export const statusBody = z
  .object({ status: z.enum(APPOINTMENT_STATUSES), reason: z.string().trim().max(300).optional(), notify })
  .strict()

export const paymentBody = z
  .object({
    method: z.string().trim().min(1).max(40),
    status: z.enum(["paid", "pending", "partially_paid", "refunded"]).default("paid"),
  })
  .strict()

export const idParam = uuid
