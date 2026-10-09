import { HTTP_STATUS_BY_CODE, type ErrorCode } from "@/contracts/comum/envelope"
import type { Ref } from "./esquemas"

type Objeto = Record<string, unknown>

/** O que cada código significa para quem consome. Texto das regras: docs/contratos/*. */
export const SIGNIFICADO_DO_CODIGO: Record<ErrorCode, string> = {
  INVALID_JSON: "O corpo da requisição não é um JSON válido.",
  VERSION_MISMATCH: "O header X-Autoatendimento-Versao não é `1`.",
  UNAUTHORIZED: "Credencial ausente, malformada, desconhecida, revogada ou expirada.",
  TICKET_MISSING: "Falta o header X-Autoatendimento-Ticket.",
  TICKET_INVALID: "Ticket com forma ou assinatura inválida.",
  TICKET_EXPIRED: "Ticket vencido (vale 30 minutos). Use o da mensagem mais recente do cliente.",
  FORBIDDEN: "A chave não tem o escopo exigido pela rota.",
  ORGANIZATION_SUSPENDED: "Organização suspensa ou demo.",
  PLAN_REQUIRED: "O plano da organização não inclui acesso à API.",
  ADDON_INACTIVE: "O atendimento automático não está ativo para o estabelecimento (ou a instância de WhatsApp mudou).",
  NOT_FOUND: "Recurso inexistente ou de outro tenant/cliente. A API nunca diferencia os dois casos.",
  CONFLICT: "Conflito genérico de estado.",
  SLOT_UNAVAILABLE: "Horário ocupado, fora do expediente, já passado ou perdido numa corrida. `details` traz `{ motivo, sugestoes }`.",
  INVALID_TRANSITION: "Operação não permitida no status atual do agendamento.",
  CUSTOMER_AMBIGUOUS: "Mais de um cadastro casa com os dados enviados.",
  CUSTOMER_CONFLICT: "O documento ou telefone já pertence a outro cadastro.",
  CUSTOMER_NOT_IDENTIFIED: "O telefone do ticket não tem cadastro. Crie-o em POST /cadastro.",
  ACTIVE_LIMIT_REACHED: "O cliente já tem o máximo de agendamentos ativos permitido pelo estabelecimento.",
  VALIDATION_ERROR: "Body, query ou parâmetro inválido. `details` é `[{ field, message }]`.",
  OUT_OF_WINDOW: "Data fora da janela [hoje, hoje + janela máxima].",
  NOTICE_TOO_SHORT: "Menos tempo do que a antecedência mínima do estabelecimento.",
  RATE_LIMITED: "Limite de requisições excedido. Veja o header Retry-After e `details.retry_after_seconds`.",
  WHATSAPP_UNAVAILABLE: "Não foi possível enviar pelo WhatsApp agora.",
  INTERNAL_ERROR: "Erro inesperado. O detalhe fica só no log do servidor; informe o request_id ao suporte.",
}

const MENSAGEM_DE_EXEMPLO: Partial<Record<ErrorCode, string>> = {
  INVALID_JSON: "Corpo da requisição não é um JSON válido.",
  UNAUTHORIZED: "API key ausente ou inválida.",
  FORBIDDEN: 'A chave não tem o escopo "write".',
  ORGANIZATION_SUSPENDED: "Organização indisponível para uso da API.",
  PLAN_REQUIRED: "O plano da organização não inclui acesso à API",
  NOT_FOUND: "Agendamento não encontrado.",
  SLOT_UNAVAILABLE: "Este horário já está ocupado.",
  INVALID_TRANSITION: "Agendamento concluído não pode voltar a agendado.",
  CUSTOMER_AMBIGUOUS: "Há mais de um cadastro com esses dados; informe o cliente.",
  CUSTOMER_CONFLICT: "Já existe um cadastro com esses dados.",
  VALIDATION_ERROR: "Dados inválidos.",
  RATE_LIMITED: "Limite de requisições excedido. Tente novamente em instantes.",
  INTERNAL_ERROR: "Erro interno.",
  VERSION_MISMATCH: "Versão do contrato incompatível. Envie o header X-Autoatendimento-Versao: 1.",
  TICKET_MISSING: "Ticket da conversa ausente.",
  TICKET_INVALID: "Ticket da conversa inválido.",
  TICKET_EXPIRED: "O ticket da conversa expirou. Use o da mensagem mais recente do cliente.",
  ADDON_INACTIVE: "O atendimento automático não está disponível para este estabelecimento no momento.",
  CUSTOMER_NOT_IDENTIFIED: "Este número de WhatsApp ainda não tem cadastro.",
  ACTIVE_LIMIT_REACHED: "Você já tem 3 agendamentos ativos, que é o máximo permitido. Cancele ou conclua um deles antes de marcar outro.",
  OUT_OF_WINDOW: "Só é possível agendar de hoje até 60 dias à frente.",
  NOTICE_TOO_SHORT: "É preciso marcar com pelo menos 2 horas de antecedência.",
  WHATSAPP_UNAVAILABLE: "Não foi possível enviar a mensagem pelo WhatsApp agora. Tente novamente em instantes.",
}

