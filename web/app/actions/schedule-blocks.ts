'use server'

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { organizacaoDaSessao } from "@/lib/painel-sessao"
import { criarBloqueios, removerBloqueio } from "@/lib/domain/bloqueios"
import { DomainError } from "@/lib/domain/erros"
import { horaLocalParaUtc, limitesDoDiaUtc } from "@/lib/domain/tempo"

const DATA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)

  return typeof valor === "string" ? valor.trim() : ""
}

/**
 * Fecha a agenda de um profissional (ou de todos) num intervalo. Server action
 * é endpoint POST chamável direto e o miolo roda com service role: a org sai
 * da sessão, nunca do FormData.
 */
export async function fecharHorario(formData: FormData) {
  const sessao = await organizacaoDaSessao()
  if ("error" in sessao) return { error: sessao.error }

  const profissional = texto(formData, "professional_id")
  const data = texto(formData, "date")
  const dataFim = texto(formData, "end_date") || data
  const diaInteiro = formData.get("all_day") === "on"

  if (!profissional) return { error: "Escolha o profissional." }
  if (!DATA.test(data) || !DATA.test(dataFim)) return { error: "Informe a data." }

  try {
    let inicio: Date
    let fim: Date

    if (diaInteiro) {
      inicio = limitesDoDiaUtc(data).inicio
      fim = limitesDoDiaUtc(dataFim).fim
    } else {
      const horaInicio = texto(formData, "start")
      const horaFim = texto(formData, "end")
      if (!HORA.test(horaInicio) || !HORA.test(horaFim)) return { error: "Informe o horário de início e de fim." }

      inicio = horaLocalParaUtc(`${data}T${horaInicio}`, "start")
      fim = horaLocalParaUtc(`${dataFim}T${horaFim}`, "end")
    }

    if (fim <= new Date()) return { error: "Esse período já passou." }

    await criarBloqueios(createAdminClient<Database>(), {
      orgId: sessao.organizationId,
      profissionais: profissional === "todos" ? "todos" : [profissional],
      inicio,
      fim,
      motivo: texto(formData, "reason") || null,
      criadoPor: sessao.userId,
    })
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error("[fecharHorario]", error)
    return { error: "Não foi possível fechar o horário. Tente novamente." }
  }

  revalidatePath("/agendamentos")
  return { success: true }
}

/** Reabre o horário. */
export async function reabrirHorario(id: string) {
  const sessao = await organizacaoDaSessao()
  if ("error" in sessao) return { error: sessao.error }

  try {
    await removerBloqueio(createAdminClient<Database>(), { orgId: sessao.organizationId, id })
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }
    console.error("[reabrirHorario]", error)
    return { error: "Não foi possível reabrir o horário. Tente novamente." }
  }

  revalidatePath("/agendamentos")
  return { success: true }
}
