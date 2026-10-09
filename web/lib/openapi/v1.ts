import { z } from "zod"
import {
  Appointment,
  AppointmentStatus,
  ApiScope,
  Availability,
  AvailabilityMeta,
  AvailabilityQuery,
  CancelBody,
  ConfirmBody,
  CreateAppointmentBody,
  Customer,
  CustomerInput,
  CustomersQuery,
  ListAppointmentsQuery,
  LogsQuery,
  Me,
  NotifyMeta,
  PageMeta,
  PaymentBody,
  PaymentStatus,
  Professional,
  RequestLog,
  Service,
  SlotReason,
  StatusBody,
  UpdateAppointmentBody,
  ApiErrorBody,
  ErrorCode,
  apiSuccess,
} from "@/contracts/api-v1"
import {
  HEADERS_COMUNS,
  ID_EXEMPLO,
  corpoJson,
  parametroId,
  respostaOk,
  respostasDeErro,
  type ErroDaRota,
} from "./comum"
import { Componentes, anotar, parametrosDeQuery } from "./esquemas"

type Objeto = Record<string, unknown>

// ------------------------------------------------------------------ exemplos (dados fictícios)

const agendamento = {
  id: ID_EXEMPLO.agendamento,
  status: "scheduled",
  start_time: "2026-10-05T17:30:00.000Z",
  end_time: "2026-10-05T18:00:00.000Z",
  start_local: "2026-10-05T14:30",
  end_local: "2026-10-05T15:00",
  customer: { id: ID_EXEMPLO.cliente, name: "Maria Exemplo", phone: "5511900000001" },
  service: { id: ID_EXEMPLO.servico, title: "Corte de cabelo", duration_minutes: 30 },
  professional: { id: ID_EXEMPLO.profissional, name: "Ana Profissional" },
  price: 60,
  payment_status: "pending",
  payment_method: null,
  paid_at: null,
  notes: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: null,
}

const metaSemAviso = { notified: false }

// ------------------------------------------------------------------ erros por rota

