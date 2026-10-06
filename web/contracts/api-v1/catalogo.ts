import { z } from "zod"
import { LocalDate, Uuid } from "./comum"

/** GET /services */
export const Service = z.object({
  id: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  duration_minutes: z.number().int(), // 30 quando o cadastro está nulo/0
  price: z.number().nullable(),
})

/** GET /professionals — nunca phone nem license_number. */
export const Professional = z.object({
  id: Uuid,
  name: z.string(),
  specialty: z.string().nullable(),
})

/**
 * GET /availability
 * TO-BE: `service_id` passa a ser OBRIGATÓRIO. A janela testada é a duração
 * do serviço; sem ele, a resposta mentia para serviço longo.
 */
export const AvailabilityQuery = z
  .object({
    professional_id: Uuid,
    service_id: Uuid,
    date: LocalDate,
  })
  .strict()

export const SlotReason = z.enum([
  "organizacao_fechada",
  "profissional_sem_expediente",
  "fora_do_expediente",
  "intervalo",
  "ocupado",
  "antecedencia_minima",
  "fora_da_grade",
  "agenda_cheia",
])

export const Availability = z.object({
  date: LocalDate,
  professional_id: Uuid,
  service_id: Uuid,
  slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)), // "HH:mm", relógio de SP, só futuros
  empty_reason: SlotReason.nullable(), // preenchido só quando slots = []
})

export const AvailabilityMeta = z.object({
  timezone: z.literal("America/Sao_Paulo"),
  /** Os slots são pontos da grade; POST /appointments também aceita horário fora dela (E1). */
  grid_step_minutes: z.number().int(),
})
