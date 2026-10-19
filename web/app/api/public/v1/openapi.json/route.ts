import type { NextRequest } from "next/server"
import { gerarOpenApiPublica } from "@/lib/openapi"
import { origemDaRequisicao } from "@/lib/openapi/acesso"

/** OpenAPI 3.1 da API pública (sites). Público: é documentação, não dá acesso a dado. */
export async function GET(req: NextRequest) {
  return Response.json(gerarOpenApiPublica({ origem: origemDaRequisicao(req) }), {
    headers: { "Cache-Control": "no-store" },
  })
}
