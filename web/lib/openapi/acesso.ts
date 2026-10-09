import type { NextRequest } from "next/server"

/**
 * A documentação do Autoatendimento descreve uma API interna entre o Eliza e o
 * atendente: só aparece em desenvolvimento ou quando o operador liga a flag.
 * A v1 (B2B) é pública.
 */
export function docsInternasLiberadas() {
  return process.env.NODE_ENV !== "production" || process.env.API_DOCS_INTERNAS === "true"
}

/**
 * Origem da própria requisição, para `servers[0].url`. Atrás do proxy
 * (Traefik) o host de `req.url` é o interno, então os headers `x-forwarded-*` vêm primeiro.
 */
export function origemDaRequisicao(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host")
  const protocolo = req.headers.get("x-forwarded-proto")?.split(",")[0].trim()

  if (!host) return req.nextUrl.origin

  const esquema = protocolo === "http" || protocolo === "https" ? protocolo : req.nextUrl.protocol.replace(":", "")

  return `${esquema}://${host}`
}
