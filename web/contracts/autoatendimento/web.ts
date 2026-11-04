import { z } from "zod"
import { InstanteUtc, Uuid } from "./comum"
import { TicketEmitido } from "./ticket"

/**
 * Canal web: chat da página pública `/marcar/[slug]` (contrato 08). O chat nunca
 * grava: devolve ações que preenchem o formulário.
 */

export const CHAT_TEXTO_MAX = 500

export const FormularioChat = z
  .object({
    etapa: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    servicoId: Uuid.nullable(),
    profissionalId: Uuid.nullable(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    hora: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  })
  .strict()
export type FormularioChat = z.infer<typeof FormularioChat>

export const ChatWebBody = z
  .object({
    texto: z.string().trim().min(1).max(CHAT_TEXTO_MAX),
    /** Estado do formulário, só como dica ao agente. Não é confiável e não autoriza nada. */
    formulario: FormularioChat,
  })
  .strict()

export const MensagemWeb = z
  .object({
    versao: z.literal(1),
    canal: z.literal("web"),
    /** UUID v4 novo por mensagem; o agens deduplica por ele */
    mensagemId: Uuid,
    orgId: Uuid,
    /** "web:" + sess: chave da conversa no agens */
    contato: z.string().regex(/^web:[0-9a-f-]{36}$/),
    texto: z.string().min(1).max(CHAT_TEXTO_MAX),
    recebidaEm: InstanteUtc,
    ticket: TicketEmitido,
    formulario: FormularioChat,
  })
  .strict()

export const AcaoPreencherAgendamento = z
  .object({
    tipo: z.literal("preencher_agendamento"),
    servicoId: Uuid.optional(),
    profissionalId: Uuid.optional(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict()
  .refine((a) => a.servicoId || a.profissionalId || a.data || a.hora, "ação vazia")
export type AcaoPreencherAgendamento = z.infer<typeof AcaoPreencherAgendamento>

export const ChatWebResposta = z
  .object({
    resposta: z.string().min(1).max(2000),
    acoes: z.array(AcaoPreencherAgendamento).max(3),
  })
  .strict()
export type ChatWebResposta = z.infer<typeof ChatWebResposta>
