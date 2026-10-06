import "server-only"

import type { Db } from "./db"
import { DomainError } from "./erros"

export type Servico = {
  id: string
  titulo: string
  descricao: string | null
  duracaoMinutos: number
  preco: number | null
}

export type Profissional = {
  id: string
  nome: string
  especialidade: string | null
}

// Colunas explícitas, nunca `*`: o profissional tem `phone`, `license_number`
// e `user_id`, que não podem chegar à página pública nem à API.
const COLUNAS_SERVICO = "id, title, description, duration_minutes, price"
const COLUNAS_PROFISSIONAL = "id, name, specialty"

type LinhaServico = {
  id: string
  title: string
  description: string | null
  duration_minutes: number | null
  price: number | null
}

type LinhaProfissional = { id: string; name: string; specialty: string | null }

function paraServico(linha: LinhaServico): Servico {
  return {
    id: linha.id,
    titulo: linha.title,
    descricao: linha.description,
    // 30 é o fallback que todos os caminhos de agendamento já usavam.
    duracaoMinutos: linha.duration_minutes || 30,
    preco: linha.price,
  }
}

function paraProfissional(linha: LinhaProfissional): Profissional {
  return { id: linha.id, nome: linha.name, especialidade: linha.specialty }
}

export async function listarServicosAtivos(db: Db, orgId: string): Promise<Servico[]> {
  const { data, error } = await db
    .from("services")
    .select(COLUNAS_SERVICO)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("title")

  if (error) {
    console.error("[domain:listarServicosAtivos]", error)
    throw error
  }

  return (data ?? []).map(paraServico)
}

export async function listarProfissionaisAtivos(db: Db, orgId: string): Promise<Profissional[]> {
  const { data, error } = await db
    .from("professionals")
    .select(COLUNAS_PROFISSIONAL)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("[domain:listarProfissionaisAtivos]", error)
    throw error
  }

  return (data ?? []).map(paraProfissional)
}

/** Serviço ativo da org; inexistente, inativo ou de outro tenant é NOT_FOUND. */
export async function exigirServicoAtivo(db: Db, orgId: string, id: string): Promise<Servico> {
  const { data, error } = await db
    .from("services")
    .select(COLUNAS_SERVICO)
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    console.error("[domain:exigirServicoAtivo]", error)
    throw error
  }

  if (!data) throw new DomainError("NOT_FOUND", "Serviço não encontrado.")

  return paraServico(data)
}

/** Profissional ativo da org; inexistente, inativo ou de outro tenant é NOT_FOUND. */
export async function exigirProfissionalAtivo(db: Db, orgId: string, id: string): Promise<Profissional> {
  const { data, error } = await db
    .from("professionals")
    .select(COLUNAS_PROFISSIONAL)
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle()

  if (error) {
    console.error("[domain:exigirProfissionalAtivo]", error)
    throw error
  }

  if (!data) throw new DomainError("NOT_FOUND", "Profissional não encontrado.")

  return paraProfissional(data)
}
