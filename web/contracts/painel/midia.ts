/**
 * Biblioteca de fotos do painel — contrato. Documentação: docs/contratos/midia-vitrine/01-armazenamento-e-upload.md
 * Rota: POST /api/painel/midia (sessão de owner/admin, multipart/form-data).
 */
import { z } from "zod"
import { apiSuccess } from "../comum/envelope"

export const MidiaPainel = z.object({
  id: z.uuid(),
  url: z.url(),
  urlPequena: z.url(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
  alt: z.string().min(3).max(200),
  cor: z.string().regex(/^#[0-9a-f]{6}$/),
  criadaEm: z.iso.datetime(),
  /** Quantos lugares usam a foto (categorias + itens de vitrine). 0 = pode excluir. */
  usos: z.number().int().nonnegative(),
}).strict()

export const UploadMidiaResposta = apiSuccess(MidiaPainel).strict()
export type MidiaPainel = z.infer<typeof MidiaPainel>

/** Campos de entrada do formulário (o arquivo, `arquivo`, é conferido na rota: ≤ 8 MB, jpeg/png/webp). */
export const TAMANHO_MAXIMO_BYTES = 8_388_608
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const
export const LIMITE_FOTOS_ATIVAS = 80

/** Frações 0..1 da imagem enviada; `x+largura` e `y+altura` não passam de 1. */
export const RecorteMidia = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    largura: z.number().finite().gt(0).max(1),
    altura: z.number().finite().gt(0).max(1),
  })
  .strict()
  .refine((r) => r.x + r.largura <= 1 + 1e-6 && r.y + r.altura <= 1 + 1e-6, {
    message: "O recorte passa dos limites da imagem.",
  })

export const AltMidia = z.string().trim().min(3, "Descreva a foto em pelo menos 3 caracteres.").max(200, "A descrição pode ter até 200 caracteres.")
