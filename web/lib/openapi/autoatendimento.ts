import {
  AgendamentoResposta,
  AgendamentoResumo,
  ApiErrorBody,
  AtualizarCadastroBody,
  Cadastro,
  CadastroResposta,
  CancelarAgendamentoBody,
  ConfirmarAgendamentoBody,
  Contexto,
  ContextoResposta,
  CriarAgendamentoBody,
  CriarCadastroBody,
  EnviarMensagemBody,
  EnviarMensagemResposta,
  ErrorCode,
  EscalonarBody,
  EscalonarResposta,
  HEADER_ASSINATURA,
  HEADER_TICKET,
  HEADER_TIMESTAMP,
  HEADER_VERSAO,
  HorariosQuery,
  HorariosResposta,
  Identificacao,
  ListarAgendamentosResposta,
  ListarProfissionaisResposta,
  ListarServicosResposta,
  MensagemEncaminhada,
  MotivoSemHorario,
  Momento,
  Profissional,
  RemarcarAgendamentoBody,
  RespostaEncaminhamento,
  Servico,
  StatusAgendamento,
  Termos,
  TicketEmitido,
} from "@/contracts/autoatendimento"
import {
  HEADERS_COMUNS,
  ID_EXEMPLO,
  corpoJson,
  parametroId,
  respostaOk,
  respostasDeErro,
  type ErroDaRota,
} from "./comum"
import { Componentes, anotar, parametrosDeQuery, type Ref } from "./esquemas"
import type { OpcoesDoDocumento } from "./v1"

type Objeto = Record<string, unknown>

// ------------------------------------------------------------------ exemplos (dados fictícios)

const TICKET_EXEMPLO = "eyJ2IjoxLCJvcmciOiIwYTZmMmQ5NC04YzE1LTRlN2ItOTNkYS00YjFjOGU1ZjdhMDIifQ.assinatura-de-exemplo"

const resumo = {
  id: ID_EXEMPLO.agendamento,
  status: "pending",
  inicio: { utc: "2026-10-05T17:30:00.000Z", local: "2026-10-05T14:30" },
  fim: { utc: "2026-10-05T18:00:00.000Z", local: "2026-10-05T15:00" },
  servico: { id: ID_EXEMPLO.servico, nome: "Corte de cabelo" },
  profissional: { id: ID_EXEMPLO.profissional, nome: "Ana Profissional" },
  podeCancelar: true,
  podeRemarcar: true,
  podeConfirmar: false,
}

const cadastro = {
  id: ID_EXEMPLO.cliente,
  nome: "Maria Exemplo",
  email: "maria@exemplo.com.br",
  documentoMascarado: "***.***.705-00",
  dataNascimentoInformada: true,
}

// ------------------------------------------------------------------ erros por rota

/** Camadas de autenticação, na ordem em que são checadas. */
const ERROS_DE_AUTENTICACAO: ErroDaRota[] = [
  ["UNAUTHORIZED", "Token de serviço ausente ou inválido."],
  "VERSION_MISMATCH",
  "TICKET_MISSING",
  "TICKET_INVALID",
  "TICKET_EXPIRED",
  "ADDON_INACTIVE",
  ["INTERNAL_ERROR", "Erro inesperado ou segredo do canal não configurado no Eliza (falha fechada)."],
]

const ERROS_DE_CLIENTE: ErroDaRota[] = [
  "CUSTOMER_NOT_IDENTIFIED",
  ["CUSTOMER_AMBIGUOUS", "Mais de um cadastro bate com o telefone do ticket. Só leitura de catálogo; escale para a equipe."],
]

const ERROS_DE_ESCRITA: ErroDaRota[] = ["INVALID_JSON", ["VALIDATION_ERROR", "Body inválido ou com campo desconhecido (o body é estrito: `organizationId`, `customerId` e telefone são rejeitados)."], "RATE_LIMITED"]

const NOT_FOUND_AGENDAMENTO: ErroDaRota = ["NOT_FOUND", "Agendamento inexistente, de outro cliente ou `{id}` que não é UUID. A API não confirma que ele existe."]

