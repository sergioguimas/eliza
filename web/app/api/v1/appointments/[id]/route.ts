import { UpdateAppointmentBody } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { obterAgendamento } from "@/lib/api/leitura-agendamentos"
import { atorDaChave, prepararNotificacao } from "@/lib/api/notificacao"
import { paraAppointment } from "@/lib/api/serializar"
import { editarAgendamento } from "@/lib/domain/agendamentos"
import { horaLocalParaUtc } from "@/lib/domain/tempo"

export const GET = apiRoute("read", async ({ db, organizationId, params }) => ({
  data: paraAppointment(await obterAgendamento(db, organizationId, params.id)),
}))

/**
 * Remarcar/alterar: horário, profissional, serviço e/ou observação. Só em
 * pending/scheduled/confirmed; mudar o horário revalida a agenda e zera os lembretes.
 * Sem DELETE (D5): para tirar da agenda, POST .../cancel (o Next responde 405).
 */
export const PATCH = apiRoute("write", async ({ db, organizationId, keyPrefix, params, body }) => {
  const input = await body(UpdateAppointmentBody)
  const notificacao = prepararNotificacao(db, organizationId, input.notify)

  const { agendamento, notificado } = await editarAgendamento(
    db,
    atorDaChave({ organizationId, keyPrefix }, notificacao.podeNotificar),
    params.id,
    {
      inicio: input.start_time ? horaLocalParaUtc(input.start_time) : undefined,
      profissionalId: input.professional_id,
      servicoId: input.service_id,
      observacao: input.notes,
    }
  )

  // O domínio só avisa quando o horário muda; sem start/profissional/serviço no body não há o que avisar.
  const aplicavel = input.start_time !== undefined || input.professional_id !== undefined || input.service_id !== undefined

  return {
    data: paraAppointment(agendamento),
    meta: notificacao.meta(notificado, aplicavel, agendamento.customer.phone),
  }
})
