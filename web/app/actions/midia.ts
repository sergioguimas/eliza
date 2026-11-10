'use server'

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { exigirGestorDaOrg } from "@/lib/painel-sessao"
import { DomainError } from "@/lib/domain/erros"
import { editarAlt, excluirMidia as excluirMidiaNoDominio, listarBiblioteca } from "@/lib/domain/midia"

/** Server action é endpoint POST chamável direto: papel e org saem da sessão, nunca dos argumentos. */

function revalidar() {
  revalidatePath("/servicos")
  revalidatePath("/vitrine")
}

export async function editarAltMidia(id: string, alt: string) {
  const sessao = await exigirGestorDaOrg()
  if ("error" in sessao) return { error: sessao.error }

  try {
    await editarAlt(createAdminClient<Database>(), sessao.organizationId, id, alt)
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error("[editarAltMidia]", error)
    return { error: "Não foi possível salvar a descrição. Tente novamente." }
  }

  revalidar()
  return { success: true }
}

export async function excluirMidia(id: string) {
  const sessao = await exigirGestorDaOrg()
  if ("error" in sessao) return { error: sessao.error }

  try {
    await excluirMidiaNoDominio(createAdminClient<Database>(), sessao.organizationId, id)
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error("[excluirMidia]", error)
    return { error: "Não foi possível excluir a foto. Tente novamente." }
  }

  revalidar()
  return { success: true }
}

/** Biblioteca da org para o seletor de fotos (lida ao abrir o seletor, para a lista e `usos` virem frescos). */
export async function listarBibliotecaAction() {
  const sessao = await exigirGestorDaOrg()
  if ("error" in sessao) return { error: sessao.error }

  try {
    const fotos = await listarBiblioteca(createAdminClient<Database>(), sessao.organizationId)
    return { success: true as const, fotos }
  } catch (error) {
    console.error("[listarBibliotecaAction]", error)
    return { error: "Não foi possível carregar as fotos. Tente novamente." }
  }
}
