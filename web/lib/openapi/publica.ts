import { ApiErrorBody, ErrorCode } from "@/contracts/api-v1"
import { CatalogoPublicoResposta, LIMITE_SERVICOS_PUBLICOS, ServicoPublico } from "@/contracts/publico/catalogo"
import { HEADERS_COMUNS, ID_EXEMPLO, respostasDeErro, type ErroDaRota } from "./comum"
import { Componentes, anotar } from "./esquemas"
import type { OpcoesDoDocumento } from "./v1"

type Objeto = Record<string, unknown>

const CACHE = "public, max-age=30, stale-while-revalidate=300"

const ERROS_DA_ROTA: ErroDaRota[] = [
  ["NOT_FOUND", "Slug inexistente ou fora de `^[a-z0-9-]{1,60}$`. As duas situações têm a mesma resposta: não dá para enumerar organizações."],
  ["RATE_LIMITED", "Mais de 120 requisições por minuto vindas do mesmo IP."],
  "INTERNAL_ERROR",
]

const DESCRICAO_GERAL = `
API **pública e somente leitura** para sites estáticos de clientes do Eliza (ex.: landing page) mostrarem serviços,
preços e durações direto do cadastro, sem token. Devolve só o que a página de agendamento \`/marcar/{slug}\` já exibe:
nunca \`organization_id\`, cor, profissional, cliente ou agenda.

## Sem autenticação

Não há API key, cookie nem ticket. Por isso a resposta é restrita e a rota é limitada por IP.

## Formato

Sucesso: \`{ "data": { organizacao, servicos, atualizadoEm } }\`. Erro: \`{ "error": { "code", "message", "request_id" } }\`.
Todo response traz \`X-Request-Id\`.

- \`servicos\`: só os ativos, ordenados por título, no máximo ${LIMITE_SERVICOS_PUBLICOS}.
- \`preco\`: em reais; \`null\` = não divulgar; \`0\` continua \`0\` (quem consome decide como exibir, por exemplo "Consulte").
- \`categoria\`: texto livre definido no painel (até 40 caracteres), \`null\` = sem grupo. Serviços com a mesma categoria
  devem aparecer juntos.
- \`atualizadoEm\`: instante da **consulta**, não da edição.

## CORS

Só as origens listadas em \`LP_PUBLIC_ORIGINS\` (comparação exata) recebem \`Access-Control-Allow-Origin\`; nunca \`*\`.
Origem fora da lista recebe a resposta sem o cabeçalho, e o navegador bloqueia a leitura. \`OPTIONS\` responde \`204\`.

## Cache

\`Cache-Control: ${CACHE}\`. A resposta traz \`ETag\` do conteúdo (sem \`atualizadoEm\`); reenvie-o em
\`If-None-Match\` e, se nada mudou, a resposta é \`304\` sem corpo.

## Limite

120 requisições por minuto por IP (\`429 RATE_LIMITED\` com \`Retry-After\`).

## Agendar

A API não cria agendamento. O botão da página leva o cliente a \`/marcar/{slug}\`; \`?servico={id}\` já abre com o
serviço escolhido (id inválido é ignorado).
`.trim()