const ERROS_DA_CHAVE: ErroDaRota[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "ORGANIZATION_SUSPENDED",
  "PLAN_REQUIRED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]

const ERRO_DE_ID: ErroDaRota = ["NOT_FOUND", "Agendamento inexistente, de outro tenant ou `{id}` que não é UUID."]

const ERRO_DE_TRANSICAO: ErroDaRota = [
  "INVALID_TRANSITION",
  "Transição fora da máquina de status, ou agendamento alterado por outra requisição no meio.",
]

// ------------------------------------------------------------------ texto

const DESCRICAO_GERAL = `
API para o **tenant integrar o próprio sistema** ao Eliza: consultar o catálogo, ver horários livres e criar,
remarcar, confirmar, cancelar e dar baixa de pagamento em agendamentos. É a API pública (B2B); o atendente de
WhatsApp usa outra, a de Autoatendimento, que não está neste documento.

## Autenticação

Uma **API key por tenant**, gerada em *Configurações → API* (somente owner/admin), enviada em todo request:

\`\`\`
Authorization: Bearer elz_live_xxxxxxxxxxxxxxxx
\`\`\`

- O tenant é **sempre** o da chave. Nenhuma rota aceita \`organization_id\`. Recurso de outro tenant responde \`404\`.
- A chave aparece em claro uma única vez. Máx. 10 chaves ativas por tenant; revogar é imediato.
- A API é recurso de plano: sem acesso, \`403 PLAN_REQUIRED\`.

### Escopos

| Escopo | Libera |
|---|---|
| \`read\` | Todos os \`GET\` |
| \`write\` | Criar, editar, confirmar, cancelar e mudar status de agendamentos |
| \`payments\` | **Só** \`POST /appointments/{id}/payment\`. \`write\` não basta para dar baixa |

Cada operação traz o escopo exigido em **Escopo exigido**. Sem o escopo: \`403 FORBIDDEN\`.

## Formato

Sucesso: \`{ "data": ..., "meta": ... }\`. Erro: \`{ "error": { "code", "message", "details?", "request_id" } }\`.
Todo response traz \`X-Request-Id\` (o mesmo \`request_id\` do corpo e do log) e \`Cache-Control: no-store\`.
\`message\` vem em português, pronta para exibir; \`details\` depende do código.

Ordem das checagens: header, chave, revogada/expirada, escopo, organização, plano, rate limit, body, regra de negócio.
A primeira que falha responde.

**Limite:** 120 requisições por minuto por chave (\`429 RATE_LIMITED\` com \`Retry-After\`).

## Datas e horas

- Entrada: \`"2026-10-05T14:30"\` é relógio de **São Paulo**. Também aceita ISO 8601 com \`Z\` ou offset.
- Saída: \`start_time\`/\`end_time\` em UTC e \`start_local\`/\`end_local\` em São Paulo (\`AAAA-MM-DDTHH:mm\`).
- Datas puras (\`AAAA-MM-DD\`) são o dia no relógio de São Paulo.

## Notificação por WhatsApp (\`notify\`)

As escritas aceitam \`notify\` (padrão \`false\`). Com \`true\`, o Eliza avisa o cliente pelo WhatsApp **do tenant**, mas
só se o cliente **já existia** antes do request (por \`customer_id\` ou cadastro reaproveitado) e tem telefone, com
teto de **60 envios por hora por organização**. Se a mensagem não sai, a operação acontece do mesmo jeito e
\`meta.notify_skipped\` diz o motivo: \`new_customer\`, \`org_limit\`, \`no_phone\` ou \`send_failed\`. Toda escrita
devolve \`meta.notified\`.

## Máquina de status

\`pending → scheduled | confirmed | canceled\` · \`scheduled → confirmed | arrived | completed | no_show | canceled\` ·
\`confirmed → arrived | completed | no_show | canceled\` · \`arrived → completed | canceled\`.

\`completed\`, \`canceled\` e \`no_show\` são finais (só \`completed\` ainda recebe pagamento). \`no_show\` só vale depois do
horário de início e nunca a partir de \`arrived\`. Fora da tabela: \`409 INVALID_TRANSITION\`. Repetir o status atual é
idempotente (200, sem novo log). Não existe \`DELETE\` de agendamento (responde \`405\`): para tirar um horário, cancele.

## Auditoria

Toda requisição com chave válida é gravada (chave, rota, status, latência, IP). **Body e query string não são
gravados.** Consulte os seus em \`GET /logs\`.
`.trim()

// ------------------------------------------------------------------ gerador

export type OpcoesDoDocumento = {
  /** Origem da própria requisição (ex.: https://eliza.solasoftware.com.br). Vira `servers[0].url`. */
  origem: string
}

export function gerarOpenApiV1({ origem }: OpcoesDoDocumento): Objeto {
  const c = new Componentes()

  // --- enums e blocos compartilhados (nas duas direções)
  c.registrarNosDois("AppointmentStatus", AppointmentStatus)
  c.registrarNosDois("PaymentStatus", PaymentStatus)
  c.registrarNosDois("ApiScope", ApiScope)
  c.registrar("input", "CustomerInput", CustomerInput)

  // --- saída
  const erroRef = c.registrar("output", "ErrorBody", ApiErrorBody)
  c.registrar("output", "ErrorCode", ErrorCode)
  c.registrar("output", "Appointment", Appointment)
  c.registrar("output", "Availability", Availability)
  c.registrar("output", "Service", Service)
  c.registrar("output", "Professional", Professional)
  c.registrar("output", "Customer", Customer)
  c.registrar("output", "RequestLog", RequestLog)
  c.registrar("output", "SlotReason", SlotReason)
  c.registrar("output", "NotifyMeta", NotifyMeta)
  c.registrar("output", "PageMeta", PageMeta)
  c.registrar("output", "AvailabilityMeta", AvailabilityMeta)

  const respMe = c.registrar("output", "MeResponse", apiSuccess(Me))
  const respServicos = c.registrar("output", "ServicesResponse", apiSuccess(z.array(Service)))
  const respProfissionais = c.registrar("output", "ProfessionalsResponse", apiSuccess(z.array(Professional)))
  const respDisponibilidade = c.registrar("output", "AvailabilityResponse", apiSuccess(Availability, AvailabilityMeta))
  const respClientes = c.registrar("output", "CustomersResponse", apiSuccess(z.array(Customer)))
  const respLista = c.registrar("output", "AppointmentListResponse", apiSuccess(z.array(Appointment), PageMeta))
  const respAgendamento = c.registrar("output", "AppointmentResponse", apiSuccess(Appointment, NotifyMeta))
  const respAgendamentoSemMeta = c.registrar("output", "AppointmentPaymentResponse", apiSuccess(Appointment))
  const respLogs = c.registrar("output", "LogsResponse", apiSuccess(z.array(RequestLog), PageMeta))

  // --- entrada
  const bodyCriar = c.registrar("input", "CreateAppointmentBody", CreateAppointmentBody)
  const bodyEditar = c.registrar("input", "UpdateAppointmentBody", UpdateAppointmentBody)
  const bodyConfirmar = c.registrar("input", "ConfirmBody", ConfirmBody)
  const bodyCancelar = c.registrar("input", "CancelBody", CancelBody)
  const bodyStatus = c.registrar("input", "StatusBody", StatusBody)
  const bodyPagamento = c.registrar("input", "PaymentBody", PaymentBody)

  const componentes = c.componentes()

  const NOTIFY =
    "`true` avisa o cliente pelo WhatsApp do tenant, só se ele já existia e tem telefone (teto de 60/h por organização). Se não sair, a operação acontece e `meta.notify_skipped` diz o motivo."

  anotar(componentes, "CreateAppointmentBody", {
    customer: "Cliente por `customer_id`, ou dados para reaproveitar/criar (casa por telefone/documento do tenant; nunca sobrescreve cadastro).",
    professional_id: "Profissional ativo do tenant.",
    service_id: "Serviço ativo do tenant. A duração dele define a janela testada.",
    start_time: "`AAAA-MM-DDTHH:mm` (São Paulo) ou ISO 8601 com offset. Não precisa cair na grade de /availability, só estar livre e dentro do expediente. Horário passado: 409.",
    notes: "Observação do agendamento (até 500 caracteres).",
    status: "Status inicial. Padrão `scheduled`.",
    notify: NOTIFY,
  })
  anotar(componentes, "UpdateAppointmentBody", {
    start_time: "Novo horário. Revalida a agenda e zera os lembretes.",
    professional_id: "Novo profissional.",
    service_id: "Novo serviço.",
    notes: "Nova observação; `null` limpa. Mudar só `notes` não revalida a agenda.",
    notify: NOTIFY + " Só há mensagem quando horário, profissional ou serviço mudam.",
  })
  anotar(componentes, "ConfirmBody", { notify: NOTIFY })
  anotar(componentes, "CancelBody", { reason: "Motivo do cancelamento (até 300 caracteres), gravado no log.", notify: NOTIFY })
  anotar(componentes, "StatusBody", { status: "Novo status. Validado pela máquina de status.", reason: "Motivo (até 300 caracteres), gravado no log.", notify: NOTIFY + " Só há mensagem em `confirmed` e `canceled`." })
  anotar(componentes, "PaymentBody", {
    method: "Forma de pagamento.",
    status: "Status do pagamento. Padrão `paid`. Repetir `paid` num agendamento já pago não altera `paid_at`.",
  })
  anotar(componentes, "Appointment", {
    start_time: "Início em UTC.",
    start_local: "Início no relógio de São Paulo (`AAAA-MM-DDTHH:mm`).",
    price: "Preço do serviço no agendamento, em reais.",
  })
  anotar(componentes, "Availability", { slots: 'Horários de início livres ("HH:mm", relógio de São Paulo), só futuros.', empty_reason: "Por que não há horário. Só vem preenchido quando `slots` está vazio." })

  // --- operações
  const leitura = (escopo: string) => ({ security: [{ ApiKey: [escopo] }], "x-scope": escopo })
  const aviso = (escopo: string) => `\n\n**Escopo exigido:** \`${escopo}\`.`

  const caminhos: Record<string, Objeto> = {
    "/me": {
      get: {
        tags: ["Conta"],
        operationId: "getMe",
        summary: "Tenant e dados da chave",
        description: "Devolve a organização dona da chave e os metadados da própria chave (prefixo, escopos, expiração). Bom primeiro teste de credencial." + aviso("read"),
        ...leitura("read"),
        responses: {
          "200": respostaOk("Organização e chave.", respMe, {
            exemplo: {
              summary: "Chave de leitura e escrita",
              value: {
                data: {
                  organization: { id: ID_EXEMPLO.organizacao, name: "Studio Exemplo", slug: "studio-exemplo", niche: "salao" },
                  api_key: { id: ID_EXEMPLO.cliente, name: "Integração do site", key_prefix: "elz_live_ab12cd", scopes: ["read", "write"], created_at: "2026-10-01T12:00:00.000Z", expires_at: null },
                },
              },
            },
          }),
          ...respostasDeErro(ERROS_DA_CHAVE, erroRef),
        },
      },
    },

    "/services": {
      get: {
        tags: ["Catálogo"],
        operationId: "listServices",
        summary: "Serviços ativos",
        description: "Serviços ativos do tenant. `duration_minutes` é 30 quando o cadastro está sem duração." + aviso("read"),
        ...leitura("read"),
        responses: {
          "200": respostaOk("Lista de serviços.", respServicos, {
            exemplo: { summary: "Dois serviços", value: { data: [
              { id: ID_EXEMPLO.servico, title: "Corte de cabelo", description: null, duration_minutes: 30, price: 60 },
              { id: "9b2e4d18-6a3c-4f71-8e05-d3c1a7b92f46", title: "Coloração", description: "Inclui lavagem", duration_minutes: 90, price: null },
            ] } },
          }),
          ...respostasDeErro(ERROS_DA_CHAVE, erroRef),
        },
      },
    },

    "/professionals": {
      get: {
        tags: ["Catálogo"],
        operationId: "listProfessionals",
        summary: "Profissionais ativos",
        description: "Profissionais ativos do tenant. Só `id`, `name` e `specialty`: a API nunca devolve telefone nem registro profissional." + aviso("read"),
        ...leitura("read"),
        responses: {
          "200": respostaOk("Lista de profissionais.", respProfissionais, {
            exemplo: { summary: "Um profissional", value: { data: [{ id: ID_EXEMPLO.profissional, name: "Ana Profissional", specialty: "Cabeleireira" }] } },
          }),
          ...respostasDeErro(ERROS_DA_CHAVE, erroRef),
        },
      },
    },

    "/availability": {
      get: {
        tags: ["Disponibilidade"],
        operationId: "getAvailability",
        summary: "Horários livres de um profissional num dia",
        description:
          "Horários de início livres para o **serviço** informado (a janela testada tem a duração dele). Horário passado não aparece. É o mesmo predicado que valida `POST /appointments`, só que aquele também aceita horário fora da grade (`meta.grid_step_minutes`) se estiver livre e dentro do expediente." +
          aviso("read"),
        ...leitura("read"),
        parameters: parametrosDeQuery(AvailabilityQuery, {
          professional_id: "Profissional (uuid).",
          service_id: "Serviço (uuid). **Obrigatório**: define a duração testada.",
          date: "Dia no relógio de São Paulo, `AAAA-MM-DD`.",
        }).map((p) => ({ ...p, example: p.name === "date" ? "2026-10-05" : p.name === "professional_id" ? ID_EXEMPLO.profissional : ID_EXEMPLO.servico })),
        responses: {
          "200": respostaOk("Horários livres.", respDisponibilidade, {
            comHorarios: { summary: "Com horários", value: { data: { date: "2026-10-05", professional_id: ID_EXEMPLO.profissional, service_id: ID_EXEMPLO.servico, slots: ["09:00", "09:30", "14:30"], empty_reason: null }, meta: { timezone: "America/Sao_Paulo", grid_step_minutes: 30 } } },
            semHorarios: { summary: "Dia fechado", value: { data: { date: "2026-10-04", professional_id: ID_EXEMPLO.profissional, service_id: ID_EXEMPLO.servico, slots: [], empty_reason: "organizacao_fechada" }, meta: { timezone: "America/Sao_Paulo", grid_step_minutes: 30 } } },
          }),
          ...respostasDeErro(
            [...ERROS_DA_CHAVE, ["VALIDATION_ERROR", "Parâmetro ausente ou inválido (inclusive `service_id` ausente) ou data inexistente."], ["NOT_FOUND", "Serviço ou profissional inexistente, inativo ou de outro tenant."]],
            erroRef
          ),
        },
      },
    },

    "/customers": {
      get: {
        tags: ["Clientes"],
        operationId: "searchCustomers",
        summary: "Busca de clientes",
        description:
          "Busca clientes do tenant por **exatamente um** critério: `phone`, `document` ou `q` (nome). Máx. 20 resultados, ordenados por nome. `phone` casa qualquer forma brasileira do número (com/sem DDI, com/sem o 9º dígito)." +
          aviso("read"),
        ...leitura("read"),
        parameters: parametrosDeQuery(CustomersQuery, {
          phone: "Telefone (8 a 20 caracteres).",
          document: "CPF/CNPJ/RG; só letras e dígitos contam.",
          q: "Parte do nome (mín. 2 caracteres).",
        }),
        responses: {
          "200": respostaOk("Clientes encontrados (até 20). Sem `meta`: não há paginação.", respClientes, {
            exemplo: { summary: "Busca por telefone", value: { data: [{ id: ID_EXEMPLO.cliente, name: "Maria Exemplo", phone: "5511900000001", email: null }] } },
          }),
          ...respostasDeErro([...ERROS_DA_CHAVE, ["VALIDATION_ERROR", "Nenhum critério, mais de um critério ou valor fora do tamanho."]], erroRef),
        },
      },
    },

    "/appointments": {
      get: {
        tags: ["Agendamentos"],
        operationId: "listAppointments",
        summary: "Lista agendamentos",
        description: "Agendamentos do tenant em ordem crescente de início, paginados. Parâmetro desconhecido é `422` (a query é estrita)." + aviso("read"),
        ...leitura("read"),
        parameters: parametrosDeQuery(ListAppointmentsQuery, {
          status: "Lista separada por vírgula de status (`scheduled,confirmed`). Valor fora do enum: 422.",
          from: "Início do intervalo (inclusivo). Data pura = começo do dia em São Paulo; ou data/hora.",
          to: "Fim do intervalo (**exclusivo**). Data pura = fim do dia em São Paulo; ou data/hora.",
          customer_id: "Só agendamentos deste cliente.",
          professional_id: "Só agendamentos deste profissional.",
          limit: "Itens por página (1 a 100).",
          offset: "Itens a pular.",
        }),
        responses: {
          "200": respostaOk("Página de agendamentos. `meta.total` é o total do filtro.", respLista, {
            exemplo: { summary: "Uma página", value: { data: [agendamento], meta: { total: 1, limit: 50, offset: 0 } } },
          }),
          ...respostasDeErro([...ERROS_DA_CHAVE, ["VALIDATION_ERROR", "Filtro desconhecido ou inválido, ou status fora do enum."]], erroRef),
        },
      },
      post: {
        tags: ["Agendamentos"],
        operationId: "createAppointment",
        summary: "Cria um agendamento",
        description:
          "Cria o agendamento pela regra de domínio compartilhada com o painel e a página pública. Diferenças do canal API: aceita horário **fora da grade** (basta estar livre e dentro do expediente), **não exige documento** do cliente e recusa horário passado ou ocupado com `409 SLOT_UNAVAILABLE` e `details.sugestoes`. O horário passado vem com `details.motivo = \"antecedencia_minima\"`.\n\n" +
          "`customer` aceita `{ customer_id }` ou `{ name, phone, ... }`; neste caso reaproveita o cadastro do tenant que casar por telefone/documento (sem sobrescrever) ou cria um novo. Se casar com mais de um, `409 CUSTOMER_AMBIGUOUS`: envie `customer_id`.\n\n" +
          "**`notify`** só envia WhatsApp para cliente que já existia; cliente criado por este request nunca recebe (`meta.notify_skipped = \"new_customer\"`)." +
          aviso("write") +
          "\n\n> No Swagger, este botão **cria dados reais** no tenant da chave; com `notify: true` envia WhatsApp real a cliente existente.",
        ...leitura("write"),
        requestBody: corpoJson(bodyCriar, {
          clienteExistente: {
            summary: "Cliente existente, sem aviso",
            value: { customer: { customer_id: ID_EXEMPLO.cliente }, professional_id: ID_EXEMPLO.profissional, service_id: ID_EXEMPLO.servico, start_time: "2026-10-05T14:30", notes: "Primeira vez", status: "scheduled", notify: false },
          },
          clienteNovo: {
            summary: "Cliente novo por nome e telefone",
            value: { customer: { name: "Maria Exemplo", phone: "(11) 90000-0001" }, professional_id: ID_EXEMPLO.profissional, service_id: ID_EXEMPLO.servico, start_time: "2026-10-05T14:30" },
          },
        }),
        responses: {
          "201": respostaOk("Agendamento criado.", respAgendamento, {
            criado: { summary: "Criado sem aviso", value: { data: agendamento, meta: metaSemAviso } },
            clienteNovoComNotify: { summary: "notify:true com cliente novo", value: { data: agendamento, meta: { notified: false, notify_skipped: "new_customer" } } },
          }),
          ...respostasDeErro(
            [
              ...ERROS_DA_CHAVE,
              "INVALID_JSON",
              ["VALIDATION_ERROR", "Body inválido, campo desconhecido (o body é estrito) ou status inicial não permitido."],
              ["NOT_FOUND", "Serviço, profissional ou `customer_id` inexistente, inativo ou de outro tenant."],
              "SLOT_UNAVAILABLE",
              "CUSTOMER_AMBIGUOUS",
              ["CUSTOMER_CONFLICT", "O documento enviado já pertence a outro cadastro do tenant."],
            ],
            erroRef
          ),
        },
      },
    },

    "/appointments/{id}": {
      get: {
        tags: ["Agendamentos"],
        operationId: "getAppointment",
        summary: "Detalhe do agendamento",
        description: "Um agendamento do tenant. `DELETE` não existe (responde `405`): para tirar o horário, use `POST /appointments/{id}/cancel`." + aviso("read"),
        ...leitura("read"),
        parameters: [parametroId("Id do agendamento.")],
        responses: {
          "200": respostaOk("O agendamento.", respAgendamentoSemMeta, { exemplo: { summary: "Agendado", value: { data: agendamento } } }),
          ...respostasDeErro([...ERROS_DA_CHAVE, ERRO_DE_ID], erroRef),
        },
      },
      patch: {
        tags: ["Agendamentos"],
        operationId: "updateAppointment",
        summary: "Remarca ou altera",
        description:
          "Altera horário, profissional, serviço e/ou observação. Só em `pending`, `scheduled` ou `confirmed`; fora disso `409 INVALID_TRANSITION`. Mudar horário/profissional/serviço **revalida a agenda** (`409 SLOT_UNAVAILABLE` com `sugestoes`; o próprio agendamento não conta como ocupado) e **zera os lembretes**, para o cron avisar do novo horário. Mudar só `notes` não revalida. Pelo menos um campo é obrigatório." +
          aviso("write"),
        ...leitura("write"),
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoJson(bodyEditar, {
          remarcar: { summary: "Remarcar", value: { start_time: "2026-10-06T10:00", notify: false } },
          observacao: { summary: "Só a observação", value: { notes: "Cliente prefere atendimento sem conversa" } },
        }),
        responses: {
          "200": respostaOk("Agendamento atualizado.", respAgendamento, { exemplo: { summary: "Remarcado", value: { data: { ...agendamento, start_time: "2026-10-06T13:00:00.000Z", end_time: "2026-10-06T13:30:00.000Z", start_local: "2026-10-06T10:00", end_local: "2026-10-06T10:30", updated_at: "2026-10-02T09:00:00.000Z" }, meta: metaSemAviso } } }),
          ...respostasDeErro(
            [
              ...ERROS_DA_CHAVE,
              "INVALID_JSON",
              ["VALIDATION_ERROR", "Body inválido ou sem nenhum campo para alterar."],
              ERRO_DE_ID,
              "SLOT_UNAVAILABLE",
              ["INVALID_TRANSITION", "O agendamento não está em `pending`/`scheduled`/`confirmed`, ou foi alterado por outra requisição no meio."],
            ],
            erroRef
          ),
        },
      },
    },

    "/appointments/{id}/confirm": {
      post: {
        tags: ["Agendamentos"],
        operationId: "confirmAppointment",
        summary: "Confirma",
        description: "`pending` ou `scheduled` → `confirmed`. Repetir em `confirmed` é idempotente (200). O body é obrigatório: envie `{}` (corpo vazio é `400 INVALID_JSON`)." + aviso("write"),
        ...leitura("write"),
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoJson(bodyConfirmar, { semAviso: { summary: "Sem aviso", value: {} }, comAviso: { summary: "Avisando o cliente", value: { notify: true } } }),
        responses: {
          "200": respostaOk("Agendamento confirmado.", respAgendamento, { exemplo: { summary: "Confirmado", value: { data: { ...agendamento, status: "confirmed" }, meta: { notified: true } } } }),
          ...respostasDeErro([...ERROS_DA_CHAVE, "INVALID_JSON", "VALIDATION_ERROR", ERRO_DE_ID, ERRO_DE_TRANSICAO], erroRef),
        },
      },
    },

    "/appointments/{id}/cancel": {
      post: {
        tags: ["Agendamentos"],
        operationId: "cancelAppointment",
        summary: "Cancela mantendo o registro",
        description: "Muda o status para `canceled`. **Nunca apaga** o registro. Cancelar de novo é idempotente. O body é obrigatório: envie `{}` se não houver motivo." + aviso("write"),
        ...leitura("write"),
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoJson(bodyCancelar, { exemplo: { summary: "Com motivo", value: { reason: "Cliente avisou que não poderá vir", notify: false } } }),
        responses: {
          "200": respostaOk("Agendamento cancelado.", respAgendamento, { exemplo: { summary: "Cancelado", value: { data: { ...agendamento, status: "canceled" }, meta: metaSemAviso } } }),
          ...respostasDeErro([...ERROS_DA_CHAVE, "INVALID_JSON", "VALIDATION_ERROR", ERRO_DE_ID, ERRO_DE_TRANSICAO], erroRef),
        },
      },
    },

    "/appointments/{id}/status": {
      post: {
        tags: ["Agendamentos"],
        operationId: "changeAppointmentStatus",
        summary: "Muda o status (chegou, concluído, faltou...)",
        description:
          "Muda o status validando a máquina de status (veja a descrição geral). `no_show` só depois do horário de início e nunca a partir de `arrived`. Repetir o status atual é idempotente. Só `confirmed` e `canceled` geram mensagem com `notify`." + aviso("write"),
        ...leitura("write"),
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoJson(bodyStatus, { chegou: { summary: "Cliente chegou", value: { status: "arrived" } }, concluido: { summary: "Concluído", value: { status: "completed", reason: "Atendimento finalizado" } } }),
        responses: {
          "200": respostaOk("Status alterado.", respAgendamento, { exemplo: { summary: "Cliente chegou", value: { data: { ...agendamento, status: "arrived" }, meta: metaSemAviso } } }),
          ...respostasDeErro([...ERROS_DA_CHAVE, "INVALID_JSON", ["VALIDATION_ERROR", "Status fora do enum."], ERRO_DE_ID, ERRO_DE_TRANSICAO], erroRef),
        },
      },
    },

    "/appointments/{id}/payment": {
      post: {
        tags: ["Pagamentos"],
        operationId: "registerPayment",
        summary: "Baixa de pagamento",
        description:
          "Registra o pagamento. Exige o escopo **`payments`**, que é diferente de `write`: uma chave de escrita sozinha não dá baixa financeira, e uma chave só `payments` não mexe na agenda.\n\nVale antes de concluir (sinal) e depois; só `canceled` e `no_show` recusam (`409 INVALID_TRANSITION`). Repetir `paid` não altera `paid_at`. **Não notifica** o cliente (por isso a resposta não traz `meta`)." +
          aviso("payments"),
        ...leitura("payments"),
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoJson(bodyPagamento, { pix: { summary: "Pago no Pix", value: { method: "pix", status: "paid" } }, sinal: { summary: "Sinal parcial", value: { method: "dinheiro", status: "partially_paid" } } }),
        responses: {
          "200": respostaOk("Pagamento registrado.", respAgendamentoSemMeta, { exemplo: { summary: "Pago", value: { data: { ...agendamento, payment_status: "paid", payment_method: "pix", paid_at: "2026-10-05T18:10:00.000Z" } } } }),
          ...respostasDeErro(
            [...ERROS_DA_CHAVE, "INVALID_JSON", ["VALIDATION_ERROR", "`method` fora do enum ou `status` inválido."], ERRO_DE_ID, ["INVALID_TRANSITION", "Agendamento `canceled` ou `no_show` não recebe pagamento, ou foi alterado por outra requisição no meio."]],
            erroRef
          ),
        },
      },
    },

    "/logs": {
      get: {
        tags: ["Auditoria"],
        operationId: "listLogs",
        summary: "Auditoria de uso da própria API",
        description: "Requisições registradas, da mais recente para a mais antiga. Por padrão só as **desta chave**; `scope=organization` traz as de todas as chaves do tenant. Nunca cruza tenant. Body e query string não são gravados." + aviso("read"),
        ...leitura("read"),
        parameters: parametrosDeQuery(LogsQuery, {
          limit: "Itens por página (1 a 200).",
          offset: "Itens a pular.",
          scope: "`key` (padrão): só esta chave. `organization`: todas as chaves do tenant.",
        }),
        responses: {
          "200": respostaOk("Página de logs.", respLogs, {
            exemplo: { summary: "Uma linha", value: { data: [{ id: ID_EXEMPLO.cliente, key_prefix: "elz_live_ab12cd", request_id: ID_EXEMPLO.requisicao, method: "GET", path: "/api/v1/me", status_code: 200, error_code: null, duration_ms: 38, ip: "203.0.113.10", user_agent: "curl/8.5.0", created_at: "2026-10-05T17:30:00.000Z" }], meta: { total: 1, limit: 50, offset: 0 } } },
          }),
          ...respostasDeErro([...ERROS_DA_CHAVE, ["VALIDATION_ERROR", "Parâmetro desconhecido ou fora do intervalo."]], erroRef),
        },
      },
    },
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Eliza — API v1 (integração B2B)",
      version: "1.0.0",
      summary: "Agendamentos do Eliza para o sistema do próprio tenant.",
      description: DESCRICAO_GERAL,
    },
    servers: [{ url: origem, description: "Este ambiente" }],
    tags: [
      { name: "Conta", description: "Quem é a chave e a qual tenant ela pertence." },
      { name: "Catálogo", description: "Serviços e profissionais ativos." },
      { name: "Disponibilidade", description: "Horários livres." },
      { name: "Clientes", description: "Busca de clientes do tenant." },
      { name: "Agendamentos", description: "Criar, consultar, remarcar, confirmar, cancelar e mudar status." },
      { name: "Pagamentos", description: "Baixa de pagamento (escopo `payments`)." },
      { name: "Auditoria", description: "Log de uso da API." },
    ],
    security: [{ ApiKey: [] }],
    paths: Object.fromEntries(Object.entries(caminhos).map(([caminho, item]) => [`/api/v1${caminho}`, item])),
    components: {
      securitySchemes: {
        ApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "elz_live_…",
          description:
            "API key do tenant, gerada em *Configurações → API*. Formato `elz_live_` seguido de 32+ caracteres; cole só a chave (o Swagger acrescenta `Bearer`). Escopos: `read`, `write`, `payments`. Cada operação indica o escopo exigido.",
        },
      },
      headers: HEADERS_COMUNS,
      schemas: componentes,
    },
  }
}
