import { z } from "zod"
import { Uuid } from "./comum"

/** GET /customers — exatamente um critério. Máx. 20 resultados, ordem por nome. */
export const CustomersQuery = z
  .object({
    phone: z.string().trim().min(8).max(20).optional(), // casado por brPhoneVariants
    document: z.string().trim().min(3).max(20).optional(),
    q: z.string().trim().min(2).max(60).optional(), // nome, ilike com curingas escapados
  })
  .strict()
  .refine((v) => [v.phone, v.document, v.q].filter(Boolean).length === 1, {
    message: 'Informe exatamente um de "phone", "document" ou "q".',
  })

export const Customer = z.object({
  id: Uuid,
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
})

/** Cliente no POST /appointments: por id, ou dados para resolver/criar (00-dominio §7). */
export const CustomerInput = z.union([
  z.object({ customer_id: Uuid }).strict(),
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
