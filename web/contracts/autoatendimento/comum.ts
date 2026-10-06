/**
 * API de Autoatendimento — tipos compartilhados.
 *
 * Revisado em 2026-10-06 (D3/D8): envelope e erros vêm de ../comum/envelope.ts.
 *
 * Contrato TO-BE. Fonte da verdade: este diretório. O serviço `eliza-atendente`
 * mantém uma cópia versionada dele; os dois lados conferem CONTRATO_VERSAO.
 * Documentação: docs/contratos/autoatendimento/README.md
 */
import { z } from "zod"

export const CONTRATO_VERSAO = "1" as const

export const HEADER_VERSAO = "X-Autoatendimento-Versao"
export const HEADER_TICKET = "X-Autoatendimento-Ticket"

export const FUSO_HORARIO = "America/Sao_Paulo" as const

export const Uuid = z.uuid()

/** Data de calendário em America/Sao_Paulo. Ex.: "2026-10-05" */
export const DataLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD")

/** Hora de relógio em America/Sao_Paulo. Ex.: "14:30" */
export const HoraLocal = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")

/** Data e hora de relógio em America/Sao_Paulo, sem offset. Ex.: "2026-10-05T14:30" */
export const DataHoraLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, "Use AAAA-MM-DDTHH:mm")

/** Instante absoluto em UTC. Ex.: "2026-10-05T17:30:00.000Z" */
export const InstanteUtc = z.iso.datetime()

/** Telefone só com dígitos, como chega do WhatsApp (com DDI). */
export const Telefone = z.string().regex(/^\d{10,15}$/)

/** Todo horário devolvido pela API vem nas duas formas. */
export const Momento = z.object({
  utc: InstanteUtc,
  local: DataHoraLocal,
})

export const StatusAgendamento = z.enum([
  "pending",
  "scheduled",
  "confirmed",
  "arrived",
  "completed",
  "canceled",
  "no_show",
])

// Envelope e catálogo de erros são os mesmos da API v1 (decisão D3,
// docs/contratos/DECISOES_API.md). Sucesso: { data, meta? }. Erro:
// { error: { code, message, details?, request_id } }.
export {
  ErrorCode,
  HTTP_STATUS_BY_CODE,
  ApiErrorBody,
  apiSuccess,
  HEADER_REQUEST_ID,
} from "../comum/envelope"

export type Momento = z.infer<typeof Momento>
export type StatusAgendamento = z.infer<typeof StatusAgendamento>
