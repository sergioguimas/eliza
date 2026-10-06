# API REST do Eliza (`/api/v1`)

API multitenant para integrações externas (agentes, automações). Cobre as
ações de agendamento, sem exclusão (cancelar resolve). Não confundir com o contrato TO-BE de autoatendimento
(`docs/contratos/autoatendimento/`), que é voltado ao cliente final.

## Autenticação

Uma **API key por tenant**, gerada em *Configurações → API* (apenas
owner/admin). Vai em todo request:

```http
Authorization: Bearer elz_live_xxxxxxxxxxxxxxxx
```

- O tenant é **sempre** o da chave. Nenhuma rota aceita `organization_id` em
  body, query ou header. Recurso de outro tenant responde `404`.
- A chave em claro aparece uma única vez. O banco guarda só o SHA-256 e o
  prefixo (`elz_live_ab12cd`), exibido no painel e nos logs.
- Escopos (a coluna "Escopo" das rotas diz qual cada uma exige). Sem o escopo: `403`.

  | Escopo | Libera |
  |---|---|
  | `read` | Todos os `GET` |
  | `write` | Criar, editar, confirmar, cancelar e mudar status de agendamentos |
  | `payments` | `POST /appointments/{id}/payment` e só ele: `write` não basta para dar baixa |

  `payments` sem `write` é válido (integração de caixa). Ao gerar a chave no
  painel, `read` vem sempre; escrita e baixa de pagamento são opcionais e
  começam desmarcadas. Chaves antigas não ganham `payments` sozinhas.
- Chave revogada/expirada: `401`. Organização suspensa ou demo: `403`.
- A API é recurso de plano: se o plano da organização não a incluir, `403
  PLAN_REQUIRED`, e o painel também não deixa gerar chave. Hoje todos os
  planos têm acesso.
- Máx. 10 chaves ativas por tenant. Revogar é imediato.

## Formato

