import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { ChatWebBody } from "@/contracts/autoatendimento"
import { perguntarAoAtendente } from "@/lib/autoatendimento/chat-web"
import { chatWebAtivo } from "@/lib/autoatendimento/config"
import { consumirLimiteWeb } from "@/lib/autoatendimento/limites"
import { getClientIp } from "@/lib/demo/rate-limit"
import { ApiError, internalError, paraApiError, validation, zodDetails } from "@/lib/http/erros"
import { corpoDeErro, corpoDeSucesso, jsonResponse } from "@/lib/http/resposta"
import type { Database } from "@/utils/database.types"
import { createAdminClient } from "@/utils/supabase/admin"

/**
 * Ponte da página pública para o atendente (contrato 08 §6). Fica fora de
 * `/api/v1`: não é API para terceiros (C18). Nada da conversa é gravado aqui, nem
 * em banco nem em log: o log leva só org, resultado, tempo e quantidade de ações.
 */

const COOKIE = "eliza_chat"
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function lerSessao(req: NextRequest) {
  const atual = req.cookies.get(COOKIE)?.value

  return atual && UUID_V4.test(atual) ? { sess: atual, nova: false } : { sess: randomUUID(), nova: true }
}

/** Impede outro site de embutir o chat. Não para quem chama fora do navegador: os limites cobrem esse caso. */
function origemValida(req: NextRequest) {
  const origem = req.headers.get("origin")

  if (!origem) return true

  try {
    return new URL(origem).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const inicio = Date.now()
  const requestId = randomUUID()
  const { sess, nova } = lerSessao(req)
  const cookie: Record<string, string> = nova
    ? { "Set-Cookie": `${COOKIE}=${sess}; HttpOnly; Secure; SameSite=Lax; Path=/api/marcar; Max-Age=7200` }
    : {}
  let org = "-"
  let acoes = 0

  const registrar = (status: string) =>
    console.info(`[marcar:chat] org=${org} status=${status} ms=${Date.now() - inicio} acoes=${acoes}`)

  try {
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
      throw new ApiError("INVALID_JSON", "Envie um JSON.")
    }
    if (!origemValida(req)) throw new ApiError("FORBIDDEN", "Origem não permitida.")

    const { slug } = await ctx.params
    const db = createAdminClient<Database>()
    const { data: organizacao, error } = await db
      .from("organizations")
      .select("id, name, slug, is_demo")
      .eq("slug", slug)
      .maybeSingle()

    if (error) {
      console.error("[marcar:chat] erro ao resolver a org:", error.message)
      throw internalError()
    }
    if (!organizacao) throw new ApiError("NOT_FOUND", "Página não encontrada.")

    org = organizacao.id

    if (!(await chatWebAtivo(db, org))) throw new ApiError("ADDON_INACTIVE", "O chat não está disponível.")

    await consumirLimiteWeb(db, { org, sess, ip: getClientIp(req) })

    let bruto: unknown

    try {
      bruto = await req.json()
    } catch {
      throw new ApiError("INVALID_JSON", "Corpo da requisição não é um JSON válido.")
    }

    const corpo = ChatWebBody.safeParse(bruto)

    if (!corpo.success) throw validation("Dados inválidos.", zodDetails(corpo.error))

    const resposta = await perguntarAoAtendente({ org, sess, ...corpo.data })

    if (!resposta.ok) {
      registrar(resposta.motivo)
      const erro = new ApiError("ATENDENTE_UNAVAILABLE", "O atendente não respondeu.")

      return jsonResponse(corpoDeErro(erro, requestId), erro.status, requestId, cookie)
    }

    acoes = resposta.dados.acoes.length
    registrar("ok")

    return jsonResponse(corpoDeSucesso({ data: resposta.dados }), 200, requestId, cookie)
  } catch (error) {
    const apiError = paraApiError(error) ?? internalError()

    registrar(apiError.code)

    return jsonResponse(corpoDeErro(apiError, requestId), apiError.status, requestId, { ...apiError.headers, ...cookie })
  }
}
