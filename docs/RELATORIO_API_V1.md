# Relatório — API REST v1 (`/api/v1/*`)

> Contrato: `docs/contratos/api-v1/README.md`. Domínio: `docs/RELATORIO_DOMINIO.md`.
> Branch `development`, sem push. Etapa 4 (escopo `payments`, gate de plano, tipos, `docs/API.md`) ainda não feita.

## Etapa 3 (api-v1 §8 passos 2–4 + 00-dominio passo 6)

### O que foi feito

**Passo 2 — `lib/http/` e `lib/api/autenticar-chave.ts` (nenhuma rota mudou de comportamento)**

- `lib/http/rota.ts`: `criarRota({ autenticar, auditar?, handler })`. Faz autenticar, handler e
  auditoria; `ApiError` e `DomainError` viram resposta no envelope único, o resto vira 500
  `INTERNAL_ERROR` "Erro interno." (detalhe só no `console.error("[api:v1] ...", { requestId, ... })`).
  O contexto do handler traz `body(schema)` e o novo `parseQuery(schema)` (422 com `details: [{ field, message }]`).
- `lib/http/erros.ts`: `ApiError(code, message, details?, headers?)` com status sempre de
  `HTTP_STATUS_BY_CODE`; `deDominio` / `paraApiError` (mesmo código; `detalhes` do domínio, ex.
  `sugestoes`, viram `details`); `notFound`, `validation`, `internalError`, `zodDetails`.
- `lib/http/resposta.ts`: `jsonResponse` (`X-Request-Id`, `Cache-Control: no-store`), corpos de sucesso e erro.
- `lib/api/autenticar-chave.ts`: a lógica antiga de `apiRoute` (header, chave, revogada/expirada,
  escopo, org demo/suspensa, rate limit 120/min por chave) e a auditoria em `api_request_logs`
  (mesmas colunas, mais o refresh de `last_used_at`). Pontos marcados para a etapa 4: `TODO(etapa 4, D5)`
  no escopo e `TODO(etapa 4, D7)` no lugar do gate de plano (depois da suspensão, antes do rate limit).
- `lib/api/handler.ts`: só `apiRoute(scope, handler)` = `criarRota` + `autenticarChave` + `auditarChave`.
- `lib/api/http.ts` apagado. `parseApiDateTime` não é mais necessário: a rota chama `horaLocalParaUtc(valor, campo)`
  e o `DomainError VALIDATION_ERROR` vira 422 com a mesma mensagem pela casca. Uma fonte só.

**Passo 3 — leitura**

- `services` → `listarServicosAtivos`; `professionals` → `listarProfissionaisAtivos` (resposta só `id,name,specialty`);
  `customers` → `CustomersQuery` (exatamente um critério) e `buscarPorTelefone` quando `phone`
  (`document` e `q` continuam consulta de leitura na rota, sempre com `organization_id`, máx. 20 por nome);
  `availability` (já usava `listarHorariosLivres`) agora com `parseQuery(AvailabilityQuery)` e sem o
  `catch` de `DomainError` (a casca converte); `logs` com `LogsQuery`.
- `lib/api/serializar.ts`: única ponte domínio → shape da v1 (`paraService`, `paraProfessional`,
  `paraCustomer`, `paraAppointment`), com tipos de retorno dos Zod de `contracts/api-v1`.
- `lib/api/leitura-agendamentos.ts`: `listarAgendamentos` e `obterAgendamento` (GET /appointments e /{id}), filtrando por `organization_id`.
- `ClienteResumo` ganhou `email` (o `Customer` da v1 o expõe): extensão mínima de `lib/domain/clientes.ts`.

**Passo 4 — escrita e remoções**

- `POST /appointments` → `criarAgendamento` com `Ator { canal: "api", origem: "api:<key_prefix>" }`
  (a regra por canal do domínio já dá `exigirDocumento: false`, grade não exigida e `naoAntesDe = agora`;
  conferido em `agendamentos.ts`); `PATCH` → `editarAgendamento`; `confirm`/`cancel`/`status` → `mudarStatus`
  (via `lib/api/mudar-status.ts`); `payment` → `registrarPagamento` (`method` enum).
- D6 em `lib/api/notificacao.ts`: `notify` só envia para cliente que já existia; teto
  `consumeRateLimit(hashIdentifier("api-notify-org", orgId), { windowMs: 3600000, max: 60 })` em todas as
  escritas com `notify` (consumido só quando a mensagem de fato sairia); `meta` `NotifyMeta`
  `{ notified, notify_skipped? }` (`new_customer`, `org_limit`, `no_phone`, `send_failed`).
