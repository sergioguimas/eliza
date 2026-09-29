# Contrato — API de Autoatendimento

> **Tipo:** TO-BE. Nada disto existe no código ainda.
> **Versão do contrato:** 1 (`CONTRATO_VERSAO` em `web/contracts/autoatendimento/comum.ts`)
> **Escrito em:** 2026-09-23 · **Contexto de produto:** [../../CHATBOT.md](../../CHATBOT.md)
> **Fase:** F0 do Atendente Eliza

## Para quem executa

Este contrato é para implementação. Os `.md` desta pasta dizem **o que** fazer
e **por quê**; os Zod em `web/contracts/autoatendimento/` são a forma exata de
request e response. Se um `.md` e um Zod discordarem, o Zod vence para forma
e o `.md` vence para regra. Registre a divergência.

Onde este contrato der um valor fechado, use o valor. Onde der um critério,
aplique o critério. Se o código contradisser uma premissa daqui, o código
vence: pare, registre e siga o que é correto.

**Pré-requisito:** as correções de segurança de 2026-09-23 precisam estar
commitadas antes de começar (`createAppointmentCore` + `BookingContext` em
`create-appointment.ts`, `lib/phone-br.ts`, webhook autenticado). Este contrato
parte delas.

## Índice

| Arquivo | Conteúdo |
|---|---|
| este README | Fronteira, autenticação, envelope, erros, reaproveitamento, ordem de execução |
| [01-configuracao.md](01-configuracao.md) | Tabela `autoatendimento_config`, migration, envs |
| [02-contexto-e-identificacao.md](02-contexto-e-identificacao.md) | `GET /contexto`, como o cliente é identificado |
| [03-catalogo-e-horarios.md](03-catalogo-e-horarios.md) | Serviços, profissionais, horários livres |
| [04-agendamentos.md](04-agendamentos.md) | Listar, criar, remarcar, cancelar, confirmar |
| [05-cadastro.md](05-cadastro.md) | Ler, criar e atualizar o próprio cadastro |
| [06-mensagens-e-encaminhamento.md](06-mensagens-e-encaminhamento.md) | Webhook → atendente, envio de resposta, escalonamento |

## 1. A fronteira (o que "desmembrado" significa aqui)

O Eliza expõe uma **API de Autoatendimento** neutra: ela serve a um cliente
final falando por um canal, não "ao chatbot". Não há LLM, prompt nem lógica
de conversa no Eliza. O `eliza-atendente` é **um** consumidor dela.

Regras de fronteira, verificáveis por grep:

1. **O Eliza não importa nada do atendente.** O atendente não importa nada do
   Eliza, exceto uma cópia de `web/contracts/autoatendimento/`.
2. **O atendente não tem credenciais do Eliza além do token da API.** Não tem
   service role do schema `public` nem a API key da Evolution. Envia
   WhatsApp **pelo Eliza** (ver 06). Consequência: uma troca de gateway
   (Evolution Go, por exemplo) não toca o atendente.
3. **Todo código novo fica em três lugares:**
   - `web/app/api/v1/autoatendimento/**`: route handlers, finos (validar →
     chamar domínio → serializar);
   - `web/lib/autoatendimento/**`: ticket, autenticação, envelope, erros,
     encaminhamento, específicos deste canal;
   - `web/lib/domain/**`: regra de negócio extraída das server actions, que
     serve o app inteiro (não é do atendente).
   Mais um ramo no webhook do WhatsApp e uma migration.
4. **Remover o add-on** = apagar `app/api/v1/autoatendimento`,
   `lib/autoatendimento`, o ramo do webhook e dropar a tabela. `lib/domain`
   fica, porque o app passa a depender dela.
5. **O Eliza funciona igual com o atendente fora do ar** (fallback em 06).

## 2. Autenticação: duas camadas

Toda chamada a `/api/v1/autoatendimento/*` exige os três headers:

```http
Authorization: Bearer <AUTOATENDIMENTO_API_TOKEN>
X-Autoatendimento-Ticket: <token do ticket>
X-Autoatendimento-Versao: 1
```

| Camada | Prova | Falha |
|---|---|---|
| Token de serviço | Que quem chama é o atendente | `TOKEN_INVALIDO` |
| Ticket de conversa | **Qual org e qual telefone**, e que esse telefone mandou mensagem há menos de 30 min | `TICKET_AUSENTE` / `TICKET_INVALIDO` / `TICKET_EXPIRADO` |
| Versão | Mesma versão de contrato nos dois lados | `VERSAO_INCOMPATIVEL` |

**Organização e telefone saem SÓ do ticket.** Nenhum endpoint aceita
`organizationId`, `customerId` ou telefone em header, query ou body. Os Zod
são `.strict()` justamente para rejeitar isso. Esta é a regra D6 do
CHATBOT.md, aplicada no lado do Eliza: mesmo um atendente com bug, ou
convencido por injeção de prompt, só age sobre quem mandou mensagem de fato.

**Ticket** (`contracts/autoatendimento/ticket.ts`):

