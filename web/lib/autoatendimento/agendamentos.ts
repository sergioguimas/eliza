import "server-only"

import type { z } from "zod"
import type { AgendamentoResumo } from "@/contracts/autoatendimento"
import type { AgendamentoCompleto } from "@/lib/domain/agendamentos"
import type { Db } from "@/lib/domain/db"
import { EDITAVEIS, ehStatus } from "@/lib/domain/status"
import { momento } from "@/lib/domain/tempo"
import { ApiError } from "@/lib/http/erros"
import type { ConfigAutoatendimento } from "./config"

type Resumo = z.infer<typeof AgendamentoResumo>

/**
 * Agendamento do cliente no formato `AgendamentoResumo` (04), mais o que só o
 * contexto precisa (`lembreteEnviado`, para `aguardandoConfirmacao`).
 */
export type AgendamentoDoCliente = { resumo: Resumo; lembreteEnviado: boolean }

type Linha = {
  id: string
  status: string | null
  start_time: string
  end_time: string
  reminder_sent_at: string | null
  services: { id: string; title: string } | null
  professionals: { id: string; name: string } | null
}

/**
 * Flags calculados pelo Eliza com a política da org; o atendente não recalcula (04):
 *   antecedenciaOk  = inicio - agora >= antecedenciaMinimaMinutos
 *   podeCancelar    = status editável e antecedenciaOk
 *   podeRemarcar    = podeCancelar
 *   podeConfirmar   = status = scheduled e inicio > agora
 * `pending` é "aguardando aprovação do estabelecimento": não se confirma.
 */
export function paraResumo(linha: Linha, config: ConfigAutoatendimento, agora: Date): AgendamentoDoCliente {
  const status = ehStatus(linha.status) ? linha.status : "pending"
  const inicio = new Date(linha.start_time)
  const antecedenciaOk = inicio.getTime() - agora.getTime() >= config.antecedenciaMinimaMinutos * 60000
  const podeCancelar = EDITAVEIS.includes(status) && antecedenciaOk

  return {
    lembreteEnviado: linha.reminder_sent_at !== null,
    resumo: {
      id: linha.id,
      status,
      inicio: momento(inicio),
      fim: momento(linha.end_time),
      servico: linha.services ? { id: linha.services.id, nome: linha.services.title } : null,
      profissional: linha.professionals ? { id: linha.professionals.id, nome: linha.professionals.name } : null,
      podeCancelar,
      podeRemarcar: podeCancelar,
      podeConfirmar: status === "scheduled" && inicio > agora,
    },
  }
}

/**
 * Futuros e ativos (pending/scheduled/confirmed) do cliente, em ordem crescente.
 * Filtra por org E cliente: o resultado nunca inclui agendamento de outro cliente.
 */
export async function listarAgendamentosDoCliente(
  db: Db,
  p: { orgId: string; clienteId: string; config: ConfigAutoatendimento; limite: number }
): Promise<AgendamentoDoCliente[]> {
  const agora = new Date()

  const { data, error } = await db
    .from("appointments")
    .select("id, status, start_time, end_time, reminder_sent_at, services ( id, title ), professionals ( id, name )")
    .eq("organization_id", p.orgId)
    .eq("customer_id", p.clienteId)
    .in("status", EDITAVEIS)
    .gte("start_time", agora.toISOString())
    .order("start_time", { ascending: true })
    .limit(p.limite)

  if (error) {
    console.error("[autoatendimento:agendamentos]", error)
    throw error
  }

  return (data ?? []).map((linha) => paraResumo(linha as unknown as Linha, p.config, agora))
}

const SELECT_RESUMO = "id, status, start_time, end_time, reminder_sent_at, services ( id, title ), professionals ( id, name )"

/**
 * Posse (04): id E org do ticket E cliente identificado. Qualquer outra coisa,
 * inclusive agendamento que existe mas é de outro cliente, é NOT_FOUND: a API
 * não confirma que o registro existe.
 */
export async function carregarDoCliente(
  db: Db,
  p: { orgId: string; clienteId: string; id: string; config: ConfigAutoatendimento }
): Promise<AgendamentoDoCliente> {
  const { data, error } = await db
    .from("appointments")
    .select(SELECT_RESUMO)
    .eq("id", p.id)
    .eq("organization_id", p.orgId)
    .eq("customer_id", p.clienteId)
    .maybeSingle()

  // 22P02: id que não é UUID. Para quem chama é o mesmo que não existir.
  if (error && error.code !== "22P02") {
    console.error("[autoatendimento:agendamentos]", error)
    throw error
  }

  if (!data) throw new ApiError("NOT_FOUND", "Agendamento não encontrado.")

  return paraResumo(data as unknown as Linha, p.config, new Date())
}

/** `AgendamentoCompleto` do domínio (resposta de criar/remarcar/cancelar/confirmar) -> `AgendamentoResumo`. */
export function resumoDeCompleto(a: AgendamentoCompleto, config: ConfigAutoatendimento): Resumo {
  return paraResumo(
    {
      id: a.id,
      status: a.status,
      start_time: a.inicio.utc,
      end_time: a.fim.utc,
      reminder_sent_at: null,
      services: a.service ? { id: a.service.id, title: a.service.title } : null,
      professionals: a.professional ? { id: a.professional.id, name: a.professional.name } : null,
    } as Linha,
    config,
    new Date()
  ).resumo
}

/** Quantos agendamentos futuros e ativos o cliente tem (mesmo filtro da listagem). */
export async function contarAtivosFuturos(db: Db, orgId: string, clienteId: string): Promise<number> {
  const { count, error } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("customer_id", clienteId)
    .in("status", EDITAVEIS)
    .gte("start_time", new Date().toISOString())

  if (error) {
    console.error("[autoatendimento:agendamentos]", error)
    throw error
  }

  return count ?? 0
}

/** Janela da idempotência natural (C5). */
const JANELA_RETENTATIVA_MS = 10 * 60000

/**
 * C5: retentativa de criação. Já existe agendamento DESTE cliente, com o mesmo
 * profissional e o mesmo início, criado há menos de 10 min (e ainda ativo)?
 * Devolve esse, para a criação repetida responder com o mesmo id.
 */
export async function buscarRetentativa(
  db: Db,
  p: { orgId: string; clienteId: string; profissionalId: string; inicio: Date; config: ConfigAutoatendimento }
): Promise<Resumo | null> {
  const { data, error } = await db
    .from("appointments")
    .select(SELECT_RESUMO)
    .eq("organization_id", p.orgId)
    .eq("customer_id", p.clienteId)
    .eq("professional_id", p.profissionalId)
    .eq("start_time", p.inicio.toISOString())
    .in("status", EDITAVEIS)
    .gte("created_at", new Date(Date.now() - JANELA_RETENTATIVA_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[autoatendimento:agendamentos]", error)
    throw error
  }

  return data ? paraResumo(data as unknown as Linha, p.config, new Date()).resumo : null
}
