import { createHash, randomUUID } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import type { Database } from "@/utils/database.types"
import { consumeRateLimit, getClientIp, hashIdentifier } from "@/lib/demo/rate-limit"
import { listarServicosAtivos } from "@/lib/domain/catalogo"
import { ApiError, internalError } from "@/lib/http/erros"
import { corpoDeErro, jsonResponse } from "@/lib/http/resposta"
import { HEADER_REQUEST_ID } from "@/contracts/comum/envelope"
import {
  CatalogoPublicoResposta,
  LIMITE_SERVICOS_PUBLICOS,
  type CatalogoPublico,
} from "@/contracts/publico/catalogo"

/**
 * GET /api/public/v1/orgs/{slug}/catalogo — catálogo público da org, sem
 * autenticação (docs/API_PUBLICA.md). Mesma fonte de /marcar/[slug]: a org é
 * resolvida pelo slug e o domínio lista os serviços ativos dela.
 *
 * Não usa `criarRota`: aqui não há autenticador nem auditoria (nada de IP ou
 * user-agent persistido), e a resposta precisa de CORS, Cache-Control e ETag.
 */

export const dynamic = "force-dynamic" // quem cacheia é o Cache-Control, não o Next

const JANELA = { windowMs: 60_000, max: 120 } // por IP (hash), mesmo contador do /api/demo
const CACHE = "public, max-age=30, stale-while-revalidate=300"
const SLUG = /^[a-z0-9-]{1,60}$/

/** LP_PUBLIC_ORIGINS=https://deborahpereira.com.br,https://www.deborahpereira.com.br */
function origensPermitidas(): string[] {
  return (process.env.LP_PUBLIC_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Origem fora da lista = sem cabeçalho CORS (o navegador bloqueia a leitura). Nunca "*". */
function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin")
  const headers: Record<string, string> = { Vary: "Origin" }

  if (origin && origensPermitidas().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "If-None-Match"
    headers["Access-Control-Expose-Headers"] = `ETag, ${HEADER_REQUEST_ID}`
    headers["Access-Control-Max-Age"] = "86400"
  }

  return headers
}

/** Slug inexistente e mal formado têm a mesma resposta: não dá para enumerar orgs. */
const naoEncontrada = () => new ApiError("NOT_FOUND", "Organização não encontrada.")

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const requestId = randomUUID()
  const falhar = (error: ApiError) =>
    jsonResponse(corpoDeErro(error, requestId), error.status, requestId, { ...cors(req), ...error.headers })

  try {
    const { slug } = await params
    if (!SLUG.test(slug)) return falhar(naoEncontrada())

    const db = createAdminClient<Database>()

    // Falha do contador nega (fail-closed), como no /api/demo.
    const limite = await consumeRateLimit(db, hashIdentifier("lpcat", getClientIp(req)), JANELA)
    if (!limite.allowed) {
      return falhar(
        new ApiError("RATE_LIMITED", "Muitas requisições. Tente novamente em instantes.", undefined, {
          "Retry-After": String(limite.retryAfterSeconds ?? 60),
        })
      )
    }

    // Colunas explícitas: só o que /marcar/[slug] já mostra.
    const { data: org, error: erroOrg } = await db
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle()

    if (erroOrg) throw erroOrg
    if (!org?.slug) return falhar(naoEncontrada())

    const servicos = await listarServicosAtivos(db, org.id)

    const dados: CatalogoPublico = {
      organizacao: { nome: org.name, slug: org.slug },
      servicos: servicos.slice(0, LIMITE_SERVICOS_PUBLICOS).map((s) => ({
        id: s.id,
        nome: s.titulo,
        descricao: s.descricao?.trim() ? s.descricao : null,
        duracaoMinutos: s.duracaoMinutos,
        preco: s.preco ?? null,
        categoria: null,
      })),
      atualizadoEm: new Date().toISOString(),
    }

    // Contrato estrito: campo a mais ou valor fora do schema é bug nosso -> 500, não vazamento.
    const corpo = CatalogoPublicoResposta.safeParse({ data: dados })
    if (!corpo.success) {
      console.error("[api:public] catálogo fora do contrato:", { requestId, issues: corpo.error.issues })
      return falhar(internalError())
    }

    // ETag do CONTEÚDO (sem atualizadoEm, que muda a cada consulta): inalterado -> 304.
    const etag = `"${createHash("sha256")
      .update(JSON.stringify({ o: dados.organizacao, s: dados.servicos }))
      .digest("hex")
      .slice(0, 32)}"`
    const headers = { ...cors(req), "Cache-Control": CACHE, ETag: etag }

    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ...headers, [HEADER_REQUEST_ID]: requestId } })
    }

    return jsonResponse(corpo.data, 200, requestId, headers)
  } catch (error) {
    console.error("[api:public] erro inesperado:", { requestId, error })
    return falhar(internalError())
  }
}