const DESCRICAO_GERAL = `
API para o **atendente de WhatsApp** do Eliza agir em nome de um cliente final: ver contexto, catálogo e horários,
agendar, remarcar, cancelar, confirmar presença, manter o cadastro, responder e pedir ajuda humana.
É uma **API interna** entre dois serviços; o tenant que quer integrar o próprio sistema usa a API v1.

> Este documento só é servido em desenvolvimento ou com \`API_DOCS_INTERNAS=true\`.

## Autenticação em duas camadas (três headers em toda chamada)

| Header | Prova |
|---|---|
| \`Authorization: Bearer <AUTOATENDIMENTO_API_TOKEN>\` | Que quem chama é o atendente (token de serviço) |
| \`${HEADER_TICKET}: <ticket>\` | **Qual organização e qual telefone**, e que esse telefone escreveu há menos de 30 minutos |
| \`${HEADER_VERSAO}: 1\` | Mesma versão do contrato nos dois lados |

**Organização e telefone saem só do ticket.** Nenhuma rota aceita \`organizationId\`, \`customerId\` ou telefone em
header, query ou body (os bodies são estritos e devolvem \`422\`). Um atendente com bug só consegue agir sobre quem
mandou mensagem de fato.

### Ticket

- Chega no encaminhamento de **cada** mensagem do cliente (veja o webhook \`mensagemRecebida\`). Vale **30 minutos**.
- Use sempre o ticket da mensagem **mais recente** da conversa.
- Formato \`<payload>.<assinatura>\`; é opaco para o atendente. Não tente ler nem montar.

## Formato

Sucesso \`{ "data": ..., "meta"?: ... }\`; erro \`{ "error": { "code", "message", "details?", "request_id" } }\`; header
\`X-Request-Id\` em toda resposta. \`message\` é em português, escrita para você repassar ao cliente, e nunca contém dado
de outro cliente. Os corpos de request/response são camelCase em português.

## Horário

Entrada: \`AAAA-MM-DDTHH:mm\` no relógio de **São Paulo**, sem offset. Saída: todo instante é um \`Momento\`
\`{ utc, local }\`.

## Identificação

\`GET /contexto\` informa quem é o telefone do ticket: \`identificado\`, \`desconhecido\` (sem cadastro) ou \`ambiguo\`
(mais de um cadastro; nunca se desempata). Rotas de agendamento e de cadastro (exceto criar) exigem \`identificado\`.

## Regras de agendamento

- Todo agendamento criado nasce **\`pending\`**: aguarda o estabelecimento aprovar. Só quem aprova é o tenant.
- **Remarcar** mantém o mesmo registro e o volta para \`pending\`; o serviço não muda.
- **Confirmar** é o cliente dizer "vou": só \`scheduled\`. \`pending\` não se confirma.
- **Posse:** só os agendamentos do cliente do ticket; o resto responde \`404\`.
- **Política** (vem em \`politica\` no contexto): antecedência mínima, janela máxima em dias e máximo de agendamentos ativos.
- Cancelar nunca apaga o registro.

## Limites por telefone do ticket

| Prefixo | Onde | Janela | Máx. |
|---|---|---|---|
| \`aa-escrita\` | criar, remarcar, cancelar, confirmar, POST/PATCH cadastro | 1 h | 20 |
| \`aa-criar\` | criar agendamento | 24 h | 5 |
| \`aa-msg-contato\` | enviar mensagem | 1 h | 60 |
| \`aa-msg-org\` | enviar mensagem (conta a organização toda) | 1 h | 600 |
| \`aa-escalar\` | escalonamento | 1 h | 3 |

Esgotou: \`429 RATE_LIMITED\` com \`Retry-After\` e \`details.retry_after_seconds\`.
`.trim()

