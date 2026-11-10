import "server-only"

import type { MidiaPainel } from "@/contracts/painel/midia"
import type { Db } from "./db"
import { DomainError } from "./erros"
import { midiasAtivasPorId } from "./midia"

/**
 * Vitrine: destaques ordenados, cada um com uma foto da biblioteca, legenda e (opcional) categoria
 * (tabela `vitrine_items`, contrato midia-vitrine/03). Todas recebem `db` (service role) e `orgId` da sessão.
 */

export const LIMITE_ITENS_ATIVOS = 24
export const LIMITE_ITENS_TOTAL = 60

export type ItemVitrinePainel = {
  id: string
  legenda: string
  categoria: string | null
  ordem: number
  ativo: boolean
  foto: MidiaPainel
}

const COLUNAS = "id, media_id, legenda, categoria, ordem, ativo, created_at"

type LinhaItem = {
  id: string
  media_id: string
  legenda: string
  categoria: string | null
  ordem: number
  ativo: boolean
  created_at: string
}

function legendaValida(texto: string): string {
  const limpa = texto?.trim() ?? ""

  if (limpa.length < 1 || limpa.length > 60) {
    throw new DomainError("VALIDATION_ERROR", "A legenda precisa ter de 1 a 60 caracteres.")
  }

  return limpa
}

function categoriaValida(texto: string | null | undefined): string | null {
  const limpa = texto?.trim() ?? ""
  if (!limpa) return null

  if (limpa.length > 40) throw new DomainError("VALIDATION_ERROR", "A categoria pode ter até 40 caracteres.")

  return limpa
}

const limiteAtingido = () =>
  new DomainError("CONFLICT", `A vitrine já tem ${LIMITE_ITENS_ATIVOS} fotos. Desative ou remova uma.`, {
    motivo: "LIMITE_VITRINE",
  })

/** `ordem` crescente, depois `created_at`. */
function ordenar(linhas: LinhaItem[]): LinhaItem[] {
  return [...linhas].sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at))
}

async function lerItens(db: Db, orgId: string): Promise<LinhaItem[]> {
  const { data, error } = await db.from("vitrine_items").select(COLUNAS).eq("organization_id", orgId)

  if (error) {
    console.error("[domain:vitrine:lerItens]", error)
    throw error
  }

  return ordenar(data ?? [])
}

function paraPainel(l: LinhaItem, foto: MidiaPainel): ItemVitrinePainel {
  return { id: l.id, legenda: l.legenda, categoria: l.categoria, ordem: l.ordem, ativo: l.ativo, foto }
}

/** Todos (ativos e inativos), na ordem. Item cuja foto saiu da biblioteca (corrida rara) não aparece. */
export async function listarVitrine(db: Db, orgId: string): Promise<ItemVitrinePainel[]> {
  const itens = await lerItens(db, orgId)
  const fotos = await midiasAtivasPorId(db, orgId, itens.map((i) => i.media_id))

  return itens.flatMap((i) => {
    const foto = fotos.get(i.media_id)
    return foto ? [paraPainel(i, foto)] : []
  })
}

/** Entra no fim, ativo. Foto de outra org ou excluída é NOT_FOUND. */
export async function adicionarItem(
  db: Db,
  orgId: string,
  dados: { mediaId: string; legenda: string; categoria?: string | null }
): Promise<ItemVitrinePainel> {
  const legenda = legendaValida(dados.legenda)
  const categoria = categoriaValida(dados.categoria)

  const foto = (await midiasAtivasPorId(db, orgId, [dados.mediaId])).get(dados.mediaId)
  if (!foto) throw new DomainError("NOT_FOUND", "Foto não encontrada.")

  const itens = await lerItens(db, orgId)

  if (itens.length >= LIMITE_ITENS_TOTAL) {
    throw new DomainError("CONFLICT", `A vitrine chegou a ${LIMITE_ITENS_TOTAL} itens. Remova os que não usa mais.`, {
      motivo: "LIMITE_VITRINE",
    })
  }

  if (itens.filter((i) => i.ativo).length >= LIMITE_ITENS_ATIVOS) throw limiteAtingido()

  const ordem = Math.min(9999, itens.length > 0 ? Math.max(...itens.map((i) => i.ordem)) + 10 : 0)

  const { data, error } = await db
    .from("vitrine_items")
    .insert({ organization_id: orgId, media_id: dados.mediaId, legenda, categoria, ordem, ativo: true })
    .select(COLUNAS)
    .single()

  if (error) {
    console.error("[domain:adicionarItem]", error)
    throw error
  }

  return paraPainel(data, foto)
}

export async function editarItem(
  db: Db,
  orgId: string,
  id: string,
  campos: { legenda?: string; categoria?: string | null; ativo?: boolean }
): Promise<void> {
  const itens = await lerItens(db, orgId)
  const atual = itens.find((i) => i.id === id)

  if (!atual) throw new DomainError("NOT_FOUND", "Item da vitrine não encontrado.")

  const mudanca: { legenda?: string; categoria?: string | null; ativo?: boolean } = {}

  if (campos.legenda !== undefined) mudanca.legenda = legendaValida(campos.legenda)
  if (campos.categoria !== undefined) mudanca.categoria = categoriaValida(campos.categoria)

  if (campos.ativo !== undefined) {
    if (campos.ativo && !atual.ativo && itens.filter((i) => i.ativo).length >= LIMITE_ITENS_ATIVOS) {
      throw limiteAtingido()
    }
    mudanca.ativo = campos.ativo
  }

  if (Object.keys(mudanca).length === 0) return

  const { error } = await db.from("vitrine_items").update(mudanca).eq("id", id).eq("organization_id", orgId)

  if (error) {
    console.error("[domain:editarItem]", error)
    throw error
  }
}

/** Recebe a lista inteira de ids e grava `ordem = índice * 10`. Id que não é da org é NOT_FOUND. */
export async function reordenarVitrine(db: Db, orgId: string, idsNaOrdem: string[]): Promise<void> {
  const ids = [...new Set(idsNaOrdem)]
  const itens = await lerItens(db, orgId)
  const existentes = new Set(itens.map((i) => i.id))

  if (!ids.every((id) => existentes.has(id))) throw new DomainError("NOT_FOUND", "Item da vitrine não encontrado.")

  const resultados = await Promise.all(
    ids.map((id, i) =>
      db.from("vitrine_items").update({ ordem: Math.min(9999, i * 10) }).eq("id", id).eq("organization_id", orgId)
    )
  )

  const falha = resultados.find((r) => r.error)

  if (falha?.error) {
    console.error("[domain:reordenarVitrine]", falha.error)
    throw falha.error
  }
}

/** Apaga a linha; a foto continua na biblioteca. */
export async function removerItem(db: Db, orgId: string, id: string): Promise<void> {
  const { data, error } = await db
    .from("vitrine_items")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  if (error) {
    console.error("[domain:removerItem]", error)
    throw error
  }

  if (!data || data.length === 0) throw new DomainError("NOT_FOUND", "Item da vitrine não encontrado.")
}