Sucesso: `{ "data": ..., "meta": ... }`. Erro:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "details": null, "request_id": "..." } }
```

Todo response traz `X-Request-Id` (o mesmo gravado no log) e
`Cache-Control: no-store`. `message` vem em português; `details` depende do
código. Códigos:

| Código | HTTP | Quando |
|---|---|---|
| `INVALID_JSON` | 400 | Body não é JSON |
| `UNAUTHORIZED` | 401 | Chave ausente, malformada, desconhecida, revogada ou expirada |
| `FORBIDDEN` | 403 | Chave sem o escopo da rota |
| `ORGANIZATION_SUSPENDED` | 403 | Organização suspensa ou demo |
| `PLAN_REQUIRED` | 403 | O plano da organização não inclui acesso à API |
| `NOT_FOUND` | 404 | Recurso inexistente ou de outro tenant |
| `SLOT_UNAVAILABLE` | 409 | Horário ocupado, fora do expediente/agenda, **já passado**, ou perdido numa corrida. `details: { motivo, sugestoes }` com horários próximos |
| `INVALID_TRANSITION` | 409 | Transição de status proibida, edição fora de `pending`/`scheduled`/`confirmed`, pagamento em `canceled`/`no_show`, ou agendamento alterado por outra requisição no meio |
| `CUSTOMER_AMBIGUOUS` | 409 | Mais de um cadastro casa com o telefone/documento enviado; mande `customer_id` |
| `VALIDATION_ERROR` | 422 | Body/query inválido. `details: [{ field, message }]` |
| `RATE_LIMITED` | 429 | Com `Retry-After` e `details.retry_after_seconds` |
| `INTERNAL_ERROR` | 500 | Erro inesperado (o detalhe fica só no log do servidor) |

Ordem das checagens: header, chave, revogada/expirada, escopo, organização,
plano, rate limit, body, regra de negócio. A primeira que falha responde.

Limite: 120 requisições/minuto por chave.

**Horários:** entrada `"2026-10-05T14:30"` = relógio de São Paulo; também
aceita ISO com offset/`Z`. Saída traz `start_time` (UTC) e `start_local`.

## Rotas

| Método | Rota | Escopo | Descrição |
|---|---|---|---|
| GET | `/me` | read | Tenant e dados da chave |
| GET | `/services` | read | Serviços ativos |
| GET | `/professionals` | read | Profissionais ativos |
| GET | `/availability?professional_id&service_id&date=YYYY-MM-DD` | read | Horários livres para o serviço. `service_id` é obrigatório (422 sem ele). `meta.grid_step_minutes` traz o passo da grade |
| GET | `/customers?phone=` `?document=` `?q=` | read | Busca de clientes (máx. 20). Exatamente um critério, senão 422 |
| GET | `/appointments` | read | Lista. Filtros: `status` (vírgula), `from`, `to` (data ou data/hora), `customer_id`, `professional_id`, `limit` (≤100), `offset` |
| POST | `/appointments` | write | Cria (201) |
| GET | `/appointments/{id}` | read | Detalhe |
| PATCH | `/appointments/{id}` | write | Remarca/altera: `start_time`, `professional_id`, `service_id`, `notes` |
| POST | `/appointments/{id}/confirm` | write | Confirma |
| POST | `/appointments/{id}/cancel` | write | Cancela (mantém o registro). `reason` opcional |
| POST | `/appointments/{id}/status` | write | Muda status com validação de transição |
| POST | `/appointments/{id}/payment` | **payments** | Baixa de pagamento: `method`, `status` |
| GET | `/logs?scope=key\|organization` | read | Auditoria de uso da própria API |

### Criar agendamento

```json
POST /api/v1/appointments
{
  "customer": { "customer_id": "uuid" },
  "professional_id": "uuid",
  "service_id": "uuid",
  "start_time": "2026-10-05T14:30",
  "notes": "opcional",
  "status": "scheduled",
  "notify": false
}
```

`customer` também aceita `{ "name", "phone", "document?", "birth_date?", "gender?" }`:
reusa o cliente do tenant que casar por telefone/documento (sem sobrescrever
cadastro) ou cria um novo; se o telefone/documento casar com mais de um
cadastro, responde 409 `CUSTOMER_AMBIGUOUS`. `status` inicial: `pending`,
`scheduled` (padrão) ou `confirmed`.

**Notificação (`notify`, padrão `false`).** Envia WhatsApp pela instância do
tenant, mas só para cliente que **já existia** antes do request (por
`customer_id` ou cadastro reaproveitado) e que tenha telefone, com teto de 60
envios por hora por organização. Quando `notify: true` e a mensagem não sai, o
agendamento é criado do mesmo jeito e `meta.notify_skipped` diz o motivo:
`new_customer`, `org_limit`, `no_phone` ou `send_failed`. Toda escrita
devolve `meta.notified`. O mesmo teto vale para `notify` em PATCH, confirm,
cancel e status.

Validações: horário fora do expediente/agenda do profissional, já ocupado ou
**no passado** respondem 409 `SLOT_UNAVAILABLE` com `details.sugestoes`
(`details.motivo = "antecedencia_minima"` no caso do passado). A exclusion
constraint do banco é a garantia final contra corrida. O horário não precisa
cair na grade de `/availability`, só estar livre e dentro do expediente.

### Pagamento

```json
POST /api/v1/appointments/{id}/payment
{ "method": "pix", "status": "paid" }
```

`method` é um enum: `dinheiro`, `pix`, `cartao_credito`, `cartao_debito`,
`outro` (outro valor: 422). `status` (padrão `paid`): `pending`, `paid`,
`partially_paid` ou `refunded`. Vale antes de concluir (sinal) e depois; só
`canceled` e `no_show` recusam (409 `INVALID_TRANSITION`). Repetir `paid` não
altera `paid_at`. Não notifica o cliente.

### Status

`pending → scheduled|confirmed|canceled` · `scheduled → confirmed|arrived|completed|no_show|canceled` ·
`confirmed → arrived|completed|no_show|canceled` · `arrived → completed|canceled`.
`completed`, `canceled` e `no_show` são finais (só `completed` ainda recebe
pagamento). `no_show` só depois do horário de início e nunca a partir de
`arrived` (quem chegou não é falta); fora da tabela: 409
`INVALID_TRANSITION`. Repetir o status atual é idempotente (200, sem log
novo). Remarcar/editar só vale para `pending`/`scheduled`/`confirmed`; mudar o
horário zera os lembretes para o cron avisar do novo, e mudar só `notes` não
revalida a agenda. Não há `DELETE`: para tirar um horário, cancele.

## Auditoria

Toda requisição com chave válida grava uma linha em `api_request_logs`:
tenant, chave (id e prefixo), `request_id`, método, rota, status, código de
erro, latência, IP e user-agent. **Body e query string não são gravados**
(podem ter dado pessoal). Requisições sem chave válida não têm tenant e vão
só para o log do servidor (com IP).

- Owner/admin vê os logs do próprio tenant em *Configurações → API* (RLS;
  `authenticated` só tem SELECT, e não lê `key_hash`).
- O agente consulta os seus via `GET /logs`.
- Mudanças em agendamentos também vão para `appointment_logs` com
  `source = 'api:<prefixo da chave>'`.

## Operação

- Migration: `supabase/migrations/20260930120000_public_api_keys_and_logs.sql`
  (aditiva; aplicar antes do deploy). Depois rode `supabase gen types`: os
  tipos de `api_keys`/`api_request_logs` em `utils/database.types.ts` foram
  escritos à mão no mesmo formato.
- Escopo `payments`: migration `20261006120100` (amplia o CHECK de
  `api_keys.scopes`; aditiva, pode ir antes ou depois do código).
- Gate de plano: `PLANOS_COM_API` em `web/lib/api/planos.ts` (`"todos"` ou lista
  de planos). Ligar é trocar a constante, sem env nem migration.
- Código: `web/lib/api/**` (chave, escopos, plano), `web/lib/http/**`
  (envelope e erros), `web/lib/domain/**` (regra de agendamento),
  `web/app/api/v1/**` (rotas), `web/app/actions/api-keys.ts` (criar/revogar
  chave).
- O middleware ignora `/api/v1` (não há sessão de cookie nessas rotas).
- Retenção de `api_request_logs`: não há limpeza automática ainda.

## Exemplo

```bash
curl -H "Authorization: Bearer $ELIZA_KEY" \
  "https://<host>/api/v1/availability?professional_id=$PRO&service_id=$SVC&date=2026-10-05"
```
