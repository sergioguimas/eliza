/**
 * API v1 B2B — tipos de base.
 * Contrato: docs/contratos/api-v1/README.md. Envelope/erros: ../comum/envelope.ts
 */
import { z } from "zod"

export const Uuid = z.uuid()

/** "AAAA-MM-DD" no relógio de São Paulo. */
export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

/**
 * Entrada de data/hora: relógio de São Paulo sem offset ("2026-10-05T14:30",
 * segundos opcionais) OU ISO 8601 com Z/offset. A conversão é
 * horaLocalParaUtc (web/lib/domain/tempo.ts); malformado -> 422.
 */
export const DateTimeInput = z.string().trim().min(16).max(40)

/** Saída: "AAAA-MM-DDTHH:mm" no relógio de São Paulo. */
export const LocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
export const UtcInstant = z.iso.datetime({ offset: true })

export const AppointmentStatus = z.enum([
  "pending",
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "canceled",
  "no_show",
])

export const PaymentStatus = z.enum(["pending", "paid", "partially_paid", "refunded"])

/** Escopos de API key. `payments` é novo (D5); chaves antigas não o recebem automaticamente. */
export const ApiScope = z.enum(["read", "write", "payments"])

export type AppointmentStatus = z.infer<typeof AppointmentStatus>
export type ApiScope = z.infer<typeof ApiScope>