export function gerarOpenApiAutoatendimento({ origem }: OpcoesDoDocumento): Objeto {
  const c = new Componentes()

  // --- saída
  const erroRef = c.registrar("output", "ErrorBody", ApiErrorBody)
  c.registrar("output", "ErrorCode", ErrorCode)
  c.registrar("output", "Momento", Momento)
  c.registrar("output", "StatusAgendamento", StatusAgendamento)
  c.registrar("output", "AgendamentoResumo", AgendamentoResumo)
  c.registrar("output", "Servico", Servico)
  c.registrar("output", "Profissional", Profissional)
  c.registrar("output", "Termos", Termos)
  c.registrar("output", "Identificacao", Identificacao)
  c.registrar("output", "Contexto", Contexto)
  c.registrar("output", "Cadastro", Cadastro)
  c.registrar("output", "MotivoSemHorario", MotivoSemHorario)
  c.registrar("output", "TicketEmitido", TicketEmitido)
  c.registrar("output", "MensagemEncaminhada", MensagemEncaminhada)
  c.registrar("output", "RespostaEncaminhamento", RespostaEncaminhamento)

  const rContexto = c.registrar("output", "ContextoResposta", ContextoResposta)
  const rServicos = c.registrar("output", "ListarServicosResposta", ListarServicosResposta)
  const rProfissionais = c.registrar("output", "ListarProfissionaisResposta", ListarProfissionaisResposta)
  const rHorarios = c.registrar("output", "HorariosResposta", HorariosResposta)
  const rAgendamentos = c.registrar("output", "ListarAgendamentosResposta", ListarAgendamentosResposta)
  const rAgendamento = c.registrar("output", "AgendamentoResposta", AgendamentoResposta)
  const rCadastro = c.registrar("output", "CadastroResposta", CadastroResposta)
  const rMensagem = c.registrar("output", "EnviarMensagemResposta", EnviarMensagemResposta)
  const rEscalonar = c.registrar("output", "EscalonarResposta", EscalonarResposta)

  // --- entrada
  const bCriar = c.registrar("input", "CriarAgendamentoBody", CriarAgendamentoBody)
  const bRemarcar = c.registrar("input", "RemarcarAgendamentoBody", RemarcarAgendamentoBody)
  const bCancelar = c.registrar("input", "CancelarAgendamentoBody", CancelarAgendamentoBody)
  const bConfirmar = c.registrar("input", "ConfirmarAgendamentoBody", ConfirmarAgendamentoBody)
  const bCriarCadastro = c.registrar("input", "CriarCadastroBody", CriarCadastroBody)
  const bAtualizarCadastro = c.registrar("input", "AtualizarCadastroBody", AtualizarCadastroBody)
  const bMensagem = c.registrar("input", "EnviarMensagemBody", EnviarMensagemBody)
  const bEscalar = c.registrar("input", "EscalonarBody", EscalonarBody)

  const componentes = c.componentes()

  anotar(componentes, "CriarAgendamentoBody", {
    servicoId: "Serviço ativo (de `GET /servicos`).",
    profissionalId: "Profissional ativo (de `GET /horarios`).",
    inicio: "`AAAA-MM-DDTHH:mm`, relógio de São Paulo. Tem de ser um dos horários de `GET /horarios`, dentro da janela e da antecedência.",
    observacao: "Texto livre do cliente (até 500 caracteres).",
  })
  anotar(componentes, "RemarcarAgendamentoBody", {
    inicio: "Novo horário, mesmas regras da criação.",
    profissionalId: "Omitido = mantém o profissional atual.",
  })
  anotar(componentes, "CancelarAgendamentoBody", { motivo: "Motivo dito pelo cliente (até 300 caracteres)." })
  anotar(componentes, "CriarCadastroBody", {
    nome: "Nome completo (3 a 120 caracteres).",
    documento: "CPF ou CNPJ, com ou sem pontuação. Já existir na organização: `CUSTOMER_CONFLICT`.",
    email: "E-mail do cliente.",
    dataNascimento: "`AAAA-MM-DD`.",
  })
  anotar(componentes, "AtualizarCadastroBody", {
    nome: "Novo nome.",
    email: "Novo e-mail.",
    dataNascimento: "`AAAA-MM-DD`.",
    documento: "Aceito só se o cadastro ainda **não tem** documento; nunca troca um existente (`INVALID_TRANSITION`).",
  })
  anotar(componentes, "EnviarMensagemBody", { texto: "Texto enviado como está, sem template, para o telefone do ticket." })
  anotar(componentes, "EscalonarBody", { motivo: "Por que a equipe precisa agir.", resumo: "Resumo para a equipe, sem dado sensível além do necessário." })
  anotar(componentes, "AgendamentoResumo", {
    podeCancelar: "Calculado pelo Eliza com a política do estabelecimento; não recalcule.",
    podeRemarcar: "Igual a `podeCancelar`.",
    podeConfirmar: "`true` só em `scheduled` e antes do horário.",
  })
  anotar(componentes, "Contexto", {
    agendamentos: "Futuros e ativos (`pending`/`scheduled`/`confirmed`), até 10. Vazio se não identificado.",
    aguardandoConfirmacao: "Ids de `agendamentos` já lembrados e ainda `scheduled`: um \"sim\" solto do cliente provavelmente responde a um deles.",
  })

  const seguranca = [{ TokenDeServico: [], Ticket: [], Versao: [] }]
  const comum = { security: seguranca }
  const erros = (...extra: ErroDaRota[]) => respostasDeErro([...ERROS_DE_AUTENTICACAO, ...extra], erroRef)
  const corpoOpcional = (schema: Ref, exemplos: Record<string, { summary: string; value: unknown }>): Objeto => ({
    required: false,
    description: "Corpo opcional: ausente ou vazio vale `{}`.",
    content: { "application/json": { schema, examples: exemplos } },
  })

  const caminhos: Record<string, Objeto> = {
    "/api/v1/autoatendimento/contexto": {
      get: {
        tags: ["Contexto"],
        operationId: "obterContexto",
        summary: "Contexto do turno",
        description:
          "Chame **uma vez por turno**, antes de responder. Devolve o instante atual, o vocabulário do nicho, o expediente, a política do estabelecimento, **quem é** o telefone do ticket e os agendamentos futuros dele.\n\n`desconhecido` e `ambiguo` **não** são erro aqui: são dado. Nunca vem documento, e-mail, data de nascimento, endereço, prontuário nem dado de outro cliente.",
        ...comum,
        responses: {
          "200": respostaOk("Contexto do turno.", rContexto, {
            identificado: {
              summary: "Cliente identificado, com um agendamento",
              value: {
                data: {
                  agora: { utc: "2026-10-02T13:00:00.000Z", local: "2026-10-02T10:00" },
                  fusoHorario: "America/Sao_Paulo",
                  organizacao: {
                    nome: "Studio Exemplo",
                    nicho: "salao",
                    termos: { genero: "m", cliente: "cliente", clientePlural: "clientes", profissional: "profissional", profissionalPlural: "profissionais", servico: "serviço", servicoPlural: "serviços", agendamento: "agendamento", agendamentoPlural: "agendamentos" },
                  },
                  expediente: { diasDaSemana: [1, 2, 3, 4, 5, 6], abertura: "09:00", fechamento: "18:00", almoco: { inicio: "12:00", fim: "13:00" } },
                  politica: { antecedenciaMinimaMinutos: 120, janelaMaximaDias: 60, maxAgendamentosAtivos: 3, instrucoesAtendimento: null },
                  identificacao: { situacao: "identificado", cliente: { id: ID_EXEMPLO.cliente, primeiroNome: "Maria" } },
                  agendamentos: [{ ...resumo, status: "scheduled", podeConfirmar: true }],
                  aguardandoConfirmacao: [ID_EXEMPLO.agendamento],
                },
              },
            },
          }),
          ...erros(),
        },
      },
    },

    "/api/v1/autoatendimento/servicos": {
      get: {
        tags: ["Catálogo e horários"],
        operationId: "listarServicos",
        summary: "Serviços ativos",
        description: "Serviços ativos da organização do ticket. Não exige cliente identificado: um desconhecido pode perguntar preço antes de se cadastrar. `preco: null` = não divulgar; preço `0` continua `0`.",
        ...comum,
        responses: {
          "200": respostaOk("Lista de serviços.", rServicos, {
            exemplo: { summary: "Dois serviços", value: { data: { servicos: [
              { id: ID_EXEMPLO.servico, nome: "Corte de cabelo", descricao: null, duracaoMinutos: 30, preco: 60 },
              { id: "9b2e4d18-6a3c-4f71-8e05-d3c1a7b92f46", nome: "Coloração", descricao: "Inclui lavagem", duracaoMinutos: 90, preco: null },
            ] } } },
          }),
          ...erros(),
        },
      },
    },

    "/api/v1/autoatendimento/profissionais": {
      get: {
        tags: ["Catálogo e horários"],
        operationId: "listarProfissionais",
        summary: "Profissionais ativos",
        description: "Profissionais ativos. Nunca expõe telefone nem registro profissional. **Não existe vínculo serviço ↔ profissional:** todo profissional ativo atende todo serviço.",
        ...comum,
        responses: {
          "200": respostaOk("Lista de profissionais.", rProfissionais, { exemplo: { summary: "Um profissional", value: { data: { profissionais: [{ id: ID_EXEMPLO.profissional, nome: "Ana Profissional", especialidade: "Cabeleireira" }] } } } }),
          ...erros(),
        },
      },
    },

    "/api/v1/autoatendimento/horarios": {
      get: {
        tags: ["Catálogo e horários"],
        operationId: "consultarHorarios",
        summary: "Horários livres de um serviço num dia",
        description:
          "Horários de **início** livres para a duração do serviço, um bloco por profissional (**incluindo** quem ficou sem horário, com `motivoVazio`, para você poder dizer \"com a Ana não há, com o Bruno há\"). Já aplica a antecedência mínima.\n\nÉ o mesmo predicado que valida a criação e a remarcação: **se está na lista, a API aceita; se não está, recusa.**\n\nA query é estrita (`organizationId`, telefone etc. dão `422`). Não exige cliente identificado.",
        ...comum,
        parameters: parametrosDeQuery(HorariosQuery, {
          servicoId: "Serviço ativo.",
          data: "Dia no relógio de São Paulo, `AAAA-MM-DD`, entre hoje e hoje + janela máxima.",
          profissionalId: "Omitido = todos os profissionais ativos.",
        }),
        responses: {
          "200": respostaOk("Horários livres por profissional.", rHorarios, {
            exemplo: {
              summary: "Um profissional com horários e outro sem",
              value: { data: { data: "2026-10-05", servicoId: ID_EXEMPLO.servico, porProfissional: [
                { profissional: { id: ID_EXEMPLO.profissional, nome: "Ana Profissional", especialidade: "Cabeleireira" }, horarios: ["09:00", "09:30", "14:30"], motivoVazio: null },
                { profissional: { id: "5a7d9e12-3b64-4c80-9f1a-6e2d8b0c4f37", nome: "Bruno Profissional", especialidade: null }, horarios: [], motivoVazio: "professional_unavailable_day" },
              ] } },
            },
          }),
          ...erros(
            ["VALIDATION_ERROR", "Parâmetro ausente, desconhecido ou inválido, ou data de calendário inexistente (ex.: 2026-02-30)."],
            ["NOT_FOUND", "Serviço ou profissional inexistente, inativo ou de outra organização."],
            ["OUT_OF_WINDOW", "Data anterior a hoje ou além da janela máxima."]
          ),
        },
      },
    },

    "/api/v1/autoatendimento/agendamentos": {
      get: {
        tags: ["Agendamentos"],
        operationId: "listarAgendamentos",
        summary: "Agendamentos do cliente",
        description: "Futuros e ativos (`pending`/`scheduled`/`confirmed`) do cliente do ticket, até 20. A consulta filtra por organização **e** cliente: nada de outro cliente aparece. Exige `identificado`.",
        ...comum,
        responses: {
          "200": respostaOk("Agendamentos do cliente.", rAgendamentos, { exemplo: { summary: "Um agendamento", value: { data: { agendamentos: [resumo] } } } }),
          ...erros(...ERROS_DE_CLIENTE),
        },
      },
      post: {
        tags: ["Agendamentos"],
        operationId: "criarAgendamento",
        summary: "Cria um agendamento (nasce pending)",
        description:
          "Cria um agendamento para o **cliente do ticket** (nunca do body). Nasce `pending`: aguarda o estabelecimento aprovar, então diga isso ao cliente. O preço vem do serviço. Nenhuma mensagem de WhatsApp é enviada pelo Eliza (quem responde é você).\n\nValidações, nesta ordem: serviço e profissional ativos (`NOT_FOUND`) → limite de agendamentos ativos (`ACTIVE_LIMIT_REACHED`) → janela (`OUT_OF_WINDOW`) → antecedência (`NOTICE_TOO_SHORT`) → horário livre e na grade (`SLOT_UNAVAILABLE`, com até 3 `sugestoes` do mesmo dia e profissional).\n\n**Idempotência:** repetir o mesmo pedido (mesmo cliente, profissional e início) em até 10 minutos devolve o agendamento já criado, com o mesmo `id`.\n\nLimites: `aa-escrita` (20/h) e `aa-criar` (5/24h)." +
          "\n\n> No Swagger, este botão **cria dados reais** na organização do ticket.",
        ...comum,
        requestBody: corpoJson(bCriar, { exemplo: { summary: "Corte às 14:30", value: { servicoId: ID_EXEMPLO.servico, profissionalId: ID_EXEMPLO.profissional, inicio: "2026-10-05T14:30", observacao: "Primeira vez" } } }),
        responses: {
          "201": respostaOk("Agendamento criado em `pending`.", rAgendamento, { exemplo: { summary: "Criado", value: { data: { agendamento: resumo } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ...ERROS_DE_CLIENTE,
            ["NOT_FOUND", "Serviço ou profissional inexistente, inativo ou de outra organização."],
            "ACTIVE_LIMIT_REACHED",
            "OUT_OF_WINDOW",
            "NOTICE_TOO_SHORT",
            "SLOT_UNAVAILABLE"
          ),
        },
      },
    },

    "/api/v1/autoatendimento/agendamentos/{id}/remarcar": {
      post: {
        tags: ["Agendamentos"],
        operationId: "remarcarAgendamento",
        summary: "Remarca (volta a pending)",
        description:
          "Muda o horário (e, se vier, o profissional) do **mesmo registro**: histórico, pagamento e `id` continuam. O serviço nunca muda. O status **volta a `pending`** (um \"confirmado\" valia para o horário antigo; o estabelecimento aprova de novo) e os lembretes são zerados. Remarcar para outro horário que sobreponha o próprio atual é permitido.\n\nSó `pending`/`scheduled`/`confirmed` (`INVALID_TRANSITION` nos demais) e só fora da antecedência mínima (`NOTICE_TOO_SHORT`: escale para a equipe). Mesmas validações de janela, antecedência e horário da criação. Limite: `aa-escrita`.",
        ...comum,
        parameters: [parametroId("Id do agendamento (de `GET /agendamentos` ou do contexto).")],
        requestBody: corpoJson(bRemarcar, { exemplo: { summary: "Para 15:00, mesmo profissional", value: { inicio: "2026-10-05T15:00" } } }),
        responses: {
          "200": respostaOk("Agendamento remarcado, em `pending`.", rAgendamento, { exemplo: { summary: "Remarcado", value: { data: { agendamento: { ...resumo, inicio: { utc: "2026-10-05T18:00:00.000Z", local: "2026-10-05T15:00" }, fim: { utc: "2026-10-05T18:30:00.000Z", local: "2026-10-05T15:30" } } } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ...ERROS_DE_CLIENTE,
            NOT_FOUND_AGENDAMENTO,
            ["INVALID_TRANSITION", "O agendamento não está em `pending`/`scheduled`/`confirmed`."],
            ["NOTICE_TOO_SHORT", "Faltam menos minutos que a antecedência mínima para o horário atual, ou o novo horário não respeita a antecedência."],
            "OUT_OF_WINDOW",
            "SLOT_UNAVAILABLE"
          ),
        },
      },
    },

    "/api/v1/autoatendimento/agendamentos/{id}/cancelar": {
      post: {
        tags: ["Agendamentos"],
        operationId: "cancelarAgendamento",
        summary: "Cancela mantendo o registro",
        description: "Muda o status para `canceled`. **Nunca apaga.** Só `pending`/`scheduled`/`confirmed` e só fora da antecedência mínima; dentro dela, `NOTICE_TOO_SHORT` e você deve escalar (a equipe decide exceções). Nenhuma mensagem é enviada pelo Eliza. Limite: `aa-escrita`.",
        ...comum,
        parameters: [parametroId("Id do agendamento.")],
        requestBody: corpoOpcional(bCancelar, { comMotivo: { summary: "Com motivo", value: { motivo: "imprevisto" } }, semCorpo: { summary: "Sem motivo", value: {} } }),
        responses: {
          "200": respostaOk("Agendamento cancelado.", rAgendamento, { exemplo: { summary: "Cancelado", value: { data: { agendamento: { ...resumo, status: "canceled", podeCancelar: false, podeRemarcar: false } } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ...ERROS_DE_CLIENTE,
            NOT_FOUND_AGENDAMENTO,
            ["INVALID_TRANSITION", "O agendamento não está em `pending`/`scheduled`/`confirmed`."],
            ["NOTICE_TOO_SHORT", "Faltam menos minutos que a antecedência mínima. Escale para a equipe."]
          ),
        },
      },
    },

    "/api/v1/autoatendimento/agendamentos/{id}/confirmar": {
      post: {
        tags: ["Agendamentos"],
        operationId: "confirmarAgendamento",
        summary: "O cliente confirma presença",
        description: "Para quando o cliente diz \"vou\". Só vale em `scheduled` e antes do horário. **`pending` não se confirma:** ele ainda aguarda a aprovação do estabelecimento (`INVALID_TRANSITION`). Repetir em `confirmed` devolve `200` sem novo log. Limite: `aa-escrita`.",
        ...comum,
        parameters: [parametroId("Id do agendamento (veja `aguardandoConfirmacao` no contexto).")],
        requestBody: corpoOpcional(bConfirmar, { vazio: { summary: "Corpo vazio", value: {} } }),
        responses: {
          "200": respostaOk("Agendamento confirmado.", rAgendamento, { exemplo: { summary: "Confirmado", value: { data: { agendamento: { ...resumo, status: "confirmed", podeConfirmar: false } } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ...ERROS_DE_CLIENTE,
            NOT_FOUND_AGENDAMENTO,
            ["INVALID_TRANSITION", "`pending` (aguarda aprovação), horário já passado ou status que não permite confirmar."]
          ),
        },
      },
    },

    "/api/v1/autoatendimento/cadastro": {
      get: {
        tags: ["Cadastro"],
        operationId: "lerCadastro",
        summary: "Lê o próprio cadastro",
        description: "O cadastro do telefone do ticket. Exige `identificado`. Devolve o documento **mascarado** e só se há data de nascimento; nunca endereço, observações, gênero nem documento completo. Não existe busca por nome, documento ou outro telefone.",
        ...comum,
        responses: {
          "200": respostaOk("Cadastro do cliente.", rCadastro, { exemplo: { summary: "Cadastro", value: { data: { cadastro } } } }),
          ...erros(...ERROS_DE_CLIENTE),
        },
      },
      post: {
        tags: ["Cadastro"],
        operationId: "criarCadastro",
        summary: "Cria o cadastro do número do ticket",
        description:
          "Só quando a identificação é `desconhecido`. O telefone vem do ticket (nunca do body). Se o documento já existe na organização, `CUSTOMER_CONFLICT` **sem** vincular nem alterar o cadastro existente: o documento pode ser de outra pessoa e a equipe decide. Escale.\n\n`identificado` → `CUSTOMER_CONFLICT` (use PATCH); `ambiguo` → `CUSTOMER_AMBIGUOUS`. Limite: `aa-escrita`." +
          "\n\n> No Swagger, este botão **cria dados reais** na organização do ticket.",
        ...comum,
        requestBody: corpoJson(bCriarCadastro, { completo: { summary: "Com e-mail e nascimento", value: { nome: "Maria Exemplo", documento: "39053344705", email: "maria@exemplo.com.br", dataNascimento: "1990-05-10" } }, minimo: { summary: "Só o obrigatório", value: { nome: "Maria Exemplo", documento: "39053344705" } } }),
        responses: {
          "201": respostaOk("Cadastro criado.", rCadastro, { exemplo: { summary: "Criado", value: { data: { cadastro } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ["CUSTOMER_CONFLICT", "O número já tem cadastro, ou o documento já pertence a outro cadastro da organização. Escale."],
            ["CUSTOMER_AMBIGUOUS", "Mais de um cadastro bate com o telefone do ticket. Escale."]
          ),
        },
      },
      patch: {
        tags: ["Cadastro"],
        operationId: "atualizarCadastro",
        summary: "Atualiza o próprio cadastro",
        description: "Exige `identificado`. Pelo menos um campo. `nome`, `email` e `dataNascimento` sobrescrevem. `documento` só é aceito se o cadastro **ainda não tem** (trocar documento por WhatsApp é o caminho de apropriar cadastro alheio). O telefone nunca muda por aqui. Limite: `aa-escrita`.",
        ...comum,
        requestBody: corpoJson(bAtualizarCadastro, { nome: { summary: "Corrige o nome", value: { nome: "Maria Exemplo Silva" } } }),
        responses: {
          "200": respostaOk("Cadastro atualizado.", rCadastro, { exemplo: { summary: "Atualizado", value: { data: { cadastro: { ...cadastro, nome: "Maria Exemplo Silva" } } } } }),
          ...erros(
            ...ERROS_DE_ESCRITA,
            ...ERROS_DE_CLIENTE,
            ["INVALID_TRANSITION", "Tentativa de definir `documento` num cadastro que já tem um (mesmo valor igual)."],
            ["CUSTOMER_CONFLICT", "O documento enviado já pertence a outro cadastro."]
          ),
        },
      },
    },

    "/api/v1/autoatendimento/mensagens": {
      post: {
        tags: ["Mensagens e escalonamento"],
        operationId: "enviarMensagem",
        summary: "Envia texto ao cliente pelo WhatsApp",
        description:
          "Envia `texto` ao **telefone do ticket**, pela instância de WhatsApp da organização. Não existe campo de destino. O texto sai como está (sem template). Não exige cliente identificado: o desconhecido também precisa de resposta.\n\n`mensagemId` é o id da mensagem na Evolution (ou `null`); guarde-o: o eco dessa mensagem volta pelo webhook com `deMim: true`, e é assim que você o reconhece. Limites: `aa-msg-contato` (60/h) e `aa-msg-org` (600/h)." +
          "\n\n> No Swagger, este botão **envia WhatsApp real** ao telefone do ticket.",
        ...comum,
        requestBody: corpoJson(bMensagem, { exemplo: { summary: "Resposta curta", value: { texto: "Oi, Maria! Tenho 14:30 e 15:00 amanhã. Qual prefere?" } } }),
        responses: {
          "200": respostaOk("Mensagem enviada.", rMensagem, { exemplo: { summary: "Enviada", value: { data: { mensagemId: "3EB0A1B2C3D4E5F60718" } } } }),
          ...erros(...ERROS_DE_ESCRITA, "WHATSAPP_UNAVAILABLE"),
        },
      },
    },

    "/api/v1/autoatendimento/escalonamentos": {
      post: {
        tags: ["Mensagens e escalonamento"],
        operationId: "escalarParaEquipe",
        summary: "Pede ajuda humana",
        description:
          "Avisa a equipe do estabelecimento pelo WhatsApp da própria organização, com o motivo e o resumo. Não exige cliente identificado (o ambíguo é justamente quem mais escala).\n\n`equipeNotificada: false` **não é erro**: a organização não configurou contato humano, ou o envio falhou. Nesse caso avise o cliente de outro jeito. Nada é gravado em tabela nesta versão. Limite: `aa-escalar` (3/h)." +
          "\n\n> No Swagger, este botão **envia WhatsApp real** ao contato da equipe.",
        ...comum,
        requestBody: corpoJson(bEscalar, { exemplo: { summary: "Cliente quer uma pessoa", value: { motivo: "pedido_do_cliente", resumo: "Quer falar com uma pessoa sobre um reembolso" } } }),
        responses: {
          "200": respostaOk("Pedido registrado.", rEscalonar, { exemplo: { summary: "Equipe avisada", value: { data: { equipeNotificada: true } } } }),
          ...erros(...ERROS_DE_ESCRITA),
        },
      },
    },
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Eliza — API de Autoatendimento (interna)",
      version: "1",
      summary: "Contrato entre o Eliza e o atendente de WhatsApp.",
      description: DESCRICAO_GERAL,
    },
    servers: [{ url: origem, description: "Este ambiente" }],
    tags: [
      { name: "Contexto", description: "Uma chamada por turno, antes de responder." },
      { name: "Catálogo e horários", description: "Serviços, profissionais e horários livres. Não exigem cliente identificado." },
      { name: "Agendamentos", description: "Listar, criar, remarcar, cancelar e confirmar. Exigem cliente identificado." },
      { name: "Cadastro", description: "Ler, criar e atualizar o próprio cadastro." },
      { name: "Mensagens e escalonamento", description: "Responder ao cliente e pedir ajuda humana." },
      { name: "Encaminhamento (Eliza → atendente)", description: "Rota que o atendente expõe e o Eliza chama a cada mensagem." },
    ],
    security: seguranca,
    paths: caminhos,
    webhooks: {
      mensagemRecebida: {
        post: {
          tags: ["Encaminhamento (Eliza → atendente)"],
          operationId: "receberMensagem",
          summary: "Eliza encaminha uma mensagem ao atendente",
          description:
            "**Esta é a rota que o atendente expõe** (`POST {ATENDENTE_URL}/v1/mensagens`), não uma rota do Eliza.\n\nO Eliza chama a cada mensagem de texto do cliente (e a cada mensagem enviada pelo número do estabelecimento, com `deMim: true`). Responda `202` assim que validar e enfileirar. Timeout do Eliza: 3 s, sem retentativa; **deduplique por `mensagemId`**.\n\n**Assinatura:** `" +
            HEADER_ASSINATURA +
            "` = `hex(HMAC-SHA256(ATENDENTE_ENCAMINHAMENTO_SECRET, timestamp + \".\" + corpoBruto))`, calculada sobre o corpo **exato** recebido. `" +
            HEADER_TIMESTAMP +
            "` é epoch em segundos; rejeite se `|agora - timestamp| > 300`.\n\n**Fallback:** se o atendente estiver fora, der timeout ou responder diferente de `202`, o Eliza processa a mensagem pelo fluxo antigo de palavra-chave (apenas para `deMim: false`).\n\n`deMim: true` é o eco da sua própria mensagem (o `mensagemId` bate com o que `POST /mensagens` devolveu) **ou** alguém da equipe respondendo pelo celular, o que deve pausar o atendente. Mensagens de grupo e de status nunca são encaminhadas.",
          parameters: [
            { name: HEADER_ASSINATURA, in: "header", required: true, description: "Assinatura HMAC-SHA256 em hexadecimal.", schema: { type: "string" } },
            { name: HEADER_TIMESTAMP, in: "header", required: true, description: "Epoch em segundos.", schema: { type: "integer" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MensagemEncaminhada" },
                examples: {
                  doCliente: {
                    summary: "Mensagem do cliente",
                    value: {
                      versao: 1,
                      mensagemId: "3EB0A1B2C3D4E5F60718",
                      recebidaEm: "2026-10-02T13:00:00.000Z",
                      organizacao: { id: ID_EXEMPLO.organizacao, nome: "Studio Exemplo" },
                      contato: { telefone: "5511900000001", nomeExibicao: "Maria" },
                      deMim: false,
                      conteudo: { tipo: "texto", texto: "Quero marcar um corte amanhã" },
                      ticket: { token: TICKET_EXEMPLO, expiraEm: "2026-10-02T13:30:00.000Z" },
                    },
                  },
                  daEquipe: {
                    summary: "Equipe respondeu pelo celular",
                    value: {
                      versao: 1,
                      mensagemId: "3EB0F9E8D7C6B5A40312",
                      recebidaEm: "2026-10-02T13:05:00.000Z",
                      organizacao: { id: ID_EXEMPLO.organizacao, nome: "Studio Exemplo" },
                      contato: { telefone: "5511900000001", nomeExibicao: null },
                      deMim: true,
                      conteudo: { tipo: "texto", texto: "Oi, aqui é a Ana!" },
                      ticket: null,
                    },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "Validada e enfileirada.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RespostaEncaminhamento" }, examples: { aceito: { summary: "Aceita", value: { aceito: true } } } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        TokenDeServico: {
          type: "http",
          scheme: "bearer",
          description: "`AUTOATENDIMENTO_API_TOKEN`: segredo compartilhado entre o Eliza e o atendente (32+ caracteres). Cole só o token (o Swagger acrescenta `Bearer`).",
        },
        Ticket: {
          type: "apiKey",
          in: "header",
          name: HEADER_TICKET,
          description: "Ticket da conversa, do encaminhamento da mensagem mais recente (vale 30 min). Para testar no Swagger, gere um com `node scripts/ticket-dev.mjs`.",
        },
        Versao: {
          type: "apiKey",
          in: "header",
          name: HEADER_VERSAO,
          description: "Versão do contrato. O valor é `1`.",
        },
      },
      headers: HEADERS_COMUNS,
      schemas: componentes,
    },
  }
}
