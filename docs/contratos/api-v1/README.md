# Contrato — API REST v1 B2B (`/api/v1/*`)

> **Tipo:** AS-IS + TO-BE. O código existe (commit `a0ff88a`, 2026-09-30,
> só na `development`) e foi escrito **sem contrato**. Este documento ratifica
> o que fica (AS-IS) e descreve as correções (TO-BE, marcadas assim).
> **Escrito em:** 2026-10-06 · **Decisões:** [../DECISOES_API.md](../DECISOES_API.md) (D1–D7)
> **Depende de:** [00-dominio](../00-dominio/README.md) (executar antes)
> **Zod:** `web/contracts/api-v1/` (substitui `web/lib/api/schemas.ts`) e `web/contracts/comum/envelope.ts`
> **Doc pública:** `docs/API.md`. Atualizar ao fim para refletir este contrato.

## Para quem executa

Os `.md` dizem **o quê** e **por quê**; os Zod são a forma exata. Se
discordarem, o Zod vence para forma e o `.md` para regra. Registre a
divergência em `docs/RELATORIO_API_V1.md`.

A v1 é para **o tenant integrar o próprio sistema** (agente de IA dele, n8n,
ERP). A chave age como o tenant: tem o mesmo poder do painel, menos o que este
contrato tira (exclusão) ou separa (pagamento). É diferente do
[Autoatendimento](../autoatendimento/README.md), que age como **um cliente
final** e só enxerga os próprios dados.

## 1. Fronteira

| Pasta | Conteúdo |
|---|---|
| `web/app/api/v1/**` (exceto `autoatendimento/`) | Route handlers finos: validar com Zod → chamar `lib/domain` → serializar |
| `web/lib/http/` **(TO-BE, D3)** | Núcleo comum às duas APIs: `rota.ts` (wrapper), `erros.ts` (`ApiError`, mapa de `DomainError`), `resposta.ts` |
| `web/lib/api/` | Só o que é da autenticação por API key: `keys.ts`, `autenticar-chave.ts`, `planos.ts` |
| `web/app/actions/api-keys.ts` + `components/settings/api-keys-settings.tsx` | Gestão de chaves no painel (AS-IS) |

**TO-BE:** `lib/api/domain/` e `lib/api/tempo.ts` são **apagados** (passo 5 de
00-dominio). `lib/api/schemas.ts` também, substituído por `web/contracts/api-v1`.
Nenhuma rota faz `insert`/`update` direto em `appointments`.

## 2. Autenticação e autorização

### AS-IS (ratificado)

- `Authorization: Bearer elz_live_<43 chars base64url>`. O banco guarda só
  SHA-256 + prefixo (`elz_live_` + 6). A chave em claro aparece uma vez.
- **O tenant sai só da chave.** Nenhum body/query/header aceita
  `organization_id` (Zod `.strict()`). Recurso de outro tenant → 404.
- Chave revogada ou expirada → 401. Org `is_demo` ou
  `subscription_status = 'suspended'` → 403 `ORGANIZATION_SUSPENDED`.
- Máx. 10 chaves ativas por tenant. Só owner/admin cria e revoga (action com
  papel lido da sessão). Demo não cria chave.
- Rate limit de 120 req/min por chave (`consumeRateLimit`, prefixo `api-key`).
- `middleware.ts` ignora `/api/v1` (não há sessão de cookie).

### TO-BE

**a) Escopo `payments` (D5).**

| Escopo | Libera |
|---|---|
| `read` | Todos os `GET` |
| `write` | Criar, editar, confirmar, cancelar, mudar status |
| `payments` | `POST /appointments/{id}/payment` (e só ele) |

- Migration: `api_keys_scopes_check` passa a aceitar `'payments'`. É aditiva,
  e chaves existentes **não** ganham o escopo.
- Painel: o checkbox "Permitir escrita" vira dois checkboxes, "Permitir
  escrita" e "Permitir baixa de pagamento", ambos desmarcados por padrão.
  `read` é sempre incluído.
- `payments` sem `write` é válido (integração de caixa que só dá baixa).

**b) Gate de plano (D7).** `lib/api/planos.ts`:

```ts
/** Planos com acesso à API. "todos" = sem gate (estado inicial). */
export const PLANOS_COM_API: readonly string[] | "todos" = "todos"
```

No wrapper, depois da checagem de suspensão: se não for `"todos"` e
`organizations.plan` não estiver na lista → 403 `PLAN_REQUIRED` "O plano da
organização não inclui acesso à API". A gestão de chaves no painel mostra o
mesmo aviso e não deixa criar. Ligar o gate é trocar a constante: sem env,
sem migration.

