import "server-only"

import type { z } from "zod"
import {
  HEADER_ASSINATURA,
  HEADER_TIMESTAMP,
  HEADER_TREINO_OPERADOR,
  HEADER_TREINO_PAPEL,
  HEADER_TREINO_TENANT,
} from "@/contracts/autoatendimento"
import { assinarTreino } from "./assinatura"
import { traduzirErro, type Resultado } from "./treino-regras"

/**
 * Cliente do treino no agens (contrato 10 §3). Um lugar para assinatura, timeout
 * e tradução de erro. O navegador nunca fala com o agens (C29): quem chama isto
 * são as server actions, depois de conferir usuário, papel e add-on.
 */

export type Operador = { tenant: string; id: string; papel: "owner" | "admin"; nome: string | null }

/** Rotas que chamam o LLM. */
export const TIMEOUT_LLM_MS = 45_000
export const TIMEOUT_PADRAO_MS = 10_000

export async function chamarTreino<T>(p: {
  metodo: "GET" | "POST" | "DELETE"
  /** Depois de `{ATENDENTE_URL}/v1/treino`, ex.: `/sessoes/abc/mensagens`. */
  caminho: string
  operador: Operador
  /** Sem `operador`: a função acrescenta. Só em POST. */
  corpo?: Record<string, unknown>
  schema: z.ZodType<T>
  timeoutMs: number
}): Promise<Resultado<T>> {
  const base = process.env.ATENDENTE_URL?.trim().replace(/\/+$/, "")
  const segredo = process.env.ATENDENTE_TREINO_SECRET

  if (!base || !segredo) {
    console.warn("[atendente:treino] env ausente")
    return { ok: false, erro: "INDISPONIVEL" }
  }

  const { tenant, id, papel } = p.operador
  const timestamp = String(Math.floor(Date.now() / 1000))
  const headers: Record<string, string> = { [HEADER_TIMESTAMP]: timestamp }
  let corpo: string | undefined

  if (p.metodo === "POST") {
    // Serializado UMA vez: a assinatura é sobre esta string exata.
    corpo = JSON.stringify({ operador: p.operador, ...p.corpo })
    headers["Content-Type"] = "application/json"
    headers[HEADER_ASSINATURA] = assinarTreino(segredo, timestamp, p.metodo, p.caminho, corpo)
  } else {
    headers[HEADER_TREINO_TENANT] = tenant
    headers[HEADER_TREINO_OPERADOR] = id
    headers[HEADER_TREINO_PAPEL] = papel
    headers[HEADER_ASSINATURA] = assinarTreino(segredo, timestamp, p.metodo, p.caminho, `${tenant}.${id}.${papel}`)
  }

  const controle = new AbortController()
  const prazo = setTimeout(() => controle.abort(), p.timeoutMs)

  try {
    const resposta = await fetch(`${base}/v1/treino${p.caminho}`, {
      method: p.metodo,
      headers,
      body: corpo,
      signal: controle.signal,
      cache: "no-store",
    })
    const dados: unknown = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      if (resposta.status === 401) console.error("[atendente:treino] assinatura_recusada")
      const codigo = (dados as { erro?: { codigo?: string } } | null)?.erro?.codigo
      const erro = traduzirErro(resposta.status, codigo)

      if (erro === "INDISPONIVEL") console.warn(`[atendente:treino] resposta_${resposta.status}`, codigo ?? "")

      return { ok: false, erro }
    }

    const lido = p.schema.safeParse(dados)

    if (!lido.success) {
      console.warn("[atendente:treino] resposta_invalida", p.caminho)
      return { ok: false, erro: "INDISPONIVEL" }
    }

    return { ok: true, dados: lido.data }
  } catch (error) {
    console.warn("[atendente:treino]", controle.signal.aborted ? "timeout" : `erro_de_rede (${(error as Error)?.name})`)
    return { ok: false, erro: "INDISPONIVEL" }
  } finally {
    clearTimeout(prazo)
  }
}
