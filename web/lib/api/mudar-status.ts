import "server-only"

import type { Ator } from "@/lib/domain/agendamentos"
import { mudarStatus } from "@/lib/domain/agendamentos"
import type { Db } from "@/lib/domain/db"
import type { Status } from "@/lib/domain/status"
import { atorDaChave, prepararNotificacao } from "./notificacao"
import { paraAppointment } from "./serializar"

/**
 * Corpo comum de confirm, cancel e status: muda o status pelo domínio (máquina
 * de status, E6, log com source "api:<prefixo>") e monta a resposta com o meta
 * da notificação. O domínio só avisa em confirmed e canceled; repetir o status
 * atual é idempotente (200, sem log nem aviso).
 */
export async function mudarStatusPelaChave(
  db: Db,
  chave: { organizationId: string; keyPrefix: string },
  id: string,
  para: Status,
  opcoes: { motivo?: string; notify: boolean }
) {
  const notificacao = prepararNotificacao(db, chave.organizationId, opcoes.notify)
  const ator: Ator = atorDaChave(chave, notificacao.podeNotificar)

  const { agendamento, alterado, notificado } = await mudarStatus(db, ator, id, para, { motivo: opcoes.motivo })

  const aplicavel = alterado && (para === "confirmed" || para === "canceled")

  return {
    data: paraAppointment(agendamento),
    meta: notificacao.meta(notificado, aplicavel, agendamento.customer.phone),
  }
}
