# 08 — Canal web: chat da página pública `/marcar/[slug]`

> TO-BE · Contrato v1, **revisão aditiva** (o header de versão continua `1`, ver C21) · ver [README](README.md)
> **Escrito em:** 2026-10-26 · **Origem do pedido:** `Projetos/sola-agens/docs/RODADA-4-CANAL-WEB-MARCAR.md`
> (decisões W1–W10, resumo no `sola-agens/CONTRATO.md §10`, rodada 4)
> **Zod tocados:** `ticket.ts`, `contexto.ts`, `comum/envelope.ts`; **novo:** `web.ts`

## Para quem executa

Mesmas regras do [README](README.md#para-quem-executa): os `.md` dizem **o que** e **por quê**; os Zod
são a forma exata. Onde este arquivo der um valor fechado, use o valor. Se o código contradisser uma
premissa daqui, o código vence: pare, registre e siga o que é correto.

**O que se constrói:** um botão flutuante na página pública abre um chat. O cliente conversa com o
agente Eliza do sola-agens, que consulta serviços, profissionais e horários **da própria org** e,
quando a escolha fecha, devolve uma **ação** que preenche o formulário. **O chat nunca grava** (W1):
quem cria o agendamento continua sendo o "Agendar agora" do formulário, pelo mesmo caminho de hoje.
Nada aqui coloca LLM, prompt ou lógica de conversa no Eliza (C1 continua valendo).

**Pré-requisitos:** contrato 07 executado (está: commit 161b289). O lado do Eliza pode ser construído e
testado com um agens falso; ligar em produção exige a F2a do sola-agens (W10: depois do aceite da F1).

```txt
navegador (/marcar/slug)             Eliza                                         sola-agens
 chat ──POST /api/marcar/{slug}/chat─▶ sessão (cookie), limites, emite ticket visitante
        { texto, formulario }          ──POST {ATENDENTE_URL}/v1/web (assinado)──▶ turno síncrono
                                                                                   ├─ GET /contexto        (visitante)
                                                                                   ├─ GET /servicos, /profissionais, /horarios
                                                                                   └─ ferramenta de canal → acoes
 ◀── { resposta, acoes[] } ───────────◀── { resposta, acoes[] } ──────────────────┘
 aplicarAcao(): valida contra as listas e os horários, preenche, muda de etapa
```

## Resumo

| # | Mudança | Por quê |
|---|---|---|
| 1 | Coluna `canal_web` em `autoatendimento_config` | Liga o chat por org, independente do WhatsApp (W8) |
| 2 | Ticket de **visitante** (schema próprio, sem telefone) | Identidade do canal anônimo emitida pelo Eliza, nunca pelo modelo (W2) |
| 3 | Autenticador `autenticarTicketOuVisitante` em 4 rotas | Visitante só alcança catálogo, horários e contexto |
| 4 | Contexto com `situacao: "visitante"` | O agente sabe que não há cliente e não oferece o que exige um |
| 5 | Marca `x-atendente-publico: true` na OpenAPI | O agens filtra as ferramentas do modo anônimo pela spec |
| 6 | Rota `POST /api/marcar/{slug}/chat` | Mesma origem, limites, sessão, encaminhamento ao agens (W3, W6) |
| 7 | Chat na página e `aplicarAcao` no formulário | O pré-preenchimento em si (W4, W9) |

---

## 1. Coluna `canal_web`

Migration `supabase/migrations/<timestamp>_autoatendimento_canal_web.sql`, aditiva:

```sql
alter table public.autoatendimento_config
  add column canal_web boolean not null default false;
```

`carregarConfig` (`lib/autoatendimento/config.ts`) passa a devolver `canalWeb: boolean`. Não muda a
regra de `null` (sem linha ou `ativo = false` → `null`): **`canal_web` sozinho não liga nada**.

**Chat ativo para uma org** = `ATENDENTE_URL` definida **e** `carregarConfig(db, org)` não nulo (já
exclui org demo) **e** `canalWeb = true`. Uma função só, `chatWebAtivo(db, org)` em
`lib/autoatendimento/config.ts`, usada pela página (§7) e pela rota do chat (§6).

## 2. Ticket de visitante

Em `contracts/autoatendimento/ticket.ts`, um **schema separado**, sem mexer no `TicketPayload`:

```ts
export const TicketVisitantePayload = z.object({
  v: z.literal(1),
  tipo: z.literal("visitante"),
  /** organizations.id, resolvido pelo slug da página */
  org: Uuid,
  /** id da sessão do chat (cookie, §6.1) */
  sess: Uuid,
  iat: z.number().int(),
  exp: z.number().int(),
}).strict()
```

`lib/autoatendimento/ticket.ts`:

- `emitirTicketVisitante({ org, sess })`: mesmo formato `payload.assinatura`, mesmo segredo, mesmo TTL
  (`TICKET_TTL_SEGUNDOS`).
- `validarTicket` passa a devolver `{ ok: true, tipo: "conversa", payload }` ou
  `{ ok: true, tipo: "visitante", payload }`: tenta `TicketPayload`, depois `TicketVisitantePayload`;
  nenhum dos dois → `invalido`. A assinatura continua sendo conferida **antes** do parse.

**Por que não quebra o que existe:** `TicketPayload` exige `tel`, `inst` e `msg`, que o visitante não
tem. Um ticket de visitante falha nesse parse; o de conversa falha no do visitante (`.strict()` +
`tipo`). Cada autenticador aceita só o tipo dele (§3), então nenhuma rota de hoje passa a aceitar
visitante por acidente.

**O ticket de visitante nunca sai do servidor** (C14): a rota do chat (§6) emite um a cada mensagem e
o manda direto ao agens. O navegador só tem o cookie de sessão.

## 3. Autenticação

- `autenticarTicket` (hoje): **aceita só `tipo: "conversa"`**; visitante → `TICKET_INVALID`. Sem outra
  mudança.
- Novo `autenticarTicketOuVisitante` em `lib/autoatendimento/autenticar.ts`. Passos 1–4 iguais aos de
  `autenticarTicket` (envs, token de serviço, versão, ticket). No passo 5:
  - conversa → exatamente o passo 5 de hoje;
  - visitante → `chatWebAtivo(db, org)`; falso → `ADDON_INACTIVE`.

  Devolve `ContextoAutoatendimento` com `telefone: string | null` (`null` para visitante) e
  `mensagemId: string | null`. As rotas que usam `autenticarTicket` continuam recebendo `string`:
  tipar com dois tipos (`ContextoConversa`, `ContextoAutoatendimento`) para o compilador barrar uso de
  `telefone` nulo onde ele é obrigatório.

**Rotas que trocam para `autenticarTicketOuVisitante`, e só estas:** `GET /contexto`, `GET /servicos`,
`GET /profissionais`, `GET /horarios`. Todas as outras (agendamentos, cadastro, mensagens, mídia,
escalonamento) continuam em `autenticarTicket`.

## 4. Contexto do visitante

`Identificacao` (`contracts/autoatendimento/contexto.ts`) ganha a variante:

```ts
z.object({ situacao: z.literal("visitante") }),
```

`montarContexto(db, { org, telefone, config })` com `telefone = null`:

- `identificacao = { situacao: "visitante" }`, sem chamar `identificarCliente`;
- `agendamentos = []` e `aguardandoConfirmacao = []`;
- o resto igual (agora, organização, termos, expediente, política, `atendente`).

Descrição de `obterContexto` na OpenAPI: acrescentar uma frase sobre `visitante`: "pessoa na página
pública, sem identidade; só consulta catálogo e horários e não age sobre agendamento ou cadastro".

## 5. Marca `x-atendente-publico`

Em `web/lib/openapi/autoatendimento.ts`, acrescentar `"x-atendente-publico": true` (ao lado de
`"x-atendente": true`) **exatamente** em `listarServicos`, `listarProfissionais` e `consultarHorarios`.
`obterContexto` continua sem marca nenhuma (o agens o chama por conta própria).

No `DESCRICAO_GERAL`, depois do parágrafo do `x-atendente`: "Operações com `x-atendente-publico: true`
também ficam disponíveis no modo anônimo (canal web, ticket de visitante); as demais recusam esse
ticket."

**Coerência que o teste trava:** toda operação com `x-atendente-publico` usa
`autenticarTicketOuVisitante`, e toda rota com esse autenticador (fora `obterContexto`) tem a marca.

## 6. Rota do chat: `POST /api/marcar/[slug]/chat`

Arquivo `web/app/api/marcar/[slug]/chat/route.ts`. **Não é `/api/v1`**: é uma rota interna da página,
fora da OpenAPI e sem token de serviço. Respostas no mesmo envelope (`{ data }` / `{ error }` de
`lib/http/erros`).

### 6.1 Entrada e sessão

Zod em `contracts/autoatendimento/web.ts` (novo):

```ts
export const CHAT_TEXTO_MAX = 500

export const ChatWebBody = z.object({
  texto: z.string().trim().min(1).max(CHAT_TEXTO_MAX),
  /** Estado do formulário, só como dica ao agente. Não é confiável e não autoriza nada. */
  formulario: z.object({
    etapa: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    servicoId: Uuid.nullable(),
    profissionalId: Uuid.nullable(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    hora: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  }).strict(),
}).strict()
```

Ordem do handler:

1. `Content-Type` diferente de `application/json` → `INVALID_JSON`; `Origin` presente e diferente do host da
   requisição → 403 `FORBIDDEN`. Isso não impede chamadas de fora do navegador (os limites cobrem),
   mas impede outro site de embutir o chat.
2. Org pelo `slug` (admin client, colunas `id, name, slug, is_demo`); não achou → `NOT_FOUND`.
3. `chatWebAtivo(db, org.id)` falso → `ADDON_INACTIVE` (403).
4. Sessão: cookie `eliza_chat` (UUID v4 de `crypto.randomUUID()`), `HttpOnly`, `Secure`,
   `SameSite=Lax`, `Path=/api/marcar`, `Max-Age=7200`. Sem cookie ou valor inválido → cria um e devolve
   no `Set-Cookie` da resposta. O cookie não identifica a pessoa; só agrupa o turno.
5. Limites (§8). Esgotou → `RATE_LIMITED` como nas outras rotas.
6. Corpo com `ChatWebBody`; inválido → `VALIDATION_ERROR`.
7. `emitirTicketVisitante({ org: org.id, sess })`.
8. Encaminha ao agens (§6.2) e devolve `{ data: ChatWebResposta }`.

**Nada da conversa é gravado no Eliza:** nem banco, nem log com texto. Log só
`[marcar:chat] org=<id> status=<ok|motivo> ms=<n> acoes=<n>`.

### 6.2 Eliza → agens

`POST {ATENDENTE_URL}/v1/web`, com as mesmas envs (`ATENDENTE_URL`, `ATENDENTE_ENCAMINHAMENTO_SECRET`)
e a mesma assinatura do encaminhamento (`X-Eliza-Assinatura`, `X-Eliza-Timestamp`,
`assinarEncaminhamento`). Reaproveitar a função de assinatura de `encaminhar.ts`; não duplicar.

```ts
export const MensagemWeb = z.object({
  versao: z.literal(1),
  canal: z.literal("web"),
  /** UUID v4 novo por mensagem; o agens deduplica por ele */
  mensagemId: Uuid,
  orgId: Uuid,
  /** "web:" + sess: chave da conversa no agens */
  contato: z.string().regex(/^web:[0-9a-f-]{36}$/),
  texto: z.string().min(1).max(CHAT_TEXTO_MAX),
  recebidaEm: InstanteUtc,
  ticket: TicketEmitido,
  formulario: ChatWebBody.shape.formulario,
}).strict()
```

Timeout **45 s** (`AbortController`). O agens responde **no corpo**, 200:

```ts
export const AcaoPreencherAgendamento = z.object({
  tipo: z.literal("preencher_agendamento"),
  servicoId: Uuid.optional(),
  profissionalId: Uuid.optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora: z.string().regex(/^\d{2}:\d{2}$/).optional(),
}).strict().refine((a) => a.servicoId || a.profissionalId || a.data || a.hora, "ação vazia")

export const AcaoChatWeb = z.discriminatedUnion("tipo", [AcaoPreencherAgendamento])

export const ChatWebResposta = z.object({
  resposta: z.string().min(1).max(2000),
  acoes: z.array(AcaoChatWeb).max(3),
}).strict()
```

Resultado:

- 200 com corpo válido → repassa ao navegador como está;
- 200 com corpo inválido, outro status, timeout ou erro de rede → `ATENDENTE_UNAVAILABLE` (código novo,
  502, em `contracts/comum/envelope.ts`), motivo só no log. O navegador mostra uma mensagem fixa e
  aponta o formulário (§7);
- `ATENDENTE_URL` ausente → nunca chega aqui (o passo 3 já recusou).

## 7. Página: botão, chat e `aplicarAcao`

### 7.1 Ligar

`app/marcar/[slug]/page.tsx` calcula `chatAtivo = await chatWebAtivo(admin, organization.id)` e passa
para `PublicBookingForm`. Falso → nada do chat é renderizado nem carregado.

### 7.2 Interface (W9)

Componente próprio `app/marcar/[slug]/chat-agendamento.tsx`, client, carregado com `next/dynamic`
(`ssr: false`) **só depois do primeiro toque no botão**: quem não usa o chat não baixa o chat.

- **Botão flutuante**, canto inferior direito, ícone de conversa + rótulo "Ajuda para escolher" no
  desktop (só o ícone no celular, com `aria-label`). No celular fica **acima da barra fixa** de
  `public-booking-form.tsx` (a barra tem ~120 px; usar uma variável CSS da altura da barra em vez de um
  número solto) e nunca a cobre. Some enquanto o chat está aberto.
- **Chat:** no celular, tela cheia (`100dvh`, com `env(safe-area-inset-*)`); no desktop (≥ `xl`),
  painel de 380 × 560 px ancorado no canto. `role="dialog"`, `aria-modal`, foco preso, `Esc` fecha,
  o foco volta ao botão.
- **Topo:** nome da org + "Assistente automático" + aviso fixo (W7): "Não informe CPF, documentos ou
  dados de saúde aqui. Seus dados são pedidos só no formulário."
- **Abertura:** uma mensagem fixa (não vem do agens) e três sugestões tocáveis: "Quais serviços vocês
  têm?", "Qual o próximo horário livre?", "Me ajuda a escolher".
- **Envio:** campo de texto com contador acima de 400 caracteres, bloqueado enquanto espera; indicador
  de digitação; histórico **só em memória** (fechar e reabrir mantém; recarregar a página perde).
- **Erros:** `RATE_LIMITED` → "Muitas mensagens seguidas. Tente de novo em alguns minutos, ou continue
  pelo formulário."; `ATENDENTE_UNAVAILABLE`, `ADDON_INACTIVE` ou rede → "Não consegui responder agora.
  Você pode continuar pelo formulário." Nunca mostrar código nem detalhe técnico.
- Cores do tema do nicho (tokens já usados na página); nada de cor fixa.

### 7.3 `aplicarAcao(acao)` em `public-booking-form.tsx`

Exportada do formulário para o chat por callback (prop `onAcao`), nunca por evento global.

1. **Filtra pelo que a página conhece:** `servicoId` fora de `services` e `profissionalId` fora de
   `professionals` são descartados. `data` anterior a hoje (data local) ou em domingo é descartada:
   é a regra do atalho "Hoje" e do `disabled` do `Calendar` (que hoje bloqueia o próprio dia no
   calendário, mas o atalho aceita; o chat segue o atalho). Sobrou nada → nada muda.
2. Aplica `service_id` e `professional_id` com `form.setValue(..., { shouldValidate: true })`.
3. Aplica `date` (meia-noite local de `data`).
4. **Hora — armadilha conhecida:** trocar serviço, profissional ou data dispara o efeito que recarrega
   os horários e **zera `time`**. Por isso a hora **não** é aplicada aqui: vai para um estado
   `horaPendente`. O efeito de horários, depois do `setSlots`, faz: se `horaPendente` está em
   `result.slots`, `setValue("time", horaPendente)`; em qualquer caso, limpa `horaPendente`. Se
   **nenhum** dos três (serviço, profissional, data) mudou de valor, seja porque a ação trouxe só
   `hora` ou porque repetiu o que já estava escolhido, o efeito não roda: confere direto contra os
   `slots` já carregados.
5. **Etapa:** vai para a primeira etapa com escolha faltando (sem serviço ou profissional → 1; sem data
   ou hora → 2; tudo preenchido → 3). Usa `setCurrentStep` direto, sem as validações com toast.
6. **Nunca submete.** Nem chama `handleFinalSubmit`, nem foca o botão de envio.
7. Devolve ao chat um resumo do que entrou e do que foi descartado. O chat mostra uma linha de sistema
   (não do agente), por exemplo "Preenchi: Alongamento, com Ana, sex. 31/10 às 14:00." ou "O horário
   14:00 não está mais livre; escolha outro na etapa 2.", e um botão **"Ver no formulário"** que fecha o
   chat. O chat não fecha sozinho.

O resultado do passo 7 **não volta ao agens** na v1: a próxima mensagem do cliente já leva o
`formulario` atualizado (§6.1), e é por ali que o agente fica sabendo.

## 8. Limites (W6, valores fechados)

Reusar `consumeRateLimit` + `hashIdentifier`. IP por `getClientIp` (`lib/demo/rate-limit.ts`).

| Prefixo | Identificador | Janela | Máx. |
|---|---|---|---|
| `aa-web-sessao` | `org:sess` | 2 h | 20 |
| `aa-web-ip` | `ip` | 1 h | 60 |
| `aa-web-org` | `org` | 24 h | 1000 |

O `aa-web-org` é a trava do Eliza contra custo; o teto de turnos por org do agens (W6, padrão 300/dia)
é a do agens, configurável lá. Os dois existem de propósito: um não depende do outro estar certo. O
tamanho de 500 caracteres é do Zod (§6.1).

`consumirLimite` hoje recebe `{ org, telefone }`: acrescentar uma função irmã para estes três, em vez de
forçar o telefone.

## 9. O que não muda

- Criação de agendamento pela página: mesma action, mesmas validações, mesmo `pending`.
- Toda rota de agendamento, cadastro, mensagens, mídia e escalonamento: ticket de conversa só.
- Encaminhamento do WhatsApp (06/07): nada.
- `CONTRATO_VERSAO` continua `1` (C21).

## 10. Ordem de execução

1. Migration (§1), aplicada via MCP, com o efeito conferido no catálogo (`canal_web` existe, `default
   false`). Types regenerados.
2. `carregarConfig` + `chatWebAtivo` (§1).
3. Ticket de visitante (§2) com testes: emite/valida; conversa ≠ visitante nos dois sentidos; 1 byte
   trocado → inválido; vencido → expirado.
4. Autenticadores (§3) e as 4 rotas; contexto do visitante (§4).
5. OpenAPI (§5) + teste de coerência marca ↔ autenticador.
6. Zod `web.ts`, código `ATENDENTE_UNAVAILABLE`, limites (§8), rota do chat (§6) com agens falso
   (`httptest`-like: um handler local que devolve `ChatWebResposta` fixa).
7. Página: `chatAtivo`, botão, chat (§7.1–7.2).
8. `aplicarAcao` + `horaPendente` (§7.3).
9. Aceite (§11). Commit na `development`; PR só depois do aceite.

## 11. Aceite

Curls (org `admin` em dev, `canal_web = true`) e browser em 375 px e ≥ 1280 px:

| # | Verificação | Esperado |
|---|---|---|
| 1 | Ticket de visitante em `POST /agendamentos`, `GET /cadastro`, `POST /mensagens`, `GET /midia` | `TICKET_INVALID` |
| 2 | Ticket de visitante em `/servicos`, `/profissionais`, `/horarios` | 200, mesma forma do ticket de conversa |
| 3 | Ticket de visitante em `/contexto` | `identificacao.situacao = "visitante"`, `agendamentos = []` |
| 4 | Ticket de conversa nas 4 rotas e no resto | igual a hoje |
| 5 | Visitante com `canal_web = false`, `ativo = false` ou org demo | `ADDON_INACTIVE` |
| 6 | `POST /api/marcar/{slug}/chat` com `canal_web = false` | 403; botão não aparece na página |
| 7 | 21ª mensagem na mesma sessão | `RATE_LIMITED` com `Retry-After` |
| 8 | Corpo com campo a mais (`organizationId`) ou texto de 501 caracteres | `VALIDATION_ERROR` |
| 9 | `Origin` de outro host | 403 |
| 10 | Agens fora do ar / timeout / corpo inválido | `ATENDENTE_UNAVAILABLE`; chat mostra a mensagem fixa |
| 11 | Ação com `servicoId` de outra org | ignorada; o chat avisa; formulário intacto |
| 12 | Ação completa (serviço, profissional, data, hora livre) | etapa 3, os quatro campos preenchidos, **nada enviado** |
| 13 | Ação com hora que não está livre | etapa 2, data preenchida, hora vazia, aviso no chat |
| 14 | Celular: botão acima da barra, nunca sobre o "Continuar"; chat em tela cheia; `Esc`/fechar devolve o foco | ok |
| 15 | Página sem `chatAtivo` | nenhum JS do chat no bundle carregado (Network) |
| 16 | Log do Eliza depois de uma conversa | nenhum texto de mensagem |

## 12. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| C14 | **O ticket de visitante nunca chega ao navegador:** a rota do chat emite um por mensagem e o envia direto ao agens; o navegador só tem um cookie de sessão `HttpOnly` | Emitir ao renderizar a página e o navegador repassar (texto original da W2) | Mesma identidade (org pelo slug, assinada pelo Eliza), sem token exposto no HTML e sem renovação no cliente. Refina a W2 sem mudar a decisão |
| C15 | **Schema de visitante separado** do `TicketPayload`, `.strict()` com `tipo` | União discriminada no `TicketPayload` | Falha fechada: nenhum consumidor de hoje aceita um visitante por acidente, porque o parse dele já recusa |
| C16 | **Autenticador separado**, usado só em 4 rotas | Um autenticador com parâmetro "aceita visitante" | Quem esquece o parâmetro numa rota nova abre a rota; com dois autenticadores, o padrão é o restrito |
| C17 | **`x-atendente-publico`** na OpenAPI | Lista de ferramentas do anônimo no registro do agens | O sistema é dono do que é público (A4/P2 do sola-agens); a lista fica perto do autenticador que a garante, e um teste trava os dois |
| C18 | **Rota do chat fora de `/api/v1`**, sem token de serviço, com cookie de sessão | Operação pública na OpenAPI | É a ponte da página para o atendente, não uma API para terceiros; não deve aparecer no Swagger nem receber API key |
| C19 | **Hora aplicada pelo efeito de horários** (`horaPendente`) | Buscar os horários de novo dentro de `aplicarAcao` | O efeito zera `time` depois de qualquer troca; duas buscas concorrentes disputariam o campo. Uma fonte só, a mesma da escolha manual |
| C20 | **Ação não volta ao agens**; o próximo turno leva o `formulario` | Rota de "ação aplicada" | Menos uma chamada e um estado a menos no agens; o formulário é a verdade e já viaja a cada mensagem |
| C21 | **Revisão aditiva, versão continua `1`** | Subir `CONTRATO_VERSAO` | Tudo é acréscimo (coluna, variante de `Identificacao` que só aparece com ticket de visitante, schema novo, marca nova, rota fora da v1); o único consumidor é o sola-agens, que constrói a F2a já com esta revisão |

## 13. Fora deste contrato

- **Lado do sola-agens** (F2a): entrada `/v1/web`, modo anônimo filtrando por `x-atendente-publico`,
  ferramenta de canal `preencher_agendamento`, prompt do canal (não pedir dado pessoal, W7), retenção
  de 7 dias (W5), teto diário por org (W6), fastpath desligado no anônimo.
- Streaming da resposta (W4: só quando a latência medida justificar).
- Agendar pelo chat (W1) e qualquer identificação do visitante.
- Embed genérico para outros sites (W9/W10: F2b).
- Tela para a org ligar o `canal_web`: na F2a, pelo Studio, como o resto da config (01).
