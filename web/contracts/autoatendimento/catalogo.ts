/**
 * Catálogo (serviços e profissionais) e horários livres.
 * Documentação: docs/contratos/autoatendimento/03-catalogo-e-horarios.md
 */
import { z } from "zod"
import { DataLocal, HoraLocal, Uuid, apiSuccess } from "./comum"

export const Servico = z.object({
  id: Uuid,
  nome: z.string(),
  descricao: z.string().nullable(),
  duracaoMinutos: z.number().int().positive(),
  /** Em reais. null = não divulgar preço. */
  preco: z.number().nonnegative().nullable(),
})

export const Profissional = z.object({
  id: Uuid,
  nome: z.string(),
  especialidade: z.string().nullable(),
})

// GET /api/v1/autoatendimento/servicos
export const ListarServicosResposta = apiSuccess(
  z.object({ servicos: z.array(Servico) })
)

// GET /api/v1/autoatendimento/profissionais
export const ListarProfissionaisResposta = apiSuccess(
  z.object({ profissionais: z.array(Profissional) })
)

// GET /api/v1/autoatendimento/horarios?servicoId=&data=&profissionalId=
export const HorariosQuery = z
  .object({
    servicoId: Uuid,
    data: DataLocal,
    /** Omitido = todos os profissionais ativos da org. */
    profissionalId: Uuid.optional(),
  })
  .strict()

/** Mesmos motivos de `getAvailableSlots` (AS-IS), mais os da política da org. */
export const MotivoSemHorario = z.enum([
  "organization_closed_day",
  "professional_unavailable_day",
  "outside_business_hours",
  "fully_booked",
  "antecedencia_minima",
])

export const HorariosResposta = apiSuccess(
  z.object({
    data: DataLocal,
    servicoId: Uuid,
    porProfissional: z.array(
      z.object({
        profissional: Profissional,
        /** Horários de INÍCIO livres para a duração do serviço, em ordem. */
        horarios: z.array(HoraLocal),
        /** Preenchido só quando `horarios` está vazio. */
        motivoVazio: MotivoSemHorario.nullable(),
      })
    ),
  })
)

export type Servico = z.infer<typeof Servico>
export type Profissional = z.infer<typeof Profissional>
export type HorariosQuery = z.infer<typeof HorariosQuery>
export type MotivoSemHorario = z.infer<typeof MotivoSemHorario>
