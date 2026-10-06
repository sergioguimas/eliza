import "server-only"

import {
  AgendamentoIdParams,
  type CancelarAgendamentoBody,
  type CriarAgendamentoBody,
  type RemarcarAgendamentoBody,
} from "@/contracts/autoatendimento"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { criarAgendamento, editarAgendamento, mudarStatus, type Ator } from "@/lib/domain/agendamentos"
import { exigirProfissionalAtivo, exigirServicoAtivo } from "@/lib/domain/catalogo"
import type { Db } from "@/lib/domain/db"
import { DomainError } from "@/lib/domain/erros"
import { EDITAVEIS } from "@/lib/domain/status"
import { dataLocal, horaLocalParaUtc } from "@/lib/domain/tempo"
import { ApiError } from "@/lib/http/erros"
import {
  buscarRetentativa,
  carregarDoCliente,
  contarAtivosFuturos,
  resumoDeCompleto,
} from "./agendamentos"
import type { ConfigAutoatendimento } from "./config"
import { somarDias } from "./horarios"

/**
 * Escrita de agendamentos do cliente do ticket (04). Toda regra de agenda e de
 * status vem de `lib/domain`; aqui só ficam as regras do canal (janela,
 * antecedência, limite de ativos, posse e a idempotência C5).
 */

type Alvo = { orgId: string; clienteId: string; config: ConfigAutoatendimento }

/** `{id}` da rota. Não sendo UUID, é o mesmo que não existir (NOT_FOUND), como a posse. */
export function idDoAgendamento(params: Record<string, string>) {
  const lido = AgendamentoIdParams.safeParse(params)

  if (!lido.success) throw new ApiError("NOT_FOUND", "Agendamento não encontrado.")

  return lido.data.id
}

/** O mesmo Ator para toda escrita do canal. `podeNotificar: null` porque o atendente é quem responde. */
const atorDoCanal = (orgId: string): Ator => ({
  canal: "autoatendimento",
  organizationId: orgId,
  origem: "autoatendimento",
  podeNotificar: null,
})

/** "30 minutos", "2 horas", "1 hora e 30 minutos". */
function descreverAntecedencia(minutos: number) {
  if (minutos < 60) return `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`

  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  const parteHoras = `${horas} ${horas === 1 ? "hora" : "horas"}`

  return resto === 0 ? parteHoras : `${parteHoras} e ${resto} ${resto === 1 ? "minuto" : "minutos"}`
}

/** Passo 4 do 04 (criar e remarcar): janela [hoje, hoje + janela] e antecedência mínima. */
function validarJanelaEAntecedencia(inicio: Date, config: ConfigAutoatendimento) {
  const agora = new Date()
  const hoje = dataLocal(agora)

  if (dataLocal(inicio) < hoje || dataLocal(inicio) > somarDias(hoje, config.janelaMaximaDias)) {
    throw new ApiError(
      "OUT_OF_WINDOW",
      `Só é possível agendar de hoje até ${config.janelaMaximaDias} dias à frente.`
    )
  }

  if (inicio.getTime() < agora.getTime() + config.antecedenciaMinimaMinutos * 60000) {
    throw new ApiError(
      "NOTICE_TOO_SHORT",
      `É preciso marcar com pelo menos ${descreverAntecedencia(config.antecedenciaMinimaMinutos)} de antecedência.`
    )
  }
}

/** Cancelar e remarcar: status que não permite -> INVALID_TRANSITION; antecedência -> NOTICE_TOO_SHORT. */
function exigirAlteravel(
  resumo: { status: string; podeCancelar: boolean },
  config: ConfigAutoatendimento,
  verbo: "cancelado" | "remarcado"
) {
  if (!(EDITAVEIS as string[]).includes(resumo.status)) {
    const rotulo = (STATUS_CONFIG[resumo.status]?.label ?? resumo.status).toLowerCase()

    throw new ApiError("INVALID_TRANSITION", `Este agendamento está ${rotulo} e não pode ser ${verbo}.`)
  }

  if (!resumo.podeCancelar) {
    throw new ApiError(
      "NOTICE_TOO_SHORT",
      `Faltam menos de ${descreverAntecedencia(config.antecedenciaMinimaMinutos)} para este horário, então ele não pode ser ${verbo} por aqui. É preciso falar com a equipe do estabelecimento.`
    )
  }
}

