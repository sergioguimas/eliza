import "server-only"

import type { HorariosQuery, MotivoSemHorario } from "@/contracts/autoatendimento"
import { exigirProfissionalAtivo, exigirServicoAtivo, listarProfissionaisAtivos } from "@/lib/domain/catalogo"
import type { Db } from "@/lib/domain/db"
import { listarHorariosLivres, type MotivoSemHorario as MotivoDoDominio } from "@/lib/domain/horarios"
import { dataLocal } from "@/lib/domain/tempo"
import { ApiError, validation } from "@/lib/http/erros"
import type { ConfigAutoatendimento } from "./config"

/**
 * O domínio nomeia o motivo em português; o contrato do canal (03) em inglês.
 * `motivoVazio` da listagem só chega a organizacao_fechada, profissional_sem_expediente,
 * fora_do_expediente, antecedencia_minima e agenda_cheia; os demais (que só a
 * validação de um horário único produz) caem em "fully_booked" por segurança.
 */
const MOTIVO_DO_CONTRATO: Record<MotivoDoDominio, MotivoSemHorario> = {
  organizacao_fechada: "organization_closed_day",
  profissional_sem_expediente: "professional_unavailable_day",
  fora_do_expediente: "outside_business_hours",
  antecedencia_minima: "antecedencia_minima",
  agenda_cheia: "fully_booked",
  intervalo: "fully_booked",
  ocupado: "fully_booked",
  fora_da_grade: "fully_booked",
}

/** Soma dias a uma data de calendário "AAAA-MM-DD" sem passar por fuso. */
function somarDias(data: string, dias: number) {
  const [y, m, d] = data.split("-").map(Number)

  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10)
}

/**
 * Horários livres de um serviço num dia (03), um bloco por profissional, na
 * ordem de `listarProfissionaisAtivos` e incluindo quem ficou sem horário
 * (com `motivoVazio`). Mesmo predicado da validação de criar/remarcar (C4).
 *
 * Ordem das checagens: serviço (NOT_FOUND) -> profissional (NOT_FOUND) -> janela (OUT_OF_WINDOW).
 */
export async function consultarHorarios(db: Db, orgId: string, config: ConfigAutoatendimento, q: HorariosQuery) {
  const servico = await exigirServicoAtivo(db, orgId, q.servicoId)

  const profissionais = q.profissionalId
    ? [await exigirProfissionalAtivo(db, orgId, q.profissionalId)]
    : await listarProfissionaisAtivos(db, orgId)

  // "2026-02-30" passa no formato mas não existe: rolaria para março.
  if (somarDias(q.data, 0) !== q.data) throw validation("Data inválida.", [{ field: "data", message: "Use uma data de calendário válida." }])

  const agora = new Date()
  const hoje = dataLocal(agora)

  if (q.data < hoje || q.data > somarDias(hoje, config.janelaMaximaDias)) {
    throw new ApiError(
      "OUT_OF_WINDOW",
      `Só é possível consultar datas de hoje até ${config.janelaMaximaDias} dias à frente.`
    )
  }

  const naoAntesDe = new Date(agora.getTime() + config.antecedenciaMinimaMinutos * 60000)

  const porProfissional = await Promise.all(
    profissionais.map(async (profissional) => {
      const { horarios, motivoVazio } = await listarHorariosLivres(db, {
        orgId,
        profissionalId: profissional.id,
        data: q.data,
        duracaoMinutos: servico.duracaoMinutos,
        naoAntesDe,
      })

      return {
        profissional,
        horarios,
        motivoVazio: horarios.length === 0 && motivoVazio ? MOTIVO_DO_CONTRATO[motivoVazio] : null,
      }
    })
  )

  return { data: q.data, servicoId: servico.id, porProfissional }
}
