'use server'

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { exigirGestorDaOrg } from "@/lib/painel-sessao"
import { DomainError } from "@/lib/domain/erros"
import { adicionarItem, editarItem, removerItem, reordenarVitrine } from "@/lib/domain/vitrine"

/** Server action é endpoint POST chamável direto: papel e org saem da sessão, nunca dos argumentos. */

async function executar<T>(
  rotulo: string,
  mensagemFalha: string,
  fn: (db: ReturnType<typeof createAdminClient<Database>>, orgId: string) => Promise<T>
) {
  const sessao = await exigirGestorDaOrg()
  if ("error" in sessao) return { error: sessao.error }

  let resultado: T

  try {
    resultado = await fn(createAdminClient<Database>(), sessao.organizationId)
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error(`[${rotulo}]`, error)
    return { error: mensagemFalha }
  }

  revalidatePath("/vitrine")
  return { success: true as const, resultado }
}

export async function adicionarItemVitrine(dados: { mediaId: string; legenda: string; categoria?: string | null }) {
  return executar("adicionarItemVitrine", "Não foi possível adicionar a foto. Tente novamente.", (db, orgId) =>
    adicionarItem(db, orgId, dados)
  )
}

export async function editarItemVitrine(id: string, campos: { legenda?: string; categoria?: string | null; ativo?: boolean }) {
  return executar("editarItemVitrine", "Não foi possível salvar. Tente novamente.", (db, orgId) =>
    editarItem(db, orgId, id, campos)
  )
}

export async function reordenarVitrineAction(idsNaOrdem: string[]) {
  return executar("reordenarVitrine", "Não foi possível salvar a ordem. Tente novamente.", (db, orgId) =>
    reordenarVitrine(db, orgId, idsNaOrdem)
  )
}

export async function removerItemVitrine(id: string) {
  return executar("removerItemVitrine", "Não foi possível remover o item. Tente novamente.", (db, orgId) =>
    removerItem(db, orgId, id)
  )
}