**c) Ordem das checagens no wrapper** (a primeira que falha responde):
header → chave existe → revogada/expirada → escopo → org (demo/suspensa) →
plano → rate limit → body (JSON e Zod) → domínio.

## 3. Envelope (D3: único para as duas APIs)

AS-IS da v1, agora como contrato comum (`web/contracts/comum/envelope.ts`):

```jsonc
// sucesso
{ "data": { ... }, "meta": { ... } }          // meta opcional
// erro
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "details": { }, "request_id": "..." } }
```

- `X-Request-Id` em toda resposta, igual ao gravado em `api_request_logs`.
- `Cache-Control: no-store`.
- `message` em português, pronta para mostrar ao usuário final. Nunca contém
  dado de outro cliente.
- Erro inesperado → 500 `INTERNAL_ERROR` "Erro interno.", com o detalhe só no
  `console.error("[api:v1] ...", { requestId, ... })`.

**TO-BE (D3):** o wrapper sai de `lib/api/handler.ts` e vai para
`lib/http/rota.ts` com **autenticação plugável**:

```ts
type Autenticador<C> = (req: NextRequest, db: Db) => Promise<C>  // lança ApiError

criarRota<C>(opcoes: {
  autenticar: Autenticador<C>
  auditar?: (ctx: C, registro: RegistroRequisicao) => Promise<void>   // v1: api_request_logs
  handler: (ctx: C & ContextoBase) => Promise<ApiResult>
})
```

- `lib/api/autenticar-chave.ts`: a lógica atual de `apiRoute` (chave → escopo
  → org → plano → rate limit). `apiRoute(scope, handler)` continua existindo
  como atalho que monta `criarRota` com ele, para as rotas não mudarem de
  forma.
- O Autoatendimento usa `criarRota` com `autenticarTicket` (ver a revisão do
  contrato dele).
- O wrapper converte `DomainError` para `ApiError` com o mesmo código
  (`DOMAIN_CODES` em `envelope.ts`) e o status de `HTTP_STATUS_BY_CODE`.
  `details` do domínio (ex.: `sugestoes`) passa adiante.

## 4. Catálogo de erros

Fonte: `ErrorCode` + `HTTP_STATUS_BY_CODE` em `web/contracts/comum/envelope.ts`.
Os usados pela v1:

| Código | HTTP | Quando |
|---|---|---|
| `INVALID_JSON` | 400 | Body não é JSON |
| `UNAUTHORIZED` | 401 | Chave ausente, malformada, desconhecida, revogada ou expirada |
| `FORBIDDEN` | 403 | Chave sem o escopo da rota |
| `ORGANIZATION_SUSPENDED` | 403 | Org suspensa ou demo |
| `PLAN_REQUIRED` | 403 | **TO-BE** (D7) |
| `NOT_FOUND` | 404 | Recurso inexistente ou de outro tenant |
| `SLOT_UNAVAILABLE` | 409 | `validarHorario` recusou, ou corrida (`23P01`). `details: { motivo, sugestoes }` |
| `INVALID_TRANSITION` | 409 | Máquina de status, edição fora de `EDITAVEIS`, pagamento em `canceled`/`no_show` |
| `CUSTOMER_AMBIGUOUS` | 409 | **TO-BE:** mais de um cadastro casa com telefone/documento. Mandar `customer_id`. |
| `VALIDATION_ERROR` | 422 | Zod, data malformada, horário passado. `details: [{ field, message }]` |
| `RATE_LIMITED` | 429 | Com `Retry-After` e `details.retry_after_seconds` |
| `INTERNAL_ERROR` | 500 | |

Horário passado continua 422 `VALIDATION_ERROR` "O horário informado já
passou" (AS-IS), e não 409: é erro de entrada, não de agenda.

## 5. Rotas

`Escopo` = o que a chave precisa. Todas sob `/api/v1`.

