import { z } from "zod"
import {
  AppointmentStatus,
  DateTimeInput,
  LocalDate,
  LocalDateTime,
  PaymentStatus,
  UtcInstant,
  Uuid,
} from "./comum"
import { CustomerInput } from "./clientes"

// ---------------------------------------------------------------- resposta

/** Shape AS-IS de serializeAppointment (a0ff88a). Mantido por compatibilidade. */
export const Appointment = z.object({
  id: Uuid,
  status: AppointmentStatus,
  start_time: UtcInstant,
  end_time: UtcInstant,
  start_local: LocalDateTime,
  end_local: LocalDateTime,
  customer: z.object({ id: Uuid, name: z.string().nullable(), phone: z.string().nullable() }),
  service: z.object({ id: Uuid, title: z.string(), duration_minutes: z.number().int() }).nullable(),
  professional: z.object({ id: Uuid, name: z.string() }).nullable(),
  price: z.number().nullable(),
  payment_status: PaymentStatus.nullable(),
  payment_method: z.string().nullable(),
  paid_at: UtcInstant.nullable(),
  notes: z.string().nullable(),
  created_at: UtcInstant,
  updated_at: UtcInstant.nullable(),
})

/** meta das escritas que podem notificar (D6). */
export const NotifyMeta = z.object({
  notified: z.boolean(),
  /** Presente quando notify=true mas a mensagem não saiu. */
  notify_skipped: z.enum(["new_customer", "org_limit", "no_phone", "send_failed"]).optional(),
})

// ---------------------------------------------------------------- GET /appointments

export const ListAppointmentsQuery = z
  .object({
    status: z.string().optional(), // lista separada por vírgula de AppointmentStatus
    from: z.union([LocalDate, DateTimeInput]).optional(), // data = início do dia em SP
    to: z.union([LocalDate, DateTimeInput]).optional(), // data = fim do dia em SP (exclusivo)
    customer_id: Uuid.optional(),
    professional_id: Uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()

// ---------------------------------------------------------------- escrita

const notify = z.boolean().default(false)

/** POST /appointments — escopo write. */
export const CreateAppointmentBody = z
  .object({
    customer: CustomerInput,
    professional_id: Uuid,
    service_id: Uuid,
    start_time: DateTimeInput,
    notes: z.string().trim().max(500).nullable().optional(),
    status: z.enum(["pending", "scheduled", "confirmed"]).default("scheduled"),
    notify,
  })
  .strict()

/** PATCH /appointments/{id} — escopo write. Só em pending/scheduled/confirmed. */
export const UpdateAppointmentBody = z
  .object({
    start_time: DateTimeInput.optional(),
    professional_id: Uuid.optional(),
    service_id: Uuid.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    notify,
  })
  .strict()
  .refine(
    (v) =>
      v.start_time !== undefined ||
      v.professional_id !== undefined ||
      v.service_id !== undefined ||
      v.notes !== undefined,
    { message: "Informe ao menos um campo para alterar." }
  )

/** POST /appointments/{id}/confirm — escopo write. */
export const ConfirmBody = z.object({ notify }).strict()

/** POST /appointments/{id}/cancel — escopo write. Nunca apaga o registro. */
export const CancelBody = z
  .object({ reason: z.string().trim().max(300).optional(), notify })
  .strict()

/** POST /appointments/{id}/status — escopo write. Transição validada pela máquina de 00-dominio §5. */
export const StatusBody = z
  .object({
    status: AppointmentStatus,
    reason: z.string().trim().max(300).optional(),
    notify,
  })
  .strict()

/**
 * POST /appointments/{id}/payment — escopo `payments` (D5), não `write`.
 * Recusado em canceled e no_show. Permitido antes de concluir (sinal, D10).
 * Repetir `paid` num agendamento já pago não altera `paid_at` (idempotente).
 */
export const PaymentBody = z
  .object({
    /** = appointments_payment_method_check. Texto livre (AS-IS da a0ff88a) violava o CHECK do banco. */
    method: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "outro"]),
    status: PaymentStatus.default("paid"),
  })
  .strict()

// DELETE /appointments/{id} — REMOVIDO (D5). A rota deixa de exportar DELETE (o Next responde 405).