- Export `DELETE` removido de `appointments/[id]/route.ts` (Next responde 405).
- Apagados: `lib/api/domain/` inteiro, `lib/api/schemas.ts`. Em `lib/appointment-config.ts` removidos
  `checkOrganizationBusinessHours`, `checkProfessionalAvailability`, `generateTimeSlots` (sem uso; só `STATUS_CONFIG` fica).

### Commits

1. `77e5f13` refactor(api): lib/http com rota plugavel e autenticar-chave; apiRoute vira atalho
2. `0f9e7d5` refactor(api): rotas de leitura da v1 passam pelo dominio e pelos Zod do contrato
3. `a62bd4f` feat(api): escritas da v1 passam pelo dominio, com notify da D6 e sem DELETE
4. (último) remoções + este relatório

### Verificação

| Item | Resultado |
|---|---|
| `npx tsc --noEmit -p .` antes (HEAD `179e679`) | 0 erros |
| `npx tsc --noEmit -p .` depois de cada commit | 0 erros |
| `npm run build` | passou; as 11 rotas `/api/v1/*` compilam como dinâmicas |
| eslint nos arquivos tocados | limpo, exceto 1 erro **pré-existente** em `lib/appointment-config.ts:16` (`icon: any` do `STATUS_CONFIG`, linha não alterada) |
| grep `lib/api/domain`, `lib/api/schemas`, `lib/api/http`, `lib/api/tempo` (imports) | zero (sobram só 3 comentários históricos) |
| grep `.insert/.update/.delete` em `appointments` | só `lib/domain/agendamentos.ts`, `app/api/cron/reminders.ts` (marca `reminder_*_sent_at`) e `lib/demo/seed.ts` |
| `'use server'` em `lib/http`, `lib/api`, `lib/domain` | nenhum |
| Script descartável (fora do repo; `node --experimental-transform-types` com hook de resolução) | passou: todos os `DOMAIN_CODES` → `ApiError` com o mesmo código, status de `HTTP_STATUS_BY_CODE`, mensagem e `details` (`sugestoes`) intactos; erro desconhecido → `null` (vira 500); `notify` com db falso: `new_customer` sem consumir teto, chave `api-notify-org:*`/janela 3600000/max 60, `org_limit` (contagem 61), `no_phone`, `send_failed`, `notify=false` e operação sem mensagem sem `notify_skipped` |

Não foi testado contra o banco real nem criada API key.

### Divergências contrato × código

1. **Horário passado:** o contrato (§4) mantém 422 `VALIDATION_ERROR` "O horário informado já passou". O domínio
   (etapa 2, `validarHorario` com `naoAntesDe`) responde **409 `SLOT_UNAVAILABLE`** (`motivo: "antecedencia_minima"`,
   "Horário já passou ou não respeita a antecedência mínima.", com `sugestoes`). **Mantive o domínio** (regra única
   para os 4 canais). Decidir: ajustar o contrato ou o domínio.
2. **Assinatura de `criarRota`:** o contrato mostra `Autenticador<C>` e `auditar(ctx: C, ...)`. Implementei
   `criarRota<C, A = C>` com um `identificar(a: A)` que o autenticador chama assim que sabe a chave, antes de
   escopo/org/limite. Sem isso, falha de escopo, org suspensa e rate limit deixariam de ser auditadas (hoje são).
   O autenticador do ticket do Autoatendimento pode usar `A = C` e ignorar `identificar`.
3. **`ListAppointmentsQuery` e `LogsQuery` são `.strict()`** (Zod vence): parâmetro desconhecido agora é 422;
   antes era ignorado.
4. **Formato de `start_time`/`end_time`:** agora sempre `...Z` (`Momento.utc`); a v1 devolvia a string crua do banco
   (`...+00:00`). Mesmo instante, ambos válidos em `UtcInstant`.
5. **Mensagens de 404** passam a ser as do domínio ("Agendamento não encontrado.", "Serviço não encontrado.",
   "Profissional não encontrado."), no lugar de "... não encontrado(a)." (`notFound` ainda existe em `lib/http/erros.ts`, sem uso hoje).
6. **`GET /customers?document=`** normaliza para letras e dígitos (igual ao trigger do banco e ao domínio);
   antes só dígitos.
7. **Vocabulário de `appointment_logs.action`** em mudança de status: o domínio grava o novo status
   (`confirmed`, `canceled`, `arrived`...), não `status:<x>` como a v1 antiga (decisão da etapa 2). `created`,
   `rescheduled`, `updated` e `payment:<status>` seguem; `source = api:<key_prefix>` em toda escrita.