/** POST /agendamentos. Passos 2 a 8 do 04 (o 1, limites, é da rota). */
export async function criarDoCliente(db: Db, a: Alvo, body: CriarAgendamentoBody) {
  const inicio = horaLocalParaUtc(body.inicio, "inicio")

  // 2. Serviço e profissional ativos e da org; senão NOT_FOUND.
  await Promise.all([
    exigirServicoAtivo(db, a.orgId, body.servicoId),
    exigirProfissionalAtivo(db, a.orgId, body.profissionalId),
  ])

  const retentativa = () =>
    buscarRetentativa(db, {
      orgId: a.orgId,
      clienteId: a.clienteId,
      profissionalId: body.profissionalId,
      inicio,
      config: a.config,
    })

  // C5, caso comum: o pedido repetido responde com o agendamento que já criou
  // (antes do limite de ativos, que o próprio agendamento original já consumiu).
  const repetido = await retentativa()

  if (repetido) return repetido

  // 3. Limite de agendamentos ativos.
  if ((await contarAtivosFuturos(db, a.orgId, a.clienteId)) >= a.config.maxAgendamentosAtivos) {
    throw new ApiError(
      "ACTIVE_LIMIT_REACHED",
      `Você já tem ${a.config.maxAgendamentosAtivos} agendamentos ativos, que é o máximo permitido. Cancele ou conclua um deles antes de marcar outro.`
    )
  }

  // 4. Janela e antecedência.
  validarJanelaEAntecedencia(inicio, a.config)

  // 5 e 6. validarHorario (com grade) e o insert são do domínio (C4).
  try {
    const { agendamento } = await criarAgendamento(db, atorDoCanal(a.orgId), {
      cliente: { id: a.clienteId },
      profissionalId: body.profissionalId,
      servicoId: body.servicoId,
      inicio,
      observacao: body.observacao || null,
      status: "pending",
      antecedenciaMinutos: a.config.antecedenciaMinimaMinutos,
    })

    return resumoDeCompleto(agendamento, a.config)
  } catch (error) {
    // 7. C5, corrida: dois pedidos iguais ao mesmo tempo, o segundo cai no horário que o primeiro acabou de ocupar.
    if (error instanceof DomainError && error.codigo === "SLOT_UNAVAILABLE") {
      const criadoAgora = await retentativa()

      if (criadoAgora) return criadoAgora
    }

    throw error
  }
}

/** POST /agendamentos/{id}/remarcar. O serviço não muda; o status volta a `pending` (D8, no domínio). */
export async function remarcarDoCliente(db: Db, a: Alvo, id: string, body: RemarcarAgendamentoBody) {
  const { resumo } = await carregarDoCliente(db, { orgId: a.orgId, clienteId: a.clienteId, id, config: a.config })

  exigirAlteravel(resumo, a.config, "remarcado")

  const inicio = horaLocalParaUtc(body.inicio, "inicio")

  validarJanelaEAntecedencia(inicio, a.config)

  const { agendamento } = await editarAgendamento(db, atorDoCanal(a.orgId), id, {
    inicio,
    profissionalId: body.profissionalId,
    antecedenciaMinutos: a.config.antecedenciaMinimaMinutos,
  })

  return resumoDeCompleto(agendamento, a.config)
}

/** POST /agendamentos/{id}/cancelar. `status = canceled`; nunca DELETE (D7). */
export async function cancelarDoCliente(db: Db, a: Alvo, id: string, body: CancelarAgendamentoBody) {
  const { resumo } = await carregarDoCliente(db, { orgId: a.orgId, clienteId: a.clienteId, id, config: a.config })

  exigirAlteravel(resumo, a.config, "cancelado")

  const { agendamento } = await mudarStatus(db, atorDoCanal(a.orgId), id, "canceled", { motivo: body.motivo })

  return resumoDeCompleto(agendamento, a.config)
}

/**
 * POST /agendamentos/{id}/confirmar. Só `scheduled` e antes do horário; `pending`
 * é aguardando aprovação do estabelecimento. `confirmed` repetido é sucesso idempotente.
 */
export async function confirmarDoCliente(db: Db, a: Alvo, id: string) {
  const { resumo } = await carregarDoCliente(db, { orgId: a.orgId, clienteId: a.clienteId, id, config: a.config })

  if (resumo.status === "confirmed") return resumo

  if (!resumo.podeConfirmar) {
    const rotulo = (STATUS_CONFIG[resumo.status]?.label ?? resumo.status).toLowerCase()

    throw new ApiError(
      "INVALID_TRANSITION",
      resumo.status === "pending"
        ? "Este agendamento ainda aguarda a aprovação do estabelecimento. Só dá para confirmar presença depois que ele for aprovado."
        : resumo.status === "scheduled"
          ? "O horário deste agendamento já passou, então não dá mais para confirmar."
          : `Este agendamento está ${rotulo} e não pode ser confirmado.`
    )
  }

  const { agendamento } = await mudarStatus(db, atorDoCanal(a.orgId), id, "confirmed")

  return resumoDeCompleto(agendamento, a.config)
}
