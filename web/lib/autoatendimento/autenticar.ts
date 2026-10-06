import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { CONTRATO_VERSAO, HEADER_TICKET, HEADER_VERSAO } from "@/contracts/autoatendimento"
import { ApiError, internalError } from "@/lib/http/erros"
import type { Autenticador } from "@/lib/http/rota"
import { carregarConfig, type ConfigAutoatendimento } from "./config"
import { TAMANHO_MINIMO_SEGREDO, segredoDoTicket, validarTicket } from "./ticket"

/**
 * O que a rota recebe. Organização e telefone saem SÓ daqui (do ticket):
 * nenhum endpoint os aceita em header, query ou body.
 */
export type ContextoAutoatendimento = {
  /** organizations.id do ticket */
  org: string
  /** telefone do ticket, só dígitos, como veio do WhatsApp */
  telefone: string
  config: ConfigAutoatendimento
}

const MENSAGEM_INATIVO = "O atendimento automático não está disponível para este estabelecimento no momento."

/** Hash dos dois lados: timingSafeEqual exige o mesmo tamanho e isso não vaza o do segredo. */
function mesmoSegredo(recebido: string, esperado: string) {
  const a = createHash("sha256").update(recebido).digest()
  const b = createHash("sha256").update(esperado).digest()

  return timingSafeEqual(a, b)
}

/**
 * Autenticação do canal (README §2), nesta ordem:
 *   1. envs configuradas (senão falha fechada: 500 e log, sem dizer qual faltou);
 *   2. token de serviço -> UNAUTHORIZED;
 *   3. versão do contrato -> VERSION_MISMATCH;
 *   4. ticket: ausente -> TICKET_MISSING; assinatura/forma -> TICKET_INVALID; vencido -> TICKET_EXPIRED;
 *   5. a org do ticket ainda tem a instância `inst` e o add-on ativo -> senão ADDON_INACTIVE
 *      (cobre add-on desligado no meio da conversa e número trocado de org).
 */
export const autenticarTicket: Autenticador<ContextoAutoatendimento> = async (req, db) => {
  const tokenEsperado = process.env.AUTOATENDIMENTO_API_TOKEN || ""

  try {
    segredoDoTicket()
  } catch (error) {
    console.error("[autoatendimento:autenticar] segredo do ticket não configurado:", (error as Error).message)
    throw internalError()
  }

  if (tokenEsperado.length < TAMANHO_MINIMO_SEGREDO) {
    console.error("[autoatendimento:autenticar] AUTOATENDIMENTO_API_TOKEN ausente ou com menos de 32 caracteres.")
    throw internalError()
  }

  const token = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1]

  if (!token || !mesmoSegredo(token, tokenEsperado)) {
    console.warn("[autoatendimento:autenticar] token de serviço ausente ou inválido", { path: req.nextUrl.pathname })
    throw new ApiError("UNAUTHORIZED", "Token de serviço ausente ou inválido.")
  }

  if (req.headers.get(HEADER_VERSAO) !== CONTRATO_VERSAO) {
    throw new ApiError(
      "VERSION_MISMATCH",
      `Versão do contrato incompatível. Envie o header ${HEADER_VERSAO}: ${CONTRATO_VERSAO}.`
    )
  }

  const bruto = req.headers.get(HEADER_TICKET)

  if (!bruto) throw new ApiError("TICKET_MISSING", "Ticket da conversa ausente.")

  const ticket = validarTicket(bruto)

  if (!ticket.ok) {
    throw ticket.motivo === "expirado"
      ? new ApiError("TICKET_EXPIRED", "O ticket da conversa expirou. Use o da mensagem mais recente do cliente.")
      : new ApiError("TICKET_INVALID", "Ticket da conversa inválido.")
  }

  const { org, tel, inst } = ticket.payload

  const [organizacao, config] = await Promise.all([
    db.from("organizations").select("whatsapp_instance_name").eq("id", org).maybeSingle(),
    carregarConfig(db, org),
  ])

  if (organizacao.error) {
    console.error("[autoatendimento:autenticar] erro ao consultar organização:", organizacao.error.message)
    throw internalError()
  }

  if (!config || organizacao.data?.whatsapp_instance_name !== inst) {
    throw new ApiError("ADDON_INACTIVE", MENSAGEM_INATIVO)
  }

  return { org, telefone: tel, config }
}
