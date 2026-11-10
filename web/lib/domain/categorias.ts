import "server-only"

import type { MidiaPainel } from "@/contracts/painel/midia"
import type { Db } from "./db"
import { DomainError } from "./erros"
import type { FotoPublica } from "@/contracts/publico/catalogo"
import { fotoPublicaDeLinha, midiasAtivasPorId } from "./midia"

/**
 * Foto e ordem por categoria de serviço (tabela `service_categories`, contrato midia-vitrine/02).
 * `services.category` continua sendo a fonte de quais categorias existem; a tabela guarda só foto e ordem,
 * ligada pela chave `lower(btrim(nome))`. Todas recebem `db` (service role) e `orgId` da sessão.
 */

export type CategoriaPainel = {
  /** Nome exibido: o da linha da tabela se existir; senão o primeiro `services.category` por título. */
  nome: string
  chave: string
  /** Serviços ativos com essa categoria. */
  servicos: number
  /** null = sem linha na tabela. */
  ordem: number | null
  foto: MidiaPainel | null
}

export const chaveDaCategoria = (nome: string) => nome.trim().toLowerCase()

export const comparaNomes = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })

type LinhaCategoria = { nome: string; chave: string | null; ordem: number; media_id: string | null }

/** Categorias que existem nos serviços ativos: chave -> { nome do primeiro por título, quantos }. */
async function categoriasDosServicos(db: Db, orgId: string) {
  const { data, error } = await db
    .from("services")
    .select("category")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .not("category", "is", null)
    .order("title")

  if (error) {
    console.error("[domain:categoriasDosServicos]", error)
    throw error
  }

  const mapa = new Map<string, { nome: string; servicos: number }>()

  for (const l of data ?? []) {
    const nome = l.category?.trim()
    if (!nome) continue

    const chave = chaveDaCategoria(nome)
    const atual = mapa.get(chave)

    if (atual) atual.servicos += 1
    else mapa.set(chave, { nome, servicos: 1 })
  }

  return mapa
}

async function linhasDaOrg(db: Db, orgId: string): Promise<Map<string, LinhaCategoria>> {
  const { data, error } = await db
    .from("service_categories")
    .select("nome, chave, ordem, media_id")
    .eq("organization_id", orgId)

  if (error) {
    console.error("[domain:linhasDaOrg]", error)
    throw error
  }

  const mapa = new Map<string, LinhaCategoria>()
  for (const l of data ?? []) if (l.chave) mapa.set(l.chave, l)

  return mapa
}

/** Ordem final (§5): com linha por `ordem` e nome; depois as sem linha por nome. */
export function ordenarCategorias<T extends { nome: string; ordem: number | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.ordem !== null && b.ordem === null) return -1
    if (a.ordem === null && b.ordem !== null) return 1
    if (a.ordem !== null && b.ordem !== null && a.ordem !== b.ordem) return a.ordem - b.ordem

    return comparaNomes(a.nome, b.nome)
  })
}

export async function listarCategorias(db: Db, orgId: string): Promise<CategoriaPainel[]> {
  const [dosServicos, linhas] = await Promise.all([categoriasDosServicos(db, orgId), linhasDaOrg(db, orgId)])

  const fotos = await midiasAtivasPorId(
    db,
    orgId,
    [...dosServicos.keys()].map((c) => linhas.get(c)?.media_id).filter((id): id is string => !!id)
  )

  const lista: CategoriaPainel[] = [...dosServicos.entries()].map(([chave, s]) => {
    const linha = linhas.get(chave)

    return {
      nome: linha?.nome ?? s.nome,
      chave,
      servicos: s.servicos,
      ordem: linha ? linha.ordem : null,
      foto: linha?.media_id ? (fotos.get(linha.media_id) ?? null) : null,
    }
  })

  return ordenarCategorias(lista)
}

function validarNome(nome: string): string {
  const limpo = nome?.trim() ?? ""

  if (limpo.length < 1 || limpo.length > 40) {
    throw new DomainError("VALIDATION_ERROR", "O nome da categoria precisa ter de 1 a 40 caracteres.")
  }

  return limpo
}

/**
 * Foto da categoria; `null` tira. A mídia tem de ser da org e ativa, senão NOT_FOUND. Categoria que nenhum
 * serviço ativo usa também é NOT_FOUND. Se ainda não há linha, ela nasce já na posição que a categoria
 * ocupa hoje (as demais sem linha também ganham ordem), para pôr foto não mudar a ordem na tela.
 */
export async function definirFotoCategoria(db: Db, orgId: string, nome: string, mediaId: string | null): Promise<void> {
  const chave = chaveDaCategoria(validarNome(nome))

  if (mediaId !== null && !(await midiasAtivasPorId(db, orgId, [mediaId])).has(mediaId)) {
    throw new DomainError("NOT_FOUND", "Foto não encontrada.")
  }

  const atuais = await listarCategorias(db, orgId)
  const alvo = atuais.find((c) => c.chave === chave)

  if (!alvo) throw new DomainError("NOT_FOUND", "Categoria não encontrada.")

  const agora = new Date().toISOString()

  if (alvo.ordem !== null) {
    const { error } = await db
      .from("service_categories")
      .update({ media_id: mediaId, updated_at: agora })
      .eq("organization_id", orgId)
      .eq("chave", chave)

    if (error) {
      console.error("[domain:definirFotoCategoria]", error)
      throw error
    }

    return
  }

  // Sem linha: materializa as que ainda não têm, depois da última com ordem, na ordem em que aparecem.
  let proxima = Math.max(-10, ...atuais.filter((c) => c.ordem !== null).map((c) => c.ordem as number)) + 10
  const novas = atuais
    .filter((c) => c.ordem === null)
    .map((c) => {
      const ordem = Math.min(999, proxima)
      proxima += 10

      return {
        organization_id: orgId,
        nome: c.nome,
        ordem,
        media_id: c.chave === chave ? mediaId : null,
        updated_at: agora,
      }
    })

  const { error } = await db.from("service_categories").insert(novas)

  if (error) {
    console.error("[domain:definirFotoCategoria:insert]", error)
    throw error
  }
}