8. **Mudanças de comportamento herdadas do domínio (desejadas, contrato §5.3):** `arrived → no_show` agora 409;
   `no_show` antes do horário 409; pagamento em `no_show` 409; `method` fora do enum 422; PATCH em
   `completed/canceled/no_show/arrived` 409; remarcação passa a validar agenda; cliente por telefone casa
   qualquer forma BR e 2+ cadastros dá 409 `CUSTOMER_AMBIGUOUS`.

### Decisões fora do contrato

- `Ator.podeNotificar` agora recebe `{ clienteCriado }` (`ContextoNotificacao`): extensão mínima de
  `lib/domain/agendamentos.ts`, compatível com os chamadores existentes (`() => ...`). É o que permite o
  `new_customer` sem a rota saber de antemão se o cliente nascerá. A mensagem do `console.warn` de recusa foi
  generalizada ("Envio recusado pelo ator (teto ou cliente novo)").
- O teto `api-notify-org` só é consumido quando a mensagem iria sair (cliente existente com telefone), não em
  `new_customer` nem `no_phone`.
- `meta` `NotifyMeta` vai em **toda** escrita (inclusive com `notify: false`, `{ notified: false }`), conforme §5.2.
- Sem `notify_skipped` quando `notify: true` mas a operação não tem mensagem: PATCH sem mudar horário/profissional/serviço,
  status diferente de `confirmed`/`canceled`, ou repetição idempotente do status. O enum `NotifyMeta` não tem
  "não aplicável"; a alternativa seria ampliar o Zod.
- `mudarStatusPelaChave` (`lib/api/mudar-status.ts`) concentra o corpo igual de confirm/cancel/status.
- `ApiError` mudou de `(status, code, ...)` para `(code, ...)`: o status vem só de `HTTP_STATUS_BY_CODE`.
- Erros inesperados de leitura (PostgREST) sobem como estão e viram 500 genérico pela casca (antes cada rota convertia à mão).

### Curls a rodar (Aceite do api-v1; nesta etapa só os que não dependem da etapa 4)

Preparar duas chaves (`read` e `read,write`) numa org de teste e uma segunda org para o 404 cruzado.
`B=<base>/api/v1`, `R=<chave read>`, `W=<chave read,write>`, `H="Content-Type: application/json"`.

Autenticação, escopo, envelope:

```bash
curl -si -X POST $B/appointments -H "Authorization: Bearer $R" -H "$H" -d '{}'                      # 403 FORBIDDEN (escopo vem antes do body)
curl -si $B/me -H "Authorization: Bearer <chave revogada>"                                          # 401
curl -si $B/me -H "Authorization: Bearer $W"                                                        # 200 + X-Request-Id
curl -s "$B/logs?limit=1" -H "Authorization: Bearer $W"                                             # request_id == X-Request-Id acima
curl -si -X POST $B/appointments -H "Authorization: Bearer $W" -H "$H" -d '{"organization_id":"x"}' # 422 (strict)
curl -si "$B/logs?foo=1" -H "Authorization: Bearer $W"                                              # 422 (strict; mudou)
# org suspensa (subscription_status='suspended' e voltar): 403 ORGANIZATION_SUSPENDED
```

Leitura:

```bash
curl -s $B/services -H "Authorization: Bearer $R"                                                   # id,title,description,duration_minutes,price
curl -s $B/professionals -H "Authorization: Bearer $R"                                              # só id,name,specialty
curl -si "$B/availability?professional_id=<P>&date=<D>" -H "Authorization: Bearer $R"               # 422 (sem service_id)
curl -s "$B/availability?professional_id=<P>&service_id=<S>&date=<D>" -H "Authorization: Bearer $R" # slots, empty_reason, meta.grid_step_minutes
curl -si "$B/customers" -H "Authorization: Bearer $R"                                               # 422 (nenhum critério)
curl -si "$B/customers?phone=11987654321&q=ana" -H "Authorization: Bearer $R"                       # 422 (dois critérios)
curl -s "$B/customers?phone=(11)%2098765-4321" -H "Authorization: Bearer $R"                        # acha o cadastrado como 5511987654321
curl -s "$B/appointments?status=scheduled,confirmed&from=<D>&limit=5" -H "Authorization: Bearer $R" # lista + meta {total,limit,offset}
curl -si $B/appointments/<id de outro tenant> -H "Authorization: Bearer $R"                         # 404 (idem PATCH/confirm/cancel/status/payment com W)
```

Domínio pela API (chave `W`):

