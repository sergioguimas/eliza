import { AvailabilityQuery } from "@/contracts/api-v1/catalogo"
import { apiRoute } from "@/lib/api/handler"
import { ApiError, validation } from "@/lib/api/http"
import { exigirServicoAtivo } from "@/lib/domain/catalogo"
import { DomainError } from "@/lib/domain/erros"
import { listarHorariosLivres } from "@/lib/domain/horarios"
import { FUSO } from "@/lib/domain/tempo"

/**
 * Horários livres de um profissional num dia, para um serviço. A janela testada
 * tem a duração do serviço e horário passado não aparece: é o mesmo predicado
 * que valida o POST /appointments (lib/domain/horarios). A constraint do banco
 * continua sendo a garantia final contra corrida.
 */
export const GET = apiRoute("read", async ({ db, organizationId, query: qs }) => {
  const parsed = AvailabilityQuery.safeParse(Object.fromEntries(qs))

  if (!parsed.success) {
    throw validation("Parâmetros inválidos.", parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })))
  }

  const { professional_id, service_id, date } = parsed.data

  try {
    const servico = await exigirServicoAtivo(db, organizationId, service_id)

    const { horarios, motivoVazio, passoMinutos } = await listarHorariosLivres(db, {
      orgId: organizationId,
      profissionalId: professional_id,
      data: date,
      duracaoMinutos: servico.duracaoMinutos,
      naoAntesDe: new Date(),
    })

    return {
      data: {
        date,
        professional_id,
        service_id,
        slots: horarios,
        empty_reason: horarios.length === 0 ? motivoVazio : null,
      },
      meta: { timezone: FUSO, grid_step_minutes: passoMinutos },
    }
  } catch (error) {
    if (error instanceof DomainError) {
      if (error.codigo === "NOT_FOUND") throw new ApiError(404, "NOT_FOUND", error.message)
      if (error.codigo === "VALIDATION_ERROR") throw validation(error.message)
    }

    throw error
  }
})
