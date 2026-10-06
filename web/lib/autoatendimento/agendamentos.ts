import "server-only"

import type { z } from "zod"
import type { AgendamentoResumo } from "@/contracts/autoatendimento"
import type { Db } from "@/lib/domain/db"
import { EDITAVEIS, ehStatus } from "@/lib/domain/status"
import { momento } from "@/lib/domain/tempo"
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