```bash
# todo slot de /availability deve ser aceito por POST (mesmo serviço/profissional)
curl -si -X POST $B/appointments -H "Authorization: Bearer $W" -H "$H" -d '{"customer":{"name":"Teste","phone":"11900000001"},"professional_id":"<P>","service_id":"<S>","start_time":"<D>T<horario ocupado>"}'   # 409 com details.sugestoes
# start_time às 14:10 (fora da grade, livre, no expediente): 201
# cliente novo + notify:true: 201, meta {notified:false, notify_skipped:"new_customer"}, nenhum WhatsApp
# {"customer":{"customer_id":"<existente>"}, ..., "notify":true}: WhatsApp sai, meta.notified=true
# telefone "(11) 98765-4321" com cliente cadastrado como 5511987654321: reusa (não duplica)
curl -si -X PATCH $B/appointments/<completed> -H "Authorization: Bearer $W" -H "$H" -d '{"notes":"x"}'                    # 409 INVALID_TRANSITION
curl -si -X POST $B/appointments/<completed>/status -H "Authorization: Bearer $W" -H "$H" -d '{"status":"scheduled"}'     # 409
curl -si -X POST $B/appointments/<arrived>/status -H "Authorization: Bearer $W" -H "$H" -d '{"status":"no_show"}'         # 409
curl -si -X POST $B/appointments/<scheduled futuro>/status -H "Authorization: Bearer $W" -H "$H" -d '{"status":"no_show"}' # 409 (antes do horário)
curl -si -X POST $B/appointments/<no_show>/payment -H "Authorization: Bearer $W" -H "$H" -d '{"method":"pix"}'            # 409
curl -si -X POST $B/appointments/<scheduled>/payment -H "Authorization: Bearer $W" -H "$H" -d '{"method":"pix"}'          # 200 (sinal)
curl -si -X POST $B/appointments/<scheduled>/payment -H "Authorization: Bearer $W" -H "$H" -d '{"method":"Outros"}'       # 422
curl -si -X DELETE $B/appointments/<id> -H "Authorization: Bearer $W"                                                     # 405
# teto D6: 61 escritas com notify:true para cliente existente na mesma hora; a 61ª com notify_skipped:"org_limit"
```

SQL: `select source, action, count(*) from appointment_logs where source like 'api:%' group by 1,2;`
deve mostrar `api:elz_live_xxxxxx` em cada escrita.

Ficam para a etapa 4 (não testar agora): chave `read,payments` (payment 200, POST 403), `read,write` no payment (403) e `PLAN_REQUIRED`.

## Etapa 4 (api-v1 §8 passos 5–8: escopo `payments`, gate de plano, docs)

### O que foi feito

- **Escopo `payments` (D5).** `API_SCOPES` em `lib/api/keys.ts` agora é `ApiScope.options` do contrato (fonte única).
  `POST /appointments/{id}/payment` usa `apiRoute("payments", ...)`. A action `createApiKey` já filtrava por
  `API_SCOPES`, então aceita o escopo novo sem mudança. Tela: dois checkboxes (escrita, baixa de pagamento), ambos
  desmarcados; `read` sempre; tabela com rótulos legíveis (`lib/api/escopos.ts`, `Record<ApiScope, string>`).
- **Gate de plano (D7).** `lib/api/planos.ts`: `PLANOS_COM_API = "todos"`, `planoPermiteApi(plano)` e a mensagem.
  Autenticador: `organizations.plan` entra no select da org e o gate fica entre suspensão e rate limit. A action
  `createApiKey` recusa (via `organizacaoTemApi` em `lib/api/plano-da-org.ts`, que lê o plano por service role porque
  `authenticated` não lê colunas de billing); a página de configurações passa `planAllowsApi` ao componente, que
  mostra o aviso e desabilita "Gerar chave".
- **Docs.** `docs/API.md` e `docs/CHANGELOG.md` atualizados (lidas as rotas e os Zod antes de documentar).

### Commits

1. `5b6b9fb` feat(api): escopo payments nas chaves e na rota de pagamento (D5)
2. `aee2412` feat(api): gate de plano da API B2B (D7)
3. docs: API.md, CHANGELOG e este relatório (hash no retorno do orquestrador)

### Arquivos

`web/lib/api/keys.ts`, `escopos.ts` (novo), `planos.ts` (novo), `plano-da-org.ts` (novo), `autenticar-chave.ts`,
`web/app/api/v1/appointments/[id]/payment/route.ts`, `web/app/actions/api-keys.ts`,
`web/app/(app)/configuracoes/page.tsx`, `web/components/settings/api-keys-settings.tsx`, `docs/API.md`,
`docs/CHANGELOG.md`, `docs/RELATORIO_API_V1.md`. Os dois `TODO(etapa 4)` foram removidos.