export function gerarOpenApiPublica({ origem }: OpcoesDoDocumento): Objeto {
  const c = new Componentes()

  const erroRef = c.registrar("output", "ErrorBody", ApiErrorBody)
  c.registrar("output", "ErrorCode", ErrorCode)
  c.registrar("output", "ServicoPublico", ServicoPublico)
  const respCatalogo = c.registrar("output", "CatalogoPublicoResposta", CatalogoPublicoResposta)

  const componentes = c.componentes()

  anotar(componentes, "ServicoPublico", {
    id: "Id do serviço. Serve de `?servico=` no link de agendamento.",
    nome: "Título do serviço.",
    descricao: "Observações do serviço (até 500 caracteres); `null` quando vazia.",
    duracaoMinutos: "Duração em minutos (30 quando o cadastro está sem duração).",
    preco: "Em reais. `null` = não divulgar. `0` continua `0`. Com `precoAPartirDe`, é o valor mínimo.",
    precoAPartirDe: "`true` = preço \"a partir de\": o valor final é combinado no atendimento. Sempre presente.",
    categoria: "Agrupamento opcional (até 40 caracteres); `null` = sem grupo.",
  })

  const erros = respostasDeErro(ERROS_DA_ROTA, erroRef)

  // O exemplo genérico de NOT_FOUND fala de agendamento; aqui o recurso é a organização.
  const exemploNaoEncontrada = (
    erros["404"] as { content: { "application/json": { examples: { NOT_FOUND: { value: { error: { message: string } } } } } } }
  ).content["application/json"].examples.NOT_FOUND.value.error
  exemploNaoEncontrada.message = "Organização não encontrada."

  const cabecalhosOk = {
    "X-Request-Id": { $ref: "#/components/headers/XRequestId" },
    ETag: { $ref: "#/components/headers/ETag" },
    "Cache-Control": { $ref: "#/components/headers/CacheControl" },
    "Access-Control-Allow-Origin": { $ref: "#/components/headers/AccessControlAllowOrigin" },
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Eliza — API pública (sites)",
      version: "1.0.0",
      summary: "Catálogo de serviços de uma organização, sem autenticação, para sites dos clientes.",
      description: DESCRICAO_GERAL,
    },
    servers: [{ url: origem, description: "Este ambiente" }],
    tags: [{ name: "Catálogo", description: "Serviços ativos de uma organização." }],
    security: [],
    paths: {
      "/api/public/v1/orgs/{slug}/catalogo": {
        get: {
          tags: ["Catálogo"],
          operationId: "obterCatalogoPublico",
          summary: "Catálogo público da organização",
          description:
            `Serviços ativos da organização, com nome, descrição, duração, preço e categoria. Sem autenticação.\n\n` +
            `**CORS:** só as origens de \`LP_PUBLIC_ORIGINS\` recebem \`Access-Control-Allow-Origin\`.\n\n` +
            `**Cache:** \`${CACHE}\`; use \`ETag\` com \`If-None-Match\` para receber \`304\`.`,
          security: [],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              description: "Slug da organização (`^[a-z0-9-]{1,60}$`).",
              schema: { type: "string", pattern: "^[a-z0-9-]{1,60}$" },
              example: "admin",
            },
            {
              name: "If-None-Match",
              in: "header",
              required: false,
              description: "`ETag` recebido antes. Se o conteúdo não mudou, a resposta é `304`.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Catálogo da organização.",
              headers: cabecalhosOk,
              content: {
                "application/json": {
                  schema: respCatalogo,
                  examples: {
                    exemplo: {
                      summary: "Dois serviços, um agrupado",
                      value: {
                        data: {
                          organizacao: { nome: "Studio Exemplo", slug: "studio-exemplo" },
                          servicos: [
                            { id: ID_EXEMPLO.servico, nome: "Alongamento em fibra", descricao: null, duracaoMinutos: 120, preco: 180, precoAPartirDe: true, categoria: "Alongamento" },
                            { id: "9b2e4d18-6a3c-4f71-8e05-d3c1a7b92f46", nome: "Esmaltação", descricao: "Inclui cuticulagem", duracaoMinutos: 45, preco: 0, precoAPartirDe: false, categoria: null },
                          ],
                          atualizadoEm: "2026-10-19T14:06:43.454Z",
                        },
                      },
                    },
                  },
                },
              },
            },
            "304": {
              description: "Conteúdo igual ao do `ETag` enviado em `If-None-Match`. Sem corpo.",
              headers: {
                "X-Request-Id": { $ref: "#/components/headers/XRequestId" },
                ETag: { $ref: "#/components/headers/ETag" },
                "Cache-Control": { $ref: "#/components/headers/CacheControl" },
              },
            },
            ...erros,
          },
        },
      },
    },
    components: {
      headers: {
        ...HEADERS_COMUNS,
        ETag: {
          description: "Hash do conteúdo (sem `atualizadoEm`). Reenvie em `If-None-Match`.",
          schema: { type: "string" },
        },
        CacheControl: {
          description: "Política de cache da resposta.",
          schema: { type: "string", const: CACHE },
        },
        AccessControlAllowOrigin: {
          description: "Presente só quando a origem da requisição está em `LP_PUBLIC_ORIGINS`; repete a origem.",
          schema: { type: "string" },
        },
      },
      schemas: componentes,
    },
  }
}
