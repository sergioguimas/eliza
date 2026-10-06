import "server-only"

import type { z } from "zod"
import type { NotifyMeta } from "@/contracts/api-v1"
import { consumeRateLimit, hashIdentifier } from "@/lib/demo/rate-limit"
import type { Ator, ContextoNotificacao } from "@/lib/domain/agendamentos"
import type { Db } from "@/lib/domain/db"

/** V4: 7.200 mensagens/h pelo número do tenant com uma chave vazada seria spam; 60/h cobre a operação real. */
const TETO_POR_ORGANIZACAO = { windowMs: 60 * 60 * 1000, max: 60 }

type Motivo = NonNullable<z.infer<typeof NotifyMeta>["notify_skipped"]>

/**
 * Notificação por WhatsApp numa escrita da v1 (D6, api-v1 §5.2). O domínio
 * decide O QUE enviar; aqui se decide SE a chave pode mandar:
 *   - cliente que acabou de ser criado nunca recebe (`new_customer`);
 *   - teto por org em TODA escrita com `notify` (`org_limit`), consumido só
 *     quando a mensagem de fato iria sair;
 * e se traduz o resultado em `meta` (`notified`, `notify_skipped`).
 * Recusar a notificação nunca falha o request (V3).
 */
export function prepararNotificacao(db: Db, orgId: string, notify: boolean) {
  let recusa: Motivo | null = null
  let consultado = false

  const podeNotificar: Ator["podeNotificar"] = notify
    ? async ({ clienteCriado }: ContextoNotificacao) => {
        consultado = true

        if (clienteCriado) {
          recusa = "new_customer"
          return false
        }

        const teto = await consumeRateLimit(db, hashIdentifier("api-notify-org", orgId), TETO_POR_ORGANIZACAO)

        if (!teto.allowed) {
          recusa = "org_limit"
          return false
        }

        return true
      }
    : null

  /**
   * `aplicavel`: a operação tem mensagem a enviar (criar sempre; editar só se
   * mudou horário; status só em confirmed/canceled). `telefone`: do cliente.
   */
  const meta = (notificado: boolean, aplicavel: boolean, telefone: string | null): z.infer<typeof NotifyMeta> => {
    if (notificado) return { notified: true }
    if (!notify || !aplicavel) return { notified: false }
    if (recusa) return { notified: false, notify_skipped: recusa }

    // O domínio não chega a perguntar ao ator quando o cliente não tem telefone.
    if (!consultado) return telefone ? { notified: false } : { notified: false, notify_skipped: "no_phone" }

    return { notified: false, notify_skipped: "send_failed" }
  }

  return { podeNotificar, meta }
}

/** Ator das escritas da v1: a chave age como o tenant; `origem` vai para appointment_logs.source. */
export function atorDaChave(
  chave: { organizationId: string; keyPrefix: string },
  podeNotificar: Ator["podeNotificar"]
): Ator {
  return {
    canal: "api",
    organizationId: chave.organizationId,
    origem: `api:${chave.keyPrefix}`,
    podeNotificar,
  }
}