### Verificação

- `npx tsc --noEmit -p .` limpo antes e depois de cada commit; `npm run build` ok; eslint limpo nos arquivos tocados.
- Script descartável (fora do repo, sem banco, com db falso): chave `read,write` na rota de payment -> 403 FORBIDDEN;
  `read,payments` -> passa; `read,payments` em rota `write` -> 403. Gate: `"todos"` libera qualquer plano (inclusive
  nulo); lista `["pro"]` libera `pro` e recusa `basic` e nulo; autenticador com a lista ligada e org `basic` -> 403
  `PLAN_REQUIRED`, org `pro` -> passa.

### Divergências contrato × código

Nenhuma encontrada. Ressalva menor: a mensagem de `PLAN_REQUIRED` no contrato não tem ponto final; a action de criar
chave devolve a mesma frase com ponto (texto de UI), o `error.message` da API é exatamente o do contrato.

### Decisões fora do contrato

- `lib/api/plano-da-org.ts` (server-only) existe para não duplicar a leitura do plano entre action e página; o
  autenticador usa só `planoPermiteApi`, pois já lê a org.
- Plano nulo conta como "fora da lista" quando há gate (e como liberado com `"todos"`).
- `API_SCOPES` virou `ApiScope.options` (e `ApiScope` é reexportado de `keys.ts`) em vez de uma segunda lista.
- Rótulos de escopo em `lib/api/escopos.ts` (sem `server-only`, porque o componente é client).
- A seção "Curls a rodar" da etapa 3 usa `W` (read,write) em `payment`: com a etapa 4 esses curls devem usar a chave `P`.

### Curls a rodar

`B=<base>/api/v1`, `H="Content-Type: application/json"`, chaves: `W` (read,write), `P` (read,payments), `R` (read).

```bash
curl -si -X POST $B/appointments/<scheduled>/payment -H "Authorization: Bearer $W" -H "$H" -d '{"method":"pix"}'   # 403 FORBIDDEN (write não basta)
curl -si -X POST $B/appointments/<scheduled>/payment -H "Authorization: Bearer $P" -H "$H" -d '{"method":"pix"}'   # 200
curl -si -X POST $B/appointments -H "Authorization: Bearer $P" -H "$H" -d '{}'                                     # 403 FORBIDDEN
curl -si $B/me -H "Authorization: Bearer $P"                                                                       # 200, scopes ["read","payments"]
# nos curls de payment da etapa 3 (409 em no_show, 200 sinal, 422 "Outros"), trocar $W por $P
# PLAN_REQUIRED: trocar PLANOS_COM_API para ["pro"] em web/lib/api/planos.ts com a org em outro plano, reiniciar:
curl -si $B/me -H "Authorization: Bearer $R"                                                                       # 403 PLAN_REQUIRED "O plano da organização não inclui acesso à API"
# painel: Configurações -> API mostra o aviso e o botão fica desabilitado; voltar a constante para "todos"
```

## Etapa 4 — verificação do orquestrador (2026-10-06)

- Migration `20261006120100` (escopo `payments`) aplicada via MCP; CHECK conferido:
  `scopes <@ ARRAY['read','write','payments'] AND cardinality(scopes) > 0`.
- Curl: `POST /appointments/{id}/payment` com chave `read,write` → 403 `FORBIDDEN`
  "A chave não tem o escopo \"payments\"".
- Gate de plano: com `PLANOS_COM_API = ["pro"]` e a org `admin` em `free`,
  `GET /me` → 403 `PLAN_REQUIRED` "O plano da organização não inclui acesso à API".
  Constante revertida para `"todos"` (sem diff no arquivo); `GET /me` voltou a 200.
- Tipos: `generate_typescript_types` (MCP) comparado com `utils/database.types.ts`.
  O trecho de `api_keys`/`api_request_logs` escrito à mão na `a0ff88a` é
  **idêntico** ao gerado, e as demais tabelas/funções batem com o gerado. Nada a
  regenerar; o arquivo passa a corresponder ao banco.
- Chave `read,payments` criada pelo painel com os dois checkboxes novos (só
  "baixa de pagamento" marcado): `/me` → `scopes: ["read","payments"]`;
  `POST /appointments` → 403 "A chave não tem o escopo \"write\""; pagamento de
  sinal num `scheduled` → 200 `paid`; `cancel` → 403. Agendamento de teste
  (`TESTE-ETAPA4`) cancelado com a chave de escrita.
