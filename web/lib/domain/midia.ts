import "server-only"

import { AltMidia, type MidiaPainel } from "@/contracts/painel/midia"
import { urlsDaMidia } from "@/lib/midia/armazenamento"
import type { Db } from "./db"
import { DomainError } from "./erros"

/**
 * Biblioteca de fotos da org (tabela `org_media`; os bytes ficam em disco, ver lib/midia/armazenamento.ts).
 * Todas recebem `db` (service role) e `orgId` da SESSÃO: nada aqui confia em org vinda de formulário.
 * Contrato: docs/contratos/midia-vitrine/01-armazenamento-e-upload.md §6.
 */

type LinhaMidia = {
  id: string
  alt: string
  cor: string
  largura: number
  altura: number
  created_at: string
}

const COLUNAS = "id, alt, cor, largura, altura, created_at"

function paraPainel(l: LinhaMidia, usos: number): MidiaPainel {
  return {
    id: l.id,
    ...urlsDaMidia(l.id),
    largura: l.largura,
    altura: l.altura,
    alt: l.alt,
    cor: l.cor,
    criadaEm: new Date(l.created_at).toISOString(),
    usos,
  }
}

function validarAlt(alt: string): string {
  const lido = AltMidia.safeParse(alt)

  if (!lido.success) throw new DomainError("VALIDATION_ERROR", lido.error.issues[0]?.message ?? "Descrição inválida.")

  return lido.data
}

/** Categorias + itens de vitrine (ativos ou não) que apontam para cada foto. */
async function contarUsos(db: Db, orgId: string, ids: string[]): Promise<Map<string, number>> {
  const usos = new Map<string, number>()
  if (ids.length === 0) return usos

  const [categorias, vitrine] = await Promise.all([
    db.from("service_categories").select("media_id").eq("organization_id", orgId).in("media_id", ids),
    db.from("vitrine_items").select("media_id").eq("organization_id", orgId).in("media_id", ids),
  ])

  if (categorias.error) {
    console.error("[domain:contarUsos:categorias]", categorias.error)
    throw categorias.error
  }

  if (vitrine.error) {
    console.error("[domain:contarUsos:vitrine]", vitrine.error)
    throw vitrine.error
  }

  for (const l of [...(categorias.data ?? []), ...(vitrine.data ?? [])]) {
    if (l.media_id) usos.set(l.media_id, (usos.get(l.media_id) ?? 0) + 1)
  }

  return usos
}

/** Fotos ativas, mais novas primeiro, com `usos`. */
export async function listarBiblioteca(db: Db, orgId: string): Promise<MidiaPainel[]> {
  const { data, error } = await db
    .from("org_media")
    .select(COLUNAS)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[domain:listarBiblioteca]", error)
    throw error
  }

  const linhas = data ?? []
  const usos = await contarUsos(db, orgId, linhas.map((l) => l.id))

  return linhas.map((l) => paraPainel(l, usos.get(l.id) ?? 0))
}

/** Quantas fotos ativas a org tem (a cota é conferida pela rota de upload). */
export async function contarFotosAtivas(db: Db, orgId: string): Promise<number> {
  const { count, error } = await db
    .from("org_media")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("deleted_at", null)

  if (error) {
    console.error("[domain:contarFotosAtivas]", error)
    throw error
  }

  return count ?? 0
}

/**
 * Registra a foto cujos arquivos já foram gravados em disco. O `id` é o mesmo do diretório
 * (gerado pelo servidor). Se o insert falhar, quem chamou apaga o diretório.
 */
export async function criarMidia(
  db: Db,
  orgId: string,
  userId: string,
  dados: { id: string; alt: string; cor: string; largura: number; altura: number; bytes: number }
): Promise<MidiaPainel> {
  const alt = validarAlt(dados.alt)

  const { data, error } = await db
    .from("org_media")
    .insert({
      id: dados.id,
      organization_id: orgId,
      alt,
      cor: dados.cor,
      largura: dados.largura,
      altura: dados.altura,
      bytes: dados.bytes,
      created_by: userId,
    })
    .select(COLUNAS)
    .single()

  if (error) {
    console.error("[domain:criarMidia]", error)
    throw error
  }

  return paraPainel(data, 0)
}

/** Foto de outra org, excluída ou inexistente é NOT_FOUND, sem diferenciar. */
export async function editarAlt(db: Db, orgId: string, id: string, alt: string): Promise<void> {
  const texto = validarAlt(alt)

  const { data, error } = await db
    .from("org_media")
    .update({ alt: texto })
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .select("id")

  if (error) {
    console.error("[domain:editarAlt]", error)
    throw error
  }

  if (!data || data.length === 0) throw new DomainError("NOT_FOUND", "Foto não encontrada.")
}

/**
 * Exclusão lógica (`deleted_at`); os arquivos saem do disco 30 dias depois, por scripts/limpar-midia.mjs.
 * Foto em uso é recusada: CONFLICT com `detalhes = { motivo: "EM_USO", usos }` para a tela explicar onde.
 */
export async function excluirMidia(db: Db, orgId: string, id: string): Promise<void> {
  const { data: linha, error } = await db
    .from("org_media")
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    console.error("[domain:excluirMidia:ler]", error)
    throw error
  }

  if (!linha) throw new DomainError("NOT_FOUND", "Foto não encontrada.")

  const usos = (await contarUsos(db, orgId, [id])).get(id) ?? 0

  if (usos > 0) {
    throw new DomainError(
      "CONFLICT",
      "Essa foto está em uso (categoria ou vitrine). Troque a foto lá antes de excluir.",
      { motivo: "EM_USO", usos }
    )
  }

  const { error: erroUpdate } = await db
    .from("org_media")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)

  if (erroUpdate) {
    console.error("[domain:excluirMidia]", erroUpdate)
    throw erroUpdate
  }
}
