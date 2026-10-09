import { randomBytes } from "node:crypto"
import { docsInternasLiberadas } from "@/lib/openapi/acesso"
import { CSP_DA_PAGINA, paginaSwagger } from "@/lib/openapi/swagger-ui"

/**
 * Swagger UI das APIs do Eliza. O seletor de specs só inclui o Autoatendimento
 * quando a spec dele também é servida (desenvolvimento ou API_DOCS_INTERNAS=true).
 */
export async function GET() {
  const nonce = randomBytes(16).toString("base64")
  const html = paginaSwagger({ nonce, comAutoatendimento: docsInternasLiberadas() })

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": CSP_DA_PAGINA(nonce),
      "X-Content-Type-Options": "nosniff",
    },
  })
}
