/**
 * Adicionais escolhidos num agendamento. Fase 1: painel e /marcar usam `AdicionaisEscolhidos`;
 * as demais schemas entram na fase 2 (API v1 e Autoatendimento).
 * Documentação: docs/contratos/adicionais/README.md
 *
 * Quem chama só informa `id` e quantidade. Nome e valor saem do catálogo no
 * servidor: valor enviado pelo navegador nunca é aceito.
 */
import { z } from "zod"

export const LIMITE_ADICIONAIS_ESCOLHIDOS = 10
/** Mãos e pés: 20 unhas. Vale para qualquer unidade. */
export const QUANTIDADE_MAXIMA_ADICIONAL = 20

const Quantidade = z.number().int().min(1).max(QUANTIDADE_MAXIMA_ADICIONAL)

const semRepetir = (itens: { id: string }[]) => new Set(itens.map((i) => i.id)).size === itens.length

/** Entrada do painel, do /marcar e do Autoatendimento. */
export const AdicionalEscolhido = z.object({ id: z.uuid(), quantidade: Quantidade }).strict()

export const AdicionaisEscolhidos = z
  .array(AdicionalEscolhido)
  .max(LIMITE_ADICIONAIS_ESCOLHIDOS)
  .refine(semRepetir, { message: "Adicional repetido." })

/** Entrada da API v1. */
export const AppointmentAddonInput = z.object({ id: z.uuid(), quantity: Quantidade }).strict()

export const AppointmentAddonsInput = z
  .array(AppointmentAddonInput)
  .max(LIMITE_ADICIONAIS_ESCOLHIDOS)
  .refine(semRepetir, { message: "Duplicate add-on." })

/** Cópia gravada no agendamento, na saída do Autoatendimento. */
export const AdicionalDoAgendamento = z.object({
  id: z.uuid(),
  nome: z.string(),
  /** Em reais, por unidade, como estava no catálogo quando foi escolhido. */
  valorUnitario: z.number().positive(),
  /** Ex.: "por unha". null = valor fixo, e `quantidade` é sempre 1. */
  unidade: z.string().nullable(),
  quantidade: Quantidade,
  /** `valorUnitario` x `quantidade`, em reais. */
  total: z.number().positive(),
})

/** Cópia gravada no agendamento, na saída da API v1. */
export const AppointmentAddon = z.object({
  id: z.uuid(),
  name: z.string(),
  unit_price: z.number().positive(),
  unit: z.string().nullable(),
  quantity: Quantidade,
  total: z.number().positive(),
})

export type AdicionalEscolhido = z.infer<typeof AdicionalEscolhido>
export type AdicionalDoAgendamento = z.infer<typeof AdicionalDoAgendamento>
