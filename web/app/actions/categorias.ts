'use server'

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { exigirGestorDaOrg } from "@/lib/painel-sessao"
import { DomainError } from "@/lib/domain/erros"
import { definirFotoCategoria, renomearCategoria, reordenarCategorias } from "@/lib/domain/categorias"

/** Server action é endpoint POST chamável direto: papel e org saem da sessão, nunca dos argumentos. */

async function executar(
  rotulo: string,
  mensagemFalha: string,
  fn: (db: ReturnType<typeof createAdminClient<Database>>, orgId: string) => Promise<void>
) {
  const sessao = await exigirGestorDaOrg()
  if ("error" in sessao) return { error: sessao.error }

  try {
    await fn(createAdminClient<Database>(), sessao.organizationId)
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error(`[${rotulo}]`, error)
    return { error: mensagemFalha }
  }

  revalidatePath("/servicos")
  return { success: true }
}

/** `mediaId` null tira a foto da categoria. */
export async function definirFotoDaCategoria(nome: string, mediaId: string | null) {
  return executar("definirFotoDaCategoria", "Não foi possível trocar a foto. Tente novamente.", (db, orgId) =>
    definirFotoCategoria(db, orgId, nome, mediaId)
  )
}

export async function reordenarCategoriasAction(chavesNaOrdem: string[]) {
  return executar("reordenarCategorias", "Não foi possível salvar a ordem. Tente novamente.", (db, orgId) =>
    reordenarCategorias(db, orgId, chavesNaOrdem)
  )
}

export async function renomearCategoriaAction(de: string, para: string) {
  return executar("renomearCategoria", "Não foi possível renomear a categoria. Tente novamente.", (db, orgId) =>
    renomearCategoria(db, orgId, de, para)
  )
}
