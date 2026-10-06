import { AppointmentStatus, CreateAppointmentBody, ListAppointmentsQuery } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { listarAgendamentos } from "@/lib/api/leitura-agendamentos"
import { atorDaChave, prepararNotificacao } from "@/lib/api/notificacao"
import { paraAppointment } from "@/lib/api/serializar"
import { criarAgendamento } from "@/lib/domain/agendamentos"
import { validation } from "@/lib/http/erros"
import { horaLocalParaUtc, limitesDoDiaUtc } from "@/lib/domain/tempo"

const dateOnly = /^\d{4}-\d{2}-\d{2}$/

// `from`/`to` aceitam "YYYY-MM-DD" (dia inteiro em São Paulo) ou data/hora.
const bound = (v: string, edge: "from" | "to") =>
  dateOnly.test(v)
    ? edge === "from"
      ? limitesDoDiaUtc(v).inicio
      : limitesDoDiaUtc(v).fim
    : horaLocalParaUtc(v, edge)

export const GET = apiRoute("read", async ({ db, organizationId, parseQuery }) => {
  const f = parseQuery(ListAppointmentsQuery)
  const pedidos = f.status?.split(",").map((s) => s.trim()).filter(Boolean)
  const status = pedidos?.map((s) => AppointmentStatus.safeParse(s))

  if (status?.some((s) => !s.success)) {
    throw validation(`Status inválido. Valores: ${AppointmentStatus.options.join(", ")}.`)
  }

  const { itens, total } = await listarAgendamentos(db, organizationId, {
    status: status?.map((s) => s.data!),
    de: f.from ? bound(f.from, "from") : undefined,
    ate: f.to ? bound(f.to, "to") : undefined,
    clienteId: f.customer_id,
    profissionalId: f.professional_id,
    limite: f.limit,
    deslocamento: f.offset,
  })

  return { data: itens.map(paraAppointment), meta: { total, limit: f.limit, offset: f.offset } }
})

/**
 * Cria o agendamento pelo domínio: canal "api" aceita horário fora da grade (E1),
 * não exige documento do cliente e recusa horário passado/ocupado (409 com sugestões).
 * `notify` só envia para cliente que já existia, com teto por org (D6).
 */
export const POST = apiRoute("write", async ({ db, organizationId, keyPrefix, body }) => {
  const input = await body(CreateAppointmentBody)
  const notificacao = prepararNotificacao(db, organizationId, input.notify)
  const c = input.customer

  const { agendamento, notificado } = await criarAgendamento(
    db,
    atorDaChave({ organizationId, keyPrefix }, notificacao.podeNotificar),
    {
      cliente:
        "customer_id" in c
          ? { id: c.customer_id }
          : {
              nome: c.name,
              telefone: c.phone,
              documento: c.document,
              dataNascimento: c.birth_date,
              genero: c.gender,
            },
      profissionalId: input.professional_id,
      servicoId: input.service_id,
      inicio: horaLocalParaUtc(input.start_time),
      observacao: input.notes,
      status: input.status,
    }
  )

  return {
    data: paraAppointment(agendamento),
    status: 201,
    meta: notificacao.meta(notificado, true, agendamento.customer.phone),
  }
})