const DETALHES_DE_EXEMPLO: Partial<Record<ErrorCode, unknown>> = {
  VALIDATION_ERROR: [{ field: "start_time", message: "Invalid input: expected string, received undefined" }],
  SLOT_UNAVAILABLE: { motivo: "ocupado", sugestoes: ["15:00", "15:30", "16:00"] },
  RATE_LIMITED: { retry_after_seconds: 42 },
}

export const ID_EXEMPLO = {
  servico: "7d0c3a52-1b44-4f6e-9a1e-5c2b8e9f0a11",
  profissional: "3f9a1c77-52de-4b08-8c3d-1e6a7b4d9f20",
  cliente: "b1e4d6a0-93c2-4f57-a8d1-0c7e5f2a3b64",
  agendamento: "e5a8c2f1-47b9-4d36-b0a2-9d1f6c3e8a75",
  organizacao: "0a6f2d94-8c15-4e7b-93da-4b1c8e5f7a02",
  requisicao: "c9f1b3a7-2e48-4d05-a6b9-7f3e1d8c5a40",
} as const

/** Exemplos de um código de erro no envelope único. */
function exemploDeErro(codigo: ErrorCode) {
  const detalhes = DETALHES_DE_EXEMPLO[codigo]

  return {
    summary: codigo,
    value: {
      error: {
        code: codigo,
        message: MENSAGEM_DE_EXEMPLO[codigo] ?? SIGNIFICADO_DO_CODIGO[codigo],
        ...(detalhes !== undefined ? { details: detalhes } : {}),
        request_id: ID_EXEMPLO.requisicao,
      },
    },
  }
}

/** Um código, ou um código com o texto que vale nesta rota. */
export type ErroDaRota = ErrorCode | readonly [ErrorCode, string]

/**
 * `responses` de erro: um item por status HTTP, com os códigos possíveis
 * naquela rota na descrição e um exemplo por código. O status vem sempre de
 * HTTP_STATUS_BY_CODE (fonte única, contracts/comum/envelope.ts).
 */
export function respostasDeErro(erros: readonly ErroDaRota[], erroRef: Ref): Record<string, Objeto> {
  const porStatus = new Map<number, Array<{ codigo: ErrorCode; texto: string }>>()

  for (const erro of erros) {
    const [codigo, texto] = typeof erro === "string" ? [erro, SIGNIFICADO_DO_CODIGO[erro]] : erro
    const status = HTTP_STATUS_BY_CODE[codigo]
    const lista = porStatus.get(status) ?? []

    if (!lista.some((item) => item.codigo === codigo)) lista.push({ codigo, texto })

    porStatus.set(status, lista)
  }

  const respostas: Record<string, Objeto> = {}

  for (const [status, lista] of [...porStatus.entries()].sort(([a], [b]) => a - b)) {
    respostas[String(status)] = {
      description: lista.map(({ codigo, texto }) => `- \`${codigo}\`: ${texto}`).join("\n"),
      headers: {
        "X-Request-Id": { $ref: "#/components/headers/XRequestId" },
        ...(status === 429 ? { "Retry-After": { $ref: "#/components/headers/RetryAfter" } } : {}),
      },
      content: {
        "application/json": {
          schema: erroRef,
          examples: Object.fromEntries(lista.map(({ codigo }) => [codigo, exemploDeErro(codigo)])),
        },
      },
    }
  }

  return respostas
}

export const HEADERS_COMUNS = {
  XRequestId: {
    description: "Id da requisição. É o mesmo `request_id` do corpo de erro e do log de auditoria; informe-o ao pedir suporte.",
    schema: { type: "string", format: "uuid" },
  },
  RetryAfter: {
    description: "Segundos até a janela do limite liberar nova tentativa.",
    schema: { type: "integer", minimum: 1 },
  },
} as const

/** Resposta de sucesso com o header de rastreio. */
export function respostaOk(descricao: string, schema: Ref, exemplos?: Record<string, { summary: string; value: unknown }>): Objeto {
  return {
    description: descricao,
    headers: { "X-Request-Id": { $ref: "#/components/headers/XRequestId" } },
    content: { "application/json": { schema, ...(exemplos ? { examples: exemplos } : {}) } },
  }
}

export function corpoJson(schema: Ref, exemplos: Record<string, { summary: string; value: unknown }>, obrigatorio = true): Objeto {
  return { required: obrigatorio, content: { "application/json": { schema, examples: exemplos } } }
}

/** Parâmetro `{id}` de path. */
export function parametroId(descricao: string): Objeto {
  return { name: "id", in: "path", required: true, description: descricao, schema: { type: "string", format: "uuid" }, example: ID_EXEMPLO.agendamento }
}
