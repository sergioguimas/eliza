/**
 * Agendamentos do cliente identificado pelo ticket.
 * Documentação: docs/contratos/autoatendimento/04-agendamentos.md
 */
import { z } from "zod"
import { DataHoraLocal, Momento, StatusAgendamento, Uuid, respostaOk } from "./comum"

export const AgendamentoResumo = z.object({
  id: Uuid,
  status: StatusAgendamento,
  inicio: Momento,
  fim: Momento,
  servico: z.object({ id: Uuid, nome: z.string() }).nullable(),
  profissional: z.object({ id: Uuid, nome: z.string() }).nullable(),
  /** Calculados pelo Eliza com a política da org; o atendente não recalcula. */
  podeCancelar: z.boolean(),
  podeRemarcar: z.boolean(),
  podeConfirmar: z.boolean(),
})

// GET /api/v1/autoatendimento/agendamentos
export const ListarAgendamentosResposta = respostaOk(
  z.object({ agendamentos: z.array(AgendamentoResumo) })
)

// POST /api/v1/autoatendimento/agendamentos
export const CriarAgendamentoBody = z
  .object({
    servicoId: Uuid,
    profissionalId: Uuid,
    inicio: DataHoraLocal,
    observacao: z.string().trim().max(500).optional(),
  })
  .strict()

// POST /api/v1/autoatendimento/agendamentos/{id}/remarcar
export const RemarcarAgendamentoBody = z
  .object({
    inicio: DataHoraLocal,
    /** Omitido = mantém o profissional atual. O serviço nunca muda na remarcação. */
    profissionalId: Uuid.optional(),
  })
  .strict()

// POST /api/v1/autoatendimento/agendamentos/{id}/cancelar
export const CancelarAgendamentoBody = z
  .object({
    motivo: z.string().trim().max(300).optional(),
  })
  .strict()

// POST /api/v1/autoatendimento/agendamentos/{id}/confirmar
export const ConfirmarAgendamentoBody = z.object({}).strict()

export const AgendamentoIdParams = z.object({ id: Uuid })

/** Resposta de criar, remarcar, cancelar e confirmar. */
export const AgendamentoResposta = respostaOk(
  z.object({ agendamento: AgendamentoResumo })
)

export type AgendamentoResumo = z.infer<typeof AgendamentoResumo>
export type CriarAgendamentoBody = z.infer<typeof CriarAgendamentoBody>
export type RemarcarAgendamentoBody = z.infer<typeof RemarcarAgendamentoBody>
export type CancelarAgendamentoBody = z.infer<typeof CancelarAgendamentoBody>
