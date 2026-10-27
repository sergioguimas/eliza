import "server-only"

import { listarProfissionaisAtivos } from "./catalogo"
import type { Db } from "./db"
import { DomainError } from "./erros"
import { ATIVOS } from "./status"
import { type Momento, momento, utcParaHoraLocal } from "./tempo"

/**
 * Horário fechado: o profissional não atende neste intervalo. Ocupa a agenda
 * como um agendamento ativo (entra em `carregarDiaDeAgenda`, então vale em
 * /marcar, API v1 e Autoatendimento), mas não é atendimento: não tem cliente,
 * preço, lembrete nem entra em financeiro. Tabela `schedule_blocks`.
 *
 * Regras: não se fecha por cima de agendamento ativo (cancele ou remarque
 * antes) e "todos os profissionais" é tudo-ou-nada.
 */

export type Bloqueio = {
  id: string
  profissionalId: string
  inicio: Momento
  fim: Momento
  motivo: string | null
}

const MAX_DIAS = 31
const MAX_MOTIVO = 200

type EntradaBloqueio = {
  orgId: string
  /** Ids de profissionais ativos da org, ou "todos". */
  profissionais: string[] | "todos"
  inicio: Date
  fim: Date
  motivo?: string | null
  /** profiles.id de quem fechou; só auditoria. */
  criadoPor?: string | null
}

function rotuloDoInstante(instante: string): string {
  const [data, hora] = utcParaHoraLocal(instante).split("T")
  const [, mes, dia] = data.split("-")

  return `${dia}/${mes} às ${hora}`
}

export async function criarBloqueios(db: Db, p: EntradaBloqueio): Promise<Bloqueio[]> {
  if (Number.isNaN(p.inicio.getTime()) || Number.isNaN(p.fim.getTime())) {
    throw new DomainError("VALIDATION_ERROR", "Data ou hora inválida.")
  }

  if (p.fim <= p.inicio) {
    throw new DomainError("VALIDATION_ERROR", "O fim precisa ser depois do início.")
  }

  if (p.fim.getTime() - p.inicio.getTime() > MAX_DIAS * 24 * 60 * 60 * 1000) {
    throw new DomainError("VALIDATION_ERROR", `O período fechado não pode passar de ${MAX_DIAS} dias.`)
  }

  const motivo = p.motivo?.trim() || null

  if (motivo && motivo.length > MAX_MOTIVO) {
    throw new DomainError("VALIDATION_ERROR", `O motivo pode ter até ${MAX_MOTIVO} caracteres.`)
  }

  // Profissional de outra org ou inativo é NOT_FOUND: o domínio roda em service role.
  const ativos = await listarProfissionaisAtivos(db, p.orgId)
  const ids = p.profissionais === "todos" ? ativos.map((a) => a.id) : [...new Set(p.profissionais)]

  if (ids.length === 0) {
    throw new DomainError("VALIDATION_ERROR", "Nenhum profissional ativo para fechar o horário.")
  }

  if (!ids.every((id) => ativos.some((a) => a.id === id))) {
    throw new DomainError("NOT_FOUND", "Profissional não encontrado.")
  }

  // Tudo-ou-nada: um agendamento ativo de qualquer profissional barra o pedido inteiro.
  const { data: conflitos, error: erroConflitos } = await db
    .from("appointments")
    .select("id, start_time, professional_id, customers(name)")
    .eq("organization_id", p.orgId)
    .in("professional_id", ids)
    .in("status", ATIVOS)
    .lt("start_time", p.fim.toISOString())
    .gt("end_time", p.inicio.toISOString())
    .order("start_time")

  if (erroConflitos) {
    console.error("[domain:criarBloqueios:conflitos]", erroConflitos)
    throw erroConflitos
  }

  if (conflitos && conflitos.length > 0) {
    const citados = conflitos
      .slice(0, 3)
      .map((c) => `${c.customers?.name ?? "agendamento"} (${rotuloDoInstante(c.start_time)})`)
      .join(", ")
    const resto = conflitos.length > 3 ? ` e mais ${conflitos.length - 3}` : ""

    throw new DomainError(
      "SLOT_UNAVAILABLE",
      `Há agendamento nesse período: ${citados}${resto}. Cancele ou remarque antes de fechar o horário.`,
      { motivo: "ocupado", agendamentos: conflitos.map((c) => c.id) }
    )
  }

  const { data, error } = await db
    .from("schedule_blocks")
    .insert(
      ids.map((professional_id) => ({
        organization_id: p.orgId,
        professional_id,
        start_time: p.inicio.toISOString(),
        end_time: p.fim.toISOString(),
        reason: motivo,
        created_by: p.criadoPor ?? null,
      }))
    )
    .select("id, professional_id, start_time, end_time, reason")

  if (error) {
    console.error("[domain:criarBloqueios]", error)
    throw error
  }

  return (data ?? []).map((b) => ({
    id: b.id,
    profissionalId: b.professional_id,
    inicio: momento(b.start_time),
    fim: momento(b.end_time),
    motivo: b.reason,
  }))
}

/** Reabre o horário. Inexistente ou de outro tenant é NOT_FOUND (nunca diferenciar). */
export async function removerBloqueio(db: Db, p: { orgId: string; id: string }): Promise<void> {
  const { data, error } = await db
    .from("schedule_blocks")
    .delete()
    .eq("id", p.id)
    .eq("organization_id", p.orgId)
    .select("id")

  if (error) {
    console.error("[domain:removerBloqueio]", error)
    throw error
  }

  if (!data || data.length === 0) throw new DomainError("NOT_FOUND", "Horário fechado não encontrado.")
}