- Emitido pelo webhook a cada mensagem recebida e encaminhada (06).
- `payload.assinatura`: payload em base64url(JSON) e HMAC-SHA256 com
  `AUTOATENDIMENTO_TICKET_SECRET`, que existe só no Eliza.
- TTL de 30 min (`TICKET_TTL_SEGUNDOS`). Cada mensagem nova traz ticket novo;
  o atendente usa sempre o mais recente.
- Validação: assinatura com `crypto.timingSafeEqual` e `exp` > agora. Depois
  disso a org do ticket **ainda precisa** ter a instância `inst` e o add-on
  ativo (senão `ADDON_INATIVO`). Isso cobre o add-on desligado no meio da
  conversa e o número trocado de org.
- Sem biblioteca de JWT: `node:crypto` basta. O formato é propositalmente
  mínimo.

Token de serviço comparado com `timingSafeEqual`. Rotação = trocar a env nos
dois lados.

## 3. Envelope e erros

Toda resposta, sucesso ou erro, usa o mesmo envelope:

```jsonc
{ "ok": true,  "dados": { ... } }
{ "ok": false, "erro": { "codigo": "HORARIO_INDISPONIVEL", "mensagem": "...", "detalhes": { } } }
```

- O status HTTP segue `STATUS_HTTP_POR_CODIGO` (`comum.ts`).
- `mensagem` é em português, escrita para o atendente repassar ao cliente,
  e **nunca** contém dado de outro cliente.
- Agendamento ou cadastro de outro cliente responde `NAO_ENCONTRADO`, nunca
  "proibido": a API não confirma que o registro existe.
- Erro inesperado responde `ERRO_INTERNO`, com o detalhe só no log do
  servidor. Log com prefixo `[autoatendimento:<rota>]` e sem string de erro
  repetida em dois `return` da mesma função (lição registrada no DEPLOY).

## 4. Horário

- **Entrada:** hora de relógio em `America/Sao_Paulo`, sem offset
  (`"2026-10-05T14:30"`). É a forma que o cliente fala e que o LLM erra menos.
- **Saída:** todo instante vem como `Momento` = `{ utc, local }`.
- A conversão usa a função que já existe em `create-appointment.ts`
  (`parseAppointmentWallTimeToUtc`), movida para `lib/domain/tempo.ts`.
  Não reimplementar.

## 5. O que se reaproveita da página pública

A página `/marcar/[slug]` já resolve boa parte do problema: um visitante sem
sessão consultando catálogo e horários e pedindo agendamento. O
autoatendimento é esse mesmo fluxo, com o cliente identificado pelo telefone
em vez de anônimo.

| Peça existente (AS-IS) | Destino | O que muda |
|---|---|---|
| Consulta de serviços e profissionais ativos em `marcar/[slug]/page.tsx` | `lib/domain/catalogo.ts` | Colunas explícitas em vez de `select('*')`. A página pública passa a chamar a função. |
| `getAvailableSlots` (`actions/get-available-slots.ts`) | `lib/domain/horarios.ts` | Passa a considerar a **duração do serviço** (hoje o slot só cabe `appointment_duration` da org) e a descartar horários passados e fora da antecedência e da janela. A action vira um wrapper fino. Detalhes em 03. |
| `createAppointmentCore` + `BookingContext` (sessão de segurança) | `lib/domain/agendamentos.ts` → `criarAgendamento` | O contexto ganha `canal`, `statusInicial`, `notificar` e `clienteId` já resolvido. Painel e página pública continuam passando por ela. |
| `parseAppointmentWallTimeToUtc` e helpers de fuso | `lib/domain/tempo.ts` | Só move. |
| `brPhoneVariants` (`lib/phone-br.ts`) | Identificação (02) | Só usa. |
| `consumeRateLimit` / `hashIdentifier` (`lib/demo/rate-limit.ts`) | Limites de taxa | Prefixos próprios `aa-*`. |
| Dicionário Keckleon (`lib/dictionaries/niches.ts`) | `Contexto.organizacao.termos` | Só lê `entities` e `gender`. |
| Exclusion constraint `appointments_professional_overlap_idx` | Garantia final contra sobreposição | Nada; `23P01` vira `HORARIO_INDISPONIVEL`. |
| `sendWhatsAppMessage` | `lib/whatsapp/gateway.ts` → `enviarTexto` | Encapsula; devolve o id da mensagem na Evolution. |

**Não reaproveitar:**

- **RPCs `request_public_appointment` e `find_or_create_public_customer`.**
  Nenhum código as chama, e a segunda **atualiza um cadastro existente só
  por casar o telefone** e devolve a linha inteira. Esse é exatamente o
  comportamento que o autoatendimento não pode ter, e é também uma falha
  aberta para `anon` (tarefa separada, 2026-09-23). A checagem de
  sobreposição da RPC também diverge da constraint (esquece `arrived`).
- **O classificador por palavra-chave do webhook.** Ele fica só como fallback
  (06).

## 6. Limites (valores fechados)