/**
 * Recebe a lista inteira de chaves exibidas e grava `ordem = índice * 10`. Chave que nenhum serviço ativo
 * usa é VALIDATION_ERROR.
 */
export async function reordenarCategorias(db: Db, orgId: string, chavesNaOrdem: string[]): Promise<void> {
  const [dosServicos, linhas] = await Promise.all([categoriasDosServicos(db, orgId), linhasDaOrg(db, orgId)])
  const chaves = [...new Set(chavesNaOrdem.map(chaveDaCategoria))]

  if (chaves.length === 0) return

  if (chaves.length > 100 || !chaves.every((c) => dosServicos.has(c))) {
    throw new DomainError("VALIDATION_ERROR", "Há categoria que não existe mais nos serviços. Atualize a tela.")
  }

  const agora = new Date().toISOString()
  const linhasNovas = chaves.map((chave, i) => ({
    organization_id: orgId,
    nome: linhas.get(chave)?.nome ?? dosServicos.get(chave)!.nome,
    ordem: Math.min(999, i * 10),
    media_id: linhas.get(chave)?.media_id ?? null,
    updated_at: agora,
  }))

  const { error } = await db.from("service_categories").upsert(linhasNovas, { onConflict: "organization_id,chave" })

  if (error) {
    console.error("[domain:reordenarCategorias]", error)
    throw error
  }
}

/** Renomeia em todos os serviços e leva a foto junto (função `renomear_categoria`, numa transação). */
export async function renomearCategoria(db: Db, orgId: string, de: string, para: string): Promise<void> {
  const nomeDe = validarNome(de)
  const nomePara = validarNome(para)

  if (!(await categoriasDosServicos(db, orgId)).has(chaveDaCategoria(nomeDe))) {
    throw new DomainError("NOT_FOUND", "Categoria não encontrada.")
  }

  const { error } = await db.rpc("renomear_categoria", { p_org: orgId, p_de: nomeDe, p_para: nomePara })

  if (error) {
    if (error.code === "22023") throw new DomainError("VALIDATION_ERROR", "Nome de categoria inválido.")
    console.error("[domain:renomearCategoria]", error)
    throw error
  }
}

/**
 * Categorias do catálogo público, na ordem final (§5). Recebe os serviços JÁ listados pela rota (não consulta
 * `services` de novo). Mídia excluída sai como `foto: null`.
 */
export async function categoriasPublicas(
  db: Db,
  orgId: string,
  servicos: { categoria: string | null }[]
): Promise<{ nome: string; foto: FotoPublica | null }[]> {
  return montarCategoriasPublicas(await lerLinhasCategoriasPublicas(db, orgId), servicos)
}

/**
 * Só a leitura, para a rota pública rodar em paralelo com a listagem de serviços (uma ida ao banco a menos
 * em série). A foto vem embutida (FK composta service_categories_media_fk), já escopada pela org da linha.
 */
export async function lerLinhasCategoriasPublicas(db: Db, orgId: string) {
  const { data, error } = await db
    .from("service_categories")
    .select(
      "nome, chave, ordem, org_media!service_categories_media_fk(id, alt, cor, largura, altura, deleted_at)"
    )
    .eq("organization_id", orgId)

  if (error) {
    console.error("[domain:categoriasPublicas]", error)
    throw error
  }

  return data ?? []
}

export type LinhasCategoriasPublicas = Awaited<ReturnType<typeof lerLinhasCategoriasPublicas>>

/** Parte pura: cruza as linhas com os serviços já listados e aplica a ordem final (§5). */
export function montarCategoriasPublicas(
  dados: LinhasCategoriasPublicas,
  servicos: { categoria: string | null }[]
): { nome: string; foto: FotoPublica | null }[] {
  const dosServicos = new Map<string, string>()

  for (const s of servicos) {
    const nome = s.categoria?.trim()
    if (nome && !dosServicos.has(chaveDaCategoria(nome))) dosServicos.set(chaveDaCategoria(nome), nome)
  }

  if (dosServicos.size === 0) return []

  const linhas = new Map(dados.filter((l) => l.chave).map((l) => [l.chave as string, l]))

  const lista = [...dosServicos.entries()].map(([chave, nomeDoServico]) => {
    const linha = linhas.get(chave)

    return {
      nome: linha?.nome ?? nomeDoServico,
      ordem: linha ? linha.ordem : null,
      foto: fotoPublicaDeLinha(linha?.org_media ?? null),
    }
  })

  return ordenarCategorias(lista).map(({ nome, foto }) => ({ nome, foto }))
}