| Método | Rota | Escopo | Zod | Estado |
|---|---|---|---|---|
| GET | `/me` | read | `Me` | AS-IS |
| GET | `/services` | read | `Service[]` | TO-BE: via `listarServicosAtivos` |
| GET | `/professionals` | read | `Professional[]` | TO-BE: via `listarProfissionaisAtivos`; resposta **perde** campos além de `id,name,specialty` |
| GET | `/availability` | read | `AvailabilityQuery` → `Availability` | TO-BE: ver 5.1 |
| GET | `/customers` | read | `CustomersQuery` → `Customer[]` | TO-BE: exatamente um critério; via `buscarPorTelefone` quando `phone` |
| GET | `/appointments` | read | `ListAppointmentsQuery` → `Appointment[]` + `PageMeta` | AS-IS |
| POST | `/appointments` | write | `CreateAppointmentBody` → `Appointment` (201) + `NotifyMeta` | TO-BE: ver 5.2 |
| GET | `/appointments/{id}` | read | `Appointment` | AS-IS |
| PATCH | `/appointments/{id}` | write | `UpdateAppointmentBody` → `Appointment` + `NotifyMeta` | TO-BE: `editarAgendamento` |
| POST | `/appointments/{id}/confirm` | write | `ConfirmBody` | TO-BE: `mudarStatus(confirmed)` |
| POST | `/appointments/{id}/cancel` | write | `CancelBody` | TO-BE: `mudarStatus(canceled)` |
| POST | `/appointments/{id}/status` | write | `StatusBody` | TO-BE: `mudarStatus` |
| POST | `/appointments/{id}/payment` | **payments** | `PaymentBody` | TO-BE: escopo novo + `registrarPagamento` |
| ~~DELETE~~ | ~~`/appointments/{id}`~~ | — | — | **Removido (D5).** Tirar o `export const DELETE`; o Next responde 405. |
| GET | `/logs` | read | `LogsQuery` → `RequestLog[]` + `PageMeta` | AS-IS |

### 5.1 `GET /availability`

- `service_id` passa a ser **obrigatório**. Sem consumidores em produção, a
  quebra não custa nada.
- Chama `listarHorariosLivres` com a duração do serviço e `naoAntesDe = agora`.
  O filtro de duração e de passado que a rota faz hoje é apagado.
- Resposta `Availability`: `empty_reason` vem de `motivoVazio`.
  `meta.grid_step_minutes` diz o passo da grade.
- Profissional ou serviço de outro tenant/inativo → 404.

### 5.2 `POST /appointments`

1. Zod `CreateAppointmentBody`. `start_time` → `horaLocalParaUtc`.
2. `criarAgendamento` com `Ator { canal: "api", origem: "api:<key_prefix>" }`,
   `exigirDocumento: false`, `exigirGrade: false`, `naoAntesDe = agora` (E1).
3. **Notificação (D6):** `notify = true` só envia se **todas** valerem:
   - o cliente **já existia** antes do request (`clienteCriado = false`, ou
     veio por `customer_id`);
   - o teto por org não estourou: `consumeRateLimit(hashIdentifier("api-notify-org", orgId), { windowMs: 1h, max: 60 })`;
   - o cliente tem telefone.
   Senão o agendamento é criado do mesmo jeito, e `meta.notify_skipped` diz o
   motivo (`new_customer` | `org_limit` | `no_phone` | `send_failed`).
4. 201 com `Appointment` e `meta: NotifyMeta`.

**Por que o D6:** com `notify` livre, uma chave vazada mandava WhatsApp pelo
número do tenant para qualquer telefone, bastando inventar um cliente. Agora
o pior caso é mensagem para quem já é cliente, com teto.

O mesmo teto `api-notify-org` vale para `notify` em PATCH, confirm, cancel e
status. Nesses o cliente sempre existe; só se aplicam `org_limit`, `no_phone`
e `send_failed`.

### 5.3 Edição e status

Tudo vem de 00-dominio §5–§6, sem regra própria na rota:

- PATCH em `completed`/`canceled`/`no_show`/`arrived` → 409 `INVALID_TRANSITION`.
- Mudar horário zera os lembretes; mudar só `notes` não valida agenda.
- Repetir o status atual → 200 sem log novo (idempotente).
- `arrived → no_show` e `completed → *` → 409.
- Pagamento em `canceled`/`no_show` → 409.

## 6. Auditoria (AS-IS, ratificado)

- `api_request_logs`: uma linha por requisição com chave válida (tenant,
  chave, `request_id`, método, rota, status, `error_code`, latência, IP,
  user-agent). **Nunca** body nem query string.
- Requisição sem chave válida não tem tenant: só `console.warn` com IP.
- `appointment_logs.source = "api:<key_prefix>"` em toda escrita (agora via
  domínio, E4).
- Owner/admin lê pelo painel (RLS + grant de coluna sem `key_hash`).

**TO-BE, fora deste contrato:** retenção de `api_request_logs`. Hoje não há
limpeza. Registrar como pendência em `docs/CRON.md`.

## 7. Banco

### Verificar antes de tudo

A migration `20260930120000_public_api_keys_and_logs.sql` **pode não estar
aplicada**. Não foi possível confirmar: o MCP Supabase disponível em
2026-10-06 enxerga outra conta. Conferir no Studio do Eliza:

```sql
select to_regclass('public.api_keys'), to_regclass('public.api_request_logs');
```

E lembrar que o histórico de migrations do banco diverge do repo: o que vale
é o efeito no catálogo, não `list_migrations`.

