import type { NextRequest } from "next/server"
import { gerarOpenApiV1 } from "@/lib/openapi"
import { origemDaRequisicao } from "@/lib/openapi/acesso"

/** OpenAPI 3.1 da API v1 (B2B). Público: é documentação, não dá acesso a dado. */
export async function GET(req: NextRequest) {
  return Response.json(gerarOpenApiV1({ origem: origemDaRequisicao(req) }), {
    headers: { "Cache-Control": "no-store" },
  })
}
