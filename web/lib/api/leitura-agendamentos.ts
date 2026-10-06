import "server-only"

import type { AgendamentoCompleto } from "@/lib/domain/agendamentos"
import type { Db } from "@/lib/domain/db"
import { DomainError } from "@/lib/domain/erros"
import type { Status } from "@/lib/domain/status"
import { momento } from "@/lib/domain/tempo"

/**
 * Leitura de agendamentos da API (GET /appointments e /appointments/{id}).
 * Leitura não é regra de negócio, então fica na camada da API; toda query
 * filtra por organization_id. Escrita é só do domínio (lib/domain).
 */

const SELECT = `
  id, status, start_time, end_time, notes, price, payment_status, payment_method,
  paid_at, created_at, updated_at, customer_id, professional_id, service_id,
  customers ( id, name, phone ),
  services ( id, title, duration_minutes ),
  professionals ( id, name )
`

type Linha = {
  id: string
  status: string | null
  start_time: string
  end_time: string
  notes: string | null
  price: number | null
  payment_status: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
  updated_at: string | null
  customer_id: string
  customers: { id: string; name: string; phone: string } | null
  services: { id: string; title: string; duration_minutes: number | null } | null
  professionals: { id: string; name: string } | null
}

function paraAgendamento(l: Linha): AgendamentoCompleto {
  return {
    id: l.id,
    status: l.status as Status,
    inicio: momento(l.start_time),
    fim: momento(l.end_time),
    customer: l.customers
      ? { id: l.customers.id, name: l.customers.name, phone: l.customers.phone }
      : { id: l.customer_id, name: null, phone: null },
    service: l.services
      ? { id: l.services.id, title: l.services.title, duration_minutes: l.services.duration_minutes || 30 }
      : null,
    professional: l.professionals ? { id: l.professionals.id, name: l.professionals.name } : null,
    price: l.price,
    payment_status: l.payment_status,
    payment_method: l.payment_method,
    paid_at: l.paid_at,
    notes: l.notes,
    created_at: l.created_at,
    updated_at: l.updated_at,
  }
}

/** Id E tenant, senão NOT_FOUND (o mesmo para inexistente e de outro tenant). */
export async function obterAgendamento(db: Db, orgId: string, id: string): Promise<AgendamentoCompleto> {
  const { data, error } = await db
    .from("appointments")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()

  // 22P02: id que não é UUID. Para quem chama é o mesmo que não existir.
  if (error && error.code !== "22P02") {
    console.error("[api:obterAgendamento]", error)
    throw error
  }

  if (!data) throw new DomainError("NOT_FOUND", "Agendamento não encontrado.")

  return paraAgendamento(data as unknown as Linha)
}

export type FiltrosDeListagem = {
  status?: Status[]
  de?: Date
  ate?: Date
  clienteId?: string
  profissionalId?: string
  limite: number
  deslocamento: number
}

export async function listarAgendamentos(db: Db, orgId: string, f: FiltrosDeListagem) {
  let consulta = db
    .from("appointments")
    .select(SELECT, { count: "exact" })
    .eq("organization_id", orgId)
    .order("start_time", { ascending: true })
    .range(f.deslocamento, f.deslocamento + f.limite - 1)

  if (f.status?.length) consulta = consulta.in("status", f.status)
  if (f.de) consulta = consulta.gte("start_time", f.de.toISOString())
  if (f.ate) consulta = consulta.lt("start_time", f.ate.toISOString())
  if (f.clienteId) consulta = consulta.eq("customer_id", f.clienteId)
  if (f.profissionalId) consulta = consulta.eq("professional_id", f.profissionalId)

  const { data, error, count } = await consulta

  if (error) {
    console.error("[api:listarAgendamentos]", error)
    throw error
  }

  return { itens: (data as unknown as Linha[]).map(paraAgendamento), total: count ?? 0 }
}
