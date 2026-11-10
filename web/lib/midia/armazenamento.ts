import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, open, rename, rm } from "node:fs/promises"
import path from "node:path"

/**
 * Único módulo que toca o disco da biblioteca de fotos (contrato midia-vitrine/01 §3).
 * Trocar por R2/S3 no futuro mexe só aqui: o resto do código lida com id e URL.
 *
 * Layout: <MEDIA_DIR>/<id>/960.webp e 480.webp. Arquivo nunca é sobrescrito (foto nova = id novo),
 * por isso o cache pode ser de 1 ano. O nome vem sempre do id gerado pelo servidor, nunca do usuário.
 */

export const LARGURAS = [960, 480] as const
export type Largura = (typeof LARGURAS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Padrão em dev: <web>/public/media (o `next dev` roda com cwd = web). Produção: volume em /data/media. */
function mediaDir(): string {
  return process.env.MEDIA_DIR?.trim() || path.join(process.cwd(), "public", "media")
}

function mediaPublicBase(): string {
  const base = process.env.MEDIA_PUBLIC_BASE?.trim()
  if (base) return base.replace(/\/+$/, "")

  const app = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim().replace(/\/+$/, "")
  return `${app}/media`
}

/** Valida o id ANTES de montar qualquer caminho: nada de `..`, barra ou nome arbitrário chega ao disco. */
function idValido(id: string): string {
  if (!UUID.test(id)) throw new Error("id de mídia inválido")
  return id.toLowerCase()
}

export function urlsDaMidia(id: string): { url: string; urlPequena: string } {
  const seguro = idValido(id)
  const base = mediaPublicBase()

  return { url: `${base}/${seguro}/960.webp`, urlPequena: `${base}/${seguro}/480.webp` }
}

/**
 * Grava as variantes em <MEDIA_DIR>/<id>.tmp/, faz fsync de cada arquivo e renomeia o diretório para
 * <MEDIA_DIR>/<id>/ (atômico no mesmo volume): o nginx nunca enxerga arquivo pela metade.
 */
export async function gravarVariantes(
  id: string,
  variantes: { largura: Largura; dados: Buffer }[]
): Promise<void> {
  const seguro = idValido(id)
  const raiz = mediaDir()
  const tmp = path.join(raiz, `${seguro}.tmp`)
  const final = path.join(raiz, seguro)

  try {
    await mkdir(tmp, { recursive: true })

    for (const v of variantes) {
      if (!LARGURAS.includes(v.largura)) throw new Error("largura de variante inválida")

      const arquivo = await open(path.join(tmp, `${v.largura}.webp`), "wx")
      try {
        await arquivo.writeFile(v.dados)
        await arquivo.sync()
      } finally {
        await arquivo.close()
      }
    }

    await rename(tmp, final)
  } catch (erro) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
    throw erro
  }
}

/** Só o script de limpeza e o rollback do upload usam. */
export async function apagarDiretorio(id: string): Promise<void> {
  const seguro = idValido(id)
  const raiz = mediaDir()

  await rm(path.join(raiz, seguro), { recursive: true, force: true })
  await rm(path.join(raiz, `${seguro}.tmp`), { recursive: true, force: true })
}

/** Id da foto nova: sempre gerado pelo servidor. */
export function novoIdDeMidia(): string {
  return randomUUID()
}
