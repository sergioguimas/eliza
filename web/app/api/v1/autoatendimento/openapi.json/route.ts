import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { tokenDeServicoValido } from "@/lib/autoatendimento/autenticar"
import { ApiError } from "@/lib/http/erros"
import { corpoDeErro, jsonResponse } from "@/lib/http/resposta"
import { gerarOpenApiAutoatendimento } from "@/lib/openapi"
import { docsInternasLiberadas, origemDaRequisicao } from "@/lib/openapi/acesso"

/**
 * OpenAPI 3.1 da API de Autoatendimento. É documentação, então não passa pela
 * autenticação do ticket (rota própria), mas descreve uma API interna: fora de
 * desenvolvimento só responde com API_DOCS_INTERNAS=true ou com o token de
 * serviço do atendente (o sola-agens lê a spec no boot); senão, 404 no envelope
 * (token errado também é 404, para não confirmar que a rota existe).
 */
export async function GET(req: NextRequest) {
  if (!docsInternasLiberadas() && !tokenDeServicoValido(req)) {
    const requestId = randomUUID()

    return jsonResponse(corpoDeErro(new ApiError("NOT_FOUND", "Recurso não encontrado."), requestId), 404, requestId)
  }

  return Response.json(gerarOpenApiAutoatendimento({ origem: origemDaRequisicao(req) }), {
    headers: { "Cache-Control": "no-store" },
  })
}
