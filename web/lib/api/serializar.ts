import type { z } from "zod"
import type { Appointment, Customer, Professional, Service } from "@/contracts/api-v1"
import type { AgendamentoCompleto } from "@/lib/domain/agendamentos"
import type { Profissional, Servico } from "@/lib/domain/catalogo"
import type { ClienteResumo } from "@/lib/domain/clientes"

/**
 * Domínio (português, camelCase, `Momento`) -> recurso da v1 (snake_case, V1 do
 * contrato). É a ÚNICA ponte entre os dois formatos: nenhuma rota monta o
 * shape da resposta à mão. Os tipos de retorno vêm dos Zod de contracts/api-v1.
 */

export function paraService(s: Servico): z.infer<typeof Service> {
  return {
    id: s.id,
    title: s.titulo,
    description: s.descricao,
    duration_minutes: s.duracaoMinutos,
    price: s.preco,
  }
}

/** Só id, name e specialty: nunca phone nem license_number. */
export function paraProfessional(p: Profissional): z.infer<typeof Professional> {
  return { id: p.id, name: p.nome, specialty: p.especialidade }
}

export function paraCustomer(c: ClienteResumo): z.infer<typeof Customer> {
  return { id: c.id, name: c.nome, phone: c.telefone, email: c.email }
}

export function paraAppointment(a: AgendamentoCompleto): z.infer<typeof Appointment> {
  return {
    id: a.id,
    status: a.status,
    start_time: a.inicio.utc,
    end_time: a.fim.utc,
    start_local: a.inicio.local,
    end_local: a.fim.local,
    customer: a.customer,
    service: a.service,
    professional: a.professional,
    price: a.price,
    payment_status: a.payment_status as z.infer<typeof Appointment>["payment_status"],
    payment_method: a.payment_method,
    paid_at: a.paid_at,
    notes: a.notes,
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}
