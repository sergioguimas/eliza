import { AvailabilityQuery } from "@/contracts/api-v1/catalogo"
import { apiRoute } from "@/lib/api/handler"
import { exigirServicoAtivo } from "@/lib/domain/catalogo"
import { listarHorariosLivres } from "@/lib/domain/horarios"
import { FUSO } from "@/lib/domain/tempo"

/**
 * Horários livres de um profissional num dia, para um serviço. A janela testada
 * tem a duração do serviço e horário passado não aparece: é o mesmo predicado
 * que valida o POST /appointments (lib/domain/horarios). A constraint do banco
 * continua sendo a garantia final contra corrida. Serviço ou profissional
 * inexistente, inativo ou de outro tenant: NOT_FOUND do domínio vira 404.
 */
export const GET = apiRoute("read", async ({ db, organizationId, parseQuery }) => {
  const { professional_id, service_id, date } = parseQuery(AvailabilityQuery)

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
})