Reusar `consumeRateLimit`. Identificador = `hashIdentifier(prefixo, org + ":" + telefone do ticket)`.

| Prefixo | Onde | Janela | Máx. |
|---|---|---|---|
| `aa-escrita` | criar, remarcar, cancelar, confirmar, POST/PATCH cadastro | 1 h | 20 |
| `aa-criar` | criar agendamento | 24 h | 5 |
| `aa-msg-contato` | enviar mensagem | 1 h | 60 |
| `aa-msg-org` | enviar mensagem (id = só a org) | 1 h | 600 |
| `aa-escalar` | escalonamento | 1 h | 3 |

Esgotou: `LIMITE_TAXA`, com `detalhes.tenteNovamenteEm` (UTC). Estes limites
contêm um atendente em loop, não o cliente. Regra de negócio (máximo de
agendamentos ativos por cliente) fica em 04.

## 7. Ordem de execução (F0)

Cada passo termina com o app funcionando igual para painel e página pública.

1. **`lib/domain/tempo.ts`, `catalogo.ts`, `horarios.ts`**: extrair e apontar
   a página pública e a action para eles. Verificar `/marcar/[slug]` no
   browser: mesmos serviços; horários iguais para serviço de duração igual à
   da org; menos horários (e corretos) para serviço mais longo.
2. **`lib/domain/agendamentos.ts`**: mover `createAppointmentCore` e
   generalizar o contexto. Criar pelo painel e pela página pública, e conferir
   status, mensagem de WhatsApp e `appointment_logs`.
3. **Migration de `autoatendimento_config`** (01). É aditiva e não revoga
   nada, então não há ordem de deploy a respeitar.
4. **`lib/whatsapp/gateway.ts`**.
5. **`lib/autoatendimento/`**: `ticket.ts`, `autenticar.ts` (wrapper de rota
   que valida os headers e devolve `{ org, telefone, config }`),
   `resposta.ts` (envelope) e `identificar.ts` (02).
6. **Rotas, nesta ordem:** contexto → servicos/profissionais/horarios →
   agendamentos (GET) → cadastro → escrita de agendamentos → mensagens →
   escalonamentos.
7. **Ramo de encaminhamento no webhook** (06).
8. **`supabase gen types`** depois da migration (`utils/database.types.ts`),
   nunca à mão.

**Verificação:** o repo não tem framework de teste. Cada `.md` de domínio
termina com um checklist de aceite. Execute com `curl` contra o dev server,
usando um ticket gerado por um script local com o segredo de dev, e registre
o resultado em `docs/RELATORIO_AUTOATENDIMENTO_F0.md`.

## 8. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| C1 | API neutra "Autoatendimento", sem nada de chatbot no Eliza | `/api/v1/atendente` | Fronteira: o Eliza não sabe que do outro lado há um LLM. Outro canal pode consumir a mesma API. |
| C2 | Ticket assinado pelo Eliza carrega org e telefone | Headers `X-Org` / `X-Telefone` confiando no atendente | Leva a D6 para o lado que é dono do dado. Um atendente comprometido não vira acesso a todos os clientes. |
| C3 | Atendente envia WhatsApp **via Eliza** | Atendente com API key da Evolution | A key global da Evolution envia por **qualquer** tenant. Pelo Eliza, só responde a quem escreveu, pela instância certa. De quebra, a troca de gateway fica 100% no Eliza. |
| C4 | Criar/remarcar valida `inicio` contra a **mesma** função que lista horários | Validações separadas (como hoje: slots de um lado, `checkOrganizationBusinessHours` do outro) | Uma fonte só: se a API ofereceu, ela aceita; se não ofereceu, recusa. |
| C5 | Idempotência natural em vez de tabela | Header `Idempotency-Key` + tabela | Retentativa de criação cai na exclusion constraint; se o conflito é com um agendamento **do mesmo cliente, mesmo profissional, mesmo início, criado há menos de 10 min**, devolve esse como sucesso. Sem tabela nova. |
| C6 | Config em tabela própria `autoatendimento_config` (fecha A2 do CHATBOT.md) | Colunas em `organization_settings`; tabela genérica `org_addons` com jsonb | Tipada, RLS própria e sai inteira com um `drop` se o add-on morrer. `jsonb` genérico perde CHECK e tipo. |
| C7 | Token de serviço único + ticket (fecha A3) | Token por org | Com o ticket, o token por org não reduz o raio de estrago: o atendente teria todos de qualquer forma. |

C6 e C7 fecham as pendências A2 e A3 do CHATBOT.md **como recomendação**.
Confirmar com o Sérgio antes de executar o passo 3.

## 9. Fora deste contrato

- Tela de configuração do add-on no painel. Na F0 liga-se pelo Studio.
- Mensagens proativas iniciadas pelo atendente (sem ticket, não há como).
- Mídia, áudio e localização (`conteudo.tipo = "nao_suportado"`).
- Qualquer coisa do serviço `eliza-atendente` além do que ele precisa
  consumir e expor (os endpoints dele são só o de 06).
