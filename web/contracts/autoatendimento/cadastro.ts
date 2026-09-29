/**
 * Cadastro do próprio cliente. O telefone nunca vem no body: é o do ticket.
 * Documentação: docs/contratos/autoatendimento/05-cadastro.md
 */
import { z } from "zod"
import { DataLocal, Uuid, respostaOk } from "./comum"

/** Só dígitos (CPF) ou alfanumérico (CNPJ novo); a API normaliza. */
const Documento = z.string().trim().min(11).max(18)

export const Cadastro = z.object({
  id: Uuid,
  nome: z.string(),
  email: z.string().nullable(),
  /** Ex.: "***.***.789-01". O documento completo nunca sai da API. */
  documentoMascarado: z.string().nullable(),
  dataNascimentoInformada: z.boolean(),
})

// GET /api/v1/autoatendimento/cadastro
export const CadastroResposta = respostaOk(z.object({ cadastro: Cadastro }))

// POST /api/v1/autoatendimento/cadastro
export const CriarCadastroBody = z
  .object({
    nome: z.string().trim().min(3).max(120),
    documento: Documento,
    email: z.email().optional(),
    dataNascimento: DataLocal.optional(),
  })
  .strict()

// PATCH /api/v1/autoatendimento/cadastro
export const AtualizarCadastroBody = z
  .object({
    nome: z.string().trim().min(3).max(120).optional(),
    email: z.email().optional(),
    dataNascimento: DataLocal.optional(),
    /** Aceito só se o cadastro ainda não tem documento. Nunca troca um existente. */
    documento: Documento.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Informe ao menos um campo.",
  })

export type Cadastro = z.infer<typeof Cadastro>
export type CriarCadastroBody = z.infer<typeof CriarCadastroBody>
export type AtualizarCadastroBody = z.infer<typeof AtualizarCadastroBody>
