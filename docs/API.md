# API REST do Eliza (`/api/v1`)

API multitenant para integrações externas (agentes, automações). Cobre todas
as ações de agendamento. Não confundir com o contrato TO-BE de autoatendimento
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
- Escopos: `read` (GET) e `write` (POST/PATCH/DELETE). Sem o escopo: `403`.
- Chave revogada/expirada: `401`. Organização suspensa ou demo: `403`.
- Máx. 10 chaves ativas por tenant. Revogar é imediato.

## Formato

Sucesso: `{ "data": ..., "meta": ... }`. Erro:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "details": null, "request_id": "..." } }
```

Todo response traz `X-Request-Id` (o mesmo gravado no log). Códigos:
`UNAUTHORIZED` 401 · `FORBIDDEN` 403 · `ORGANIZATION_SUSPENDED` 403 ·
`NOT_FOUND` 404 · `CONFLICT`/`SLOT_UNAVAILABLE`/`INVALID_TRANSITION` 409 ·
`INVALID_JSON` 400 · `VALIDATION_ERROR` 422 · `RATE_LIMITED` 429 (com
`Retry-After`) · `INTERNAL_ERROR` 500.

Limite: 120 requisições/minuto por chave.

**Horários:** entrada `"2026-10-05T14:30"` = relógio de São Paulo; também
aceita ISO com offset/`Z`. Saída traz `start_time` (UTC) e `start_local`.

## Rotas

| Método | Rota | Escopo | Descrição |
|---|---|---|---|
| GET | `/me` | read | Tenant e dados da chave |
| GET | `/services` | read | Serviços ativos |
| GET | `/professionals` | read | Profissionais ativos |
| GET | `/availability?professional_id&date=YYYY-MM-DD[&service_id]` | read | Horários livres |
| GET | `/customers?phone=` `?document=` `?q=` | read | Busca de clientes (máx. 20) |
| GET | `/appointments` | read | Lista. Filtros: `status` (vírgula), `from`, `to` (data ou data/hora), `customer_id`, `professional_id`, `limit` (≤100), `offset` |
| POST | `/appointments` | write | Cria (201) |
| GET | `/appointments/{id}` | read | Detalhe |
| PATCH | `/appointments/{id}` | write | Remarca/altera: `start_time`, `professional_id`, `service_id`, `notes` |
| POST | `/appointments/{id}/confirm` | write | Confirma |
| POST | `/appointments/{id}/cancel` | write | Cancela (mantém o registro). `reason` opcional |
| POST | `/appointments/{id}/status` | write | Muda status com validação de transição |
| POST | `/appointments/{id}/payment` | write | Baixa de pagamento: `method`, `status` |
| DELETE | `/appointments/{id}` | write | Exclusão definitiva (`?notify=true` avisa o cliente) |
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
cadastro) ou cria um novo. `notify` (padrão **false**) envia WhatsApp ao
cliente pela instância do tenant; o padrão é falso porque o agente costuma
responder por conta própria.

Validações: horário no passado (422), fora do expediente/agenda do profissional
ou já ocupado (409 `SLOT_UNAVAILABLE`; a exclusion constraint do banco é a
garantia final contra corrida).

### Status

`pending → scheduled|confirmed|canceled` · `scheduled → confirmed|arrived|completed|no_show|canceled` ·
`confirmed → arrived|completed|no_show|canceled` · `arrived → completed|no_show|canceled`.
`completed`, `canceled` e `no_show` são finais. Repetir o status atual é
idempotente. Remarcar só vale para `pending`/`scheduled`/`confirmed`, e zera
os lembretes para o cron avisar do novo horário.

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
  `source = 'api:<prefixo da chave>'`. Essa tabela apaga a linha junto com o
  agendamento (FK em cascata): para exclusões, o rastro durável é o
  `api_request_logs` (`DELETE /appointments/{id}`).

## Operação

- Migration: `supabase/migrations/20260930120000_public_api_keys_and_logs.sql`
  (aditiva; aplicar antes do deploy). Depois rode `supabase gen types`: os
  tipos de `api_keys`/`api_request_logs` em `utils/database.types.ts` foram
  escritos à mão no mesmo formato.
- Código: `web/lib/api/**` (auth, envelope, domínio), `web/app/api/v1/**`
  (rotas), `web/app/actions/api-keys.ts` (criar/revogar chave).
- O middleware ignora `/api/v1` (não há sessão de cookie nessas rotas).
- Retenção de `api_request_logs`: não há limpeza automática ainda.

## Exemplo

```bash
curl -H "Authorization: Bearer $ELIZA_KEY" \
  "https://<host>/api/v1/availability?professional_id=$PRO&date=2026-10-05"
```
