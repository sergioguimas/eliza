import "server-only"

import sharp, { type Metadata } from "sharp"
import type { Largura } from "./armazenamento"

/**
 * Toda foto enviada é decodificada e reescrita aqui (contrato midia-vitrine/01 §4): o arquivo original
 * nunca é salvo, o que remove EXIF/GPS, script embutido e formato disfarçado.
 */

sharp.concurrency(1)

/** Frações 0..1 da imagem enviada (já com a orientação do EXIF aplicada, como o navegador mostra). */
export type Recorte = { x: number; y: number; largura: number; altura: number }

export type CodigoProcessamento = "FORMATO" | "RECORTE" | "PEQUENA"

// Campos declarados à parte (sem "parameter properties"), como DomainError.
export class ProcessamentoError extends Error {
  codigo: CodigoProcessamento

  constructor(codigo: CodigoProcessamento, message: string) {
    super(message)
    this.name = "ProcessamentoError"
    this.codigo = codigo
  }
}

const FORMATOS = new Set(["jpeg", "png", "webp"])
const LADO_MINIMO = 480
const PROPORCAO = 3 / 4
const TOLERANCIA = 0.02
const LARGURAS_SAIDA: readonly Largura[] = [960, 480]

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const MSG_FORMATO = "Não foi possível ler essa imagem. Envie uma foto JPEG, PNG ou WebP."

export async function processarFoto(
  entrada: Buffer,
  recorte: Recorte
): Promise<{
  /** `largura` = nome do arquivo (960|480); `larguraReal`/`altura` = pixels de verdade (sem ampliar, a 960 pode ser menor). */
  variantes: { largura: Largura; larguraReal: number; altura: number; dados: Buffer }[]
  cor: string
  bytes: number
}> {
  const opcoes = { limitInputPixels: 40_000_000, failOn: "error" } as const

  // 2. formato decidido pelo conteúdo, não pelo tipo declarado
  let meta: Metadata
  try {
    meta = await sharp(entrada, opcoes).metadata()
  } catch {
    throw new ProcessamentoError("FORMATO", MSG_FORMATO)
  }

  if (!meta.format || !FORMATOS.has(meta.format) || !meta.width || !meta.height) {
    throw new ProcessamentoError("FORMATO", MSG_FORMATO)
  }

  // 3. orientação do EXIF (5–8 trocam largura e altura) antes do recorte
  const girada = (meta.orientation ?? 1) >= 5
  const larguraImg = girada ? meta.height : meta.width
  const alturaImg = girada ? meta.width : meta.height

  // 4. recorte em pixels, limitado à imagem
  const left = clamp(Math.round(recorte.x * larguraImg), 0, larguraImg - 1)
  const top = clamp(Math.round(recorte.y * alturaImg), 0, alturaImg - 1)
  const width = clamp(Math.round(recorte.largura * larguraImg), 1, larguraImg - left)
  const height = clamp(Math.round(recorte.altura * alturaImg), 1, alturaImg - top)

  if (Math.abs(width / height / PROPORCAO - 1) > TOLERANCIA) {
    throw new ProcessamentoError("RECORTE", "O recorte precisa ter a proporção 3:4 (em pé).")
  }

  if (Math.min(width, height) < LADO_MINIMO) {
    throw new ProcessamentoError("PEQUENA", "Foto pequena demais para o site. Use uma imagem maior.")
  }

  try {
    // 5. duas variantes; sem ampliar; sem withMetadata (EXIF/GPS caem por padrão)
    const variantes: { largura: Largura; larguraReal: number; altura: number; dados: Buffer }[] = []

    for (const largura of LARGURAS_SAIDA) {
      const { data, info } = await sharp(entrada, opcoes)
        .rotate()
        .extract({ left, top, width, height })
        .resize(largura, Math.round((largura * 4) / 3), { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer({ resolveWithObject: true })

      variantes.push({ largura, larguraReal: info.width, altura: info.height, dados: data })
    }

    // 6. cor dominante da variante 480
    const pequena = variantes.find((v) => v.largura === 480)!
    const { dominant } = await sharp(pequena.dados).stats()
    const hex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")
    const cor = `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`

    return { variantes, cor, bytes: variantes.reduce((soma, v) => soma + v.dados.length, 0) }
  } catch (erro) {
    if (erro instanceof ProcessamentoError) throw erro
    // arquivo corrompido no meio do fluxo (failOn: "error")
    throw new ProcessamentoError("FORMATO", MSG_FORMATO)
  }
}