### Migration TO-BE

`supabase/migrations/<timestamp>_api_keys_payments_scope.sql`:

```sql
alter table public.api_keys drop constraint api_keys_scopes_check;
alter table public.api_keys add constraint api_keys_scopes_check
  check (scopes <@ array['read','write','payments'] and cardinality(scopes) > 0);
```

Aditiva (amplia o CHECK): pode ir antes ou depois do código.

### Tipos

`utils/database.types.ts` tem `api_keys`/`api_request_logs` **escritos à
mão** (AS-IS). Regenerar com `supabase gen types` depois das migrations e
conferir o diff: nenhuma outra tabela pode mudar sem explicação.

## 8. Ordem de execução

Pré-requisito: [00-dominio](../00-dominio/README.md) concluído até o passo 4
(as actions do painel já usam o domínio).

1. Verificar a migration de 30/09 (§7). Se não estiver aplicada, aplicar.
2. `lib/http/` (wrapper com autenticação plugável) + `lib/api/autenticar-chave.ts`.
   `apiRoute` vira atalho. Nenhuma rota muda de comportamento neste passo.
3. Rotas de leitura no domínio: services → professionals → availability → customers.
4. Rotas de escrita no domínio: POST → PATCH → confirm/cancel/status. Remover
   o DELETE. Apagar `lib/api/domain/`, `lib/api/tempo.ts` e `lib/api/schemas.ts`.
5. Escopo `payments`: migration, wrapper, painel (dois checkboxes), rota.
6. Gate de plano (`planos.ts` em `"todos"`).
7. Regenerar os tipos. Atualizar `docs/API.md`.
8. Aceite com `curl`, registrado em `docs/RELATORIO_API_V1.md`.

**Deploy:** nada vai para a `main` antes da revisão Opus da leva inteira
(00-dominio + v1). A `development` já tem o `a0ff88a`, que fica parado lá até
lá.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| V1 | Respostas mantêm o shape da v1 (`start_time`/`start_local`, snake_case) | Trocar para `Momento` (`{utc, local}`) como o Autoatendimento | Já está escrito e documentado em `docs/API.md`; é convenção REST comum para integrador. O envelope é que é único (D3), não o shape dos recursos. |
| V2 | `service_id` obrigatório em `/availability` | Opcional, com fallback para a duração da org | O fallback devolvia horário em que o serviço não cabe. |
| V3 | Notificação recusada não falha o request; vai em `meta.notify_skipped` | 4xx quando não dá para notificar | O agendamento é o que importa. A mensagem é efeito colateral, e o integrador pode avisar por conta própria. |
| V4 | Teto `api-notify-org` de 60/h | Sem teto (só os 120 req/min da chave) | 120/min × 60 = 7.200 mensagens/h pelo número do tenant com uma chave vazada. 60/h cobre a operação real de qualquer nicho atual. |

## Aceite

Autenticação e escopo:

- [ ] Chave só `read` → POST 403 `FORBIDDEN`.
- [ ] Chave `read,write` → payment 403; chave `read,payments` → payment 200 e POST 403.
- [ ] Chave revogada → 401; org suspensa → 403 `ORGANIZATION_SUSPENDED`.
- [ ] Com `PLANOS_COM_API = ["pro"]` e org `plan = 'basic'` → 403 `PLAN_REQUIRED` (testar e voltar para `"todos"`).
- [ ] Body com `organization_id` → 422.
- [ ] Toda resposta tem `X-Request-Id`, e há uma linha em `api_request_logs` com o mesmo id.

Domínio pela API:

- [ ] `/availability` sem `service_id` → 422.
- [ ] Todo slot de `/availability` aceito por POST no mesmo serviço/profissional.
- [ ] POST em horário ocupado → 409 com `details.sugestoes`.
- [ ] POST às 14:10 (fora da grade, livre, no expediente) → 201 (E1).
- [ ] POST com cliente novo e `notify: true` → 201, `meta.notified = false`, `notify_skipped = "new_customer"`, nenhum WhatsApp.
- [ ] POST com `customer_id` existente e `notify: true` → WhatsApp sai e `notified = true`.
- [ ] POST com telefone `(11) 98765-4321` e cliente cadastrado como `5511987654321` → reusa (não duplica).
- [ ] PATCH em `completed` → 409; status `completed → scheduled` → 409; `arrived → no_show` → 409.
- [ ] Payment em `no_show` → 409.
- [ ] DELETE → 405.
- [ ] `appointment_logs` com `source = 'api:elz_live_xxxxxx'` para cada escrita.
- [ ] Recurso de outro tenant em qualquer rota com `{id}` → 404.
