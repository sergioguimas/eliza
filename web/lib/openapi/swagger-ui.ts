/**
 * Página do Swagger UI. Os assets vêm do jsDelivr em versão FIXA, com SRI
 * (sha384 do conteúdo de swagger-ui-dist@5.17.14). Para atualizar: trocar a
 * versão e recalcular os três hashes (curl <url> | openssl dgst -sha384 -binary | openssl base64 -A).
 */
const VERSAO = "5.17.14"
const BASE = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${VERSAO}`

const SRI = {
  css: "sha384-wxLW6kwyHktdDGr6Pv1zgm/VGJh99lfUbzSn6HNHBENZlCN7W602k9VkGdxuFvPn",
  bundle: "sha384-wmyclcVGX/WhUkdkATwhaK1X1JtiNrr2EoYJ+diV3vj4v6OC5yCeSu+yW13SYJep",
  preset: "sha384-2YH8WDRaj7V2OqU/trsmzSagmk/E2SutiCsGkdgoQwC9pNUJV1u/141DHB6jgs8t",
} as const

export const SPEC_V1 = "/api/v1/openapi.json"
export const SPEC_AUTOATENDIMENTO = "/api/v1/autoatendimento/openapi.json"

export const CSP_DA_PAGINA = (nonce: string) =>
  [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    "style-src 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https://cdn.jsdelivr.net",
    "font-src https://cdn.jsdelivr.net data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

export function paginaSwagger({ nonce, comAutoatendimento }: { nonce: string; comAutoatendimento: boolean }) {
  const urls = [
    { url: SPEC_V1, name: "API v1 (integração B2B)" },
    ...(comAutoatendimento ? [{ url: SPEC_AUTOATENDIMENTO, name: "Autoatendimento (interna)" }] : []),
  ]

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Eliza — API</title>
  <link rel="stylesheet" href="${BASE}/swagger-ui.css" integrity="${SRI.css}" crossorigin="anonymous">
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${BASE}/swagger-ui-bundle.js" integrity="${SRI.bundle}" crossorigin="anonymous"></script>
  <script src="${BASE}/swagger-ui-standalone-preset.js" integrity="${SRI.preset}" crossorigin="anonymous"></script>
  <script nonce="${nonce}">
    window.ui = SwaggerUIBundle({
      dom_id: "#swagger-ui",
      urls: ${JSON.stringify(urls)},
      "urls.primaryName": ${JSON.stringify(urls[0].name)},
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      persistAuthorization: true,
      tryItOutEnabled: true,
      deepLinking: true,
      displayRequestDuration: true,
      docExpansion: "list",
    })
  </script>
</body>
</html>
`
}
