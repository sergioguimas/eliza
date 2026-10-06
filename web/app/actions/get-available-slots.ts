"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { exigirServicoAtivo } from "@/lib/domain/catalogo"
import { DomainError } from "@/lib/domain/erros"
import { listarHorariosLivres, type MotivoSemHorario } from "@/lib/domain/horarios"
import { dataLocal } from "@/lib/domain/tempo"

type AvailableSlotsReason =
  | "organization_closed_day"
  | "professional_unavailable_day"
  | "professional_not_in_organization"
  | "service_unavailable"
  | "outside_business_hours"
  | "fully_booked"
  | "error"

type AvailableSlotsResult = {
  slots: string[]
  message?: string
  reason?: AvailableSlotsReason
}

// A regra vive em lib/domain/horarios; aqui só se traduz o motivo do domínio
// para o vocabulário que o formulário público já consome. Intervalo, ocupado,
// antecedência e agenda lotada, vistos de fora, são todos "sem horário livre".
const RESULTADO_POR_MOTIVO: Partial<
  Record<MotivoSemHorario, { reason: AvailableSlotsReason; message: string }>
> = {
  organizacao_fechada: {
    reason: "organization_closed_day",
    message: "Este dia não está disponível para agendamentos.",
  },
  profissional_sem_expediente: {
    reason: "professional_unavailable_day",
    message: "O profissional não possui expediente configurado para este dia.",
  },
  fora_do_expediente: {
    reason: "outside_business_hours",
    message: "Não há expediente disponível para este profissional neste dia.",
  },
}

const SEM_HORARIO_LIVRE: { reason: AvailableSlotsReason; message: string } = {
  reason: "fully_booked",
  message:
    "Não há horários disponíveis neste dia. Pode ser intervalo, agenda cheia ou ausência de expediente livre.",
}

/**
 * Horários livres de um profissional num dia, para o formulário público
 * (/marcar/[slug]), que não tem sessão. Wrapper fino de `listarHorariosLivres`.
 *
 * Roda com SERVICE ROLE: como anon, `organization_settings` voltava vazia (o
 * RLS isola por `get_user_org_id()`, NULL para anon) e `appointments` só
 * mostrava os `pending`, então expediente/almoço da org eram ignorados e
 * horário ocupado era oferecido como livre. Em troca, o escopo é nosso:
 * `professionalId`, `serviceId` e `organizationId` vêm do client, e o domínio
 * valida o vínculo de cada um com a org antes de ler a agenda.
 *
 * `serviceId` define a duração testada. Sem ele, vale o passo da organização
 * (`appointment_duration`), que é o comportamento antigo. Horário que já
 * passou hoje não é oferecido.
 *
 * O retorno é só uma lista de horários livres, que é exatamente o que uma
 * página pública de agendamento precisa expor.
 */
export async function getAvailableSlots(
  professionalId: string,
  date: Date,
  organizationId: string,
  serviceId?: string
): Promise<AvailableSlotsResult> {
  const db = createAdminClient<Database>()

  let duracaoMinutos: number | undefined

  if (serviceId) {
    try {
      duracaoMinutos = (await exigirServicoAtivo(db, organizationId, serviceId)).duracaoMinutos
    } catch (error) {
      return resultadoDeErro(error, "service_unavailable", "Serviço indisponível para agendamento.")
    }
  }

  try {
    const { horarios, motivoVazio } = await listarHorariosLivres(db, {
      orgId: organizationId,
      profissionalId: professionalId,
      data: dataLocal(date),
      duracaoMinutos,
      naoAntesDe: new Date(),
    })

    if (horarios.length > 0) return { slots: horarios }

    return { slots: [], ...((motivoVazio && RESULTADO_POR_MOTIVO[motivoVazio]) || SEM_HORARIO_LIVRE) }
  } catch (error) {
    return resultadoDeErro(
      error,
      "professional_not_in_organization",
      "Profissional indisponível para agendamento."
    )
  }
}

// NOT_FOUND do domínio vira o motivo pedido; qualquer outra falha é erro
// genérico (o detalhe vai para o log, não para a página pública).
function resultadoDeErro(
  error: unknown,
  reasonNaoEncontrado: AvailableSlotsReason,
  messageNaoEncontrado: string
): AvailableSlotsResult {
  if (error instanceof DomainError && error.codigo === "NOT_FOUND") {
    return { slots: [], reason: reasonNaoEncontrado, message: messageNaoEncontrado }
  }

  console.error("[getAvailableSlots]", error)

  return { slots: [], reason: "error", message: "Erro ao carregar horários disponíveis." }
}
