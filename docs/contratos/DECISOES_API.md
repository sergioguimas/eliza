# Decisões — unificação das APIs (v1 B2B + Autoatendimento)

> **Rodada de planejamento de 2026-10-06.** Base para os contratos de
> `00-dominio/`, `api-v1/` e para a revisão de `autoatendimento/`.
> Decidido pelo Sérgio; recomendações e alternativas descartadas registradas.

## Contexto

Existem duas APIs sobre o mesmo domínio:

- **Autoatendimento** (contrato TO-BE de 2026-09-23, sem código): o cliente
  final fala por um canal (WhatsApp/bot). Usa token de serviço + ticket HMAC.
- **API v1 B2B** (commit `a0ff88a`, 2026-09-30, sem contrato, só na
  `development`): o tenant integra o próprio sistema/agente. Usa API key por
  tenant.

A v1 duplicou o domínio (`lib/api/domain/appointments.ts`, `lib/api/tempo.ts`)
em vez de usar a extração `lib/domain/` prevista no Autoatendimento. Também
valida horário por um caminho diferente do que lista horários livres, o que
fere a C4.

## Decisões

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| D1 | Manter `a0ff88a` como base. O contrato da v1 é AS-IS com seções TO-BE para as correções. | Reverter e reescrever a partir do contrato | Auth, logs e RLS das tabelas novas estão corretos. O problema é duplicação e regra de negócio, e isso é corrigível. |
| D2 | **Passo 0:** extrair `lib/domain/` (tempo, catálogo, horários, agendamentos, clientes, status). Painel, página pública, v1 e Autoatendimento passam todos por ele. `lib/api/domain` e `lib/api/tempo` são apagados. | Cada API com seu domínio | Toda correção teria que ser feita em dois lugares, e a C4 (uma fonte só de horário) fica impossível. |
| D3 | Um handler só, com **autenticação plugável** (API key \| ticket), e **um envelope só no formato da v1** (`{data}` / `{error:{code,message,details,request_id}}`, códigos em inglês, `message` em português). | Dois envelopes (`{ok,dados}` PT e `{data}` EN) | Dois catálogos de erro para manter para sempre. O Autoatendimento não tem código, então mudar o contrato agora custa só a revisão dos Zod. |
| D4 | **Uma máquina de status em `lib/domain`, obrigatória também para o painel.** Regra abaixo. | Máquina só na API | Uma integração não pode fazer o que o painel proíbe, nem o contrário. |
| D5 | Sem `DELETE` de agendamento na API (cancelar resolve). Pagamento vai para um escopo próprio `payments`. | `write` cobrindo tudo | Um agente de IA com `write` não pode apagar histórico nem dar baixa financeira por engano. |
| D6 | `notify` só para cliente que **já existia antes** do request, mais um teto de envios por org. | Notificar qualquer telefone | Com chave vazada, o número do tenant viraria retransmissor de spam. |
| D7 | A API B2B é feature de plano: o handler checa `organizations.plan` contra uma lista em config. Começa com todos os planos liberados. | Sem gate | Liga a API ao pricing sem bloquear a entrega. |
| D8 | Agendamento criado pelo bot nasce `pending` ("solicitado") e espera o tenant confirmar, igual à página pública (`create-appointment.ts`: `is_public_booking ? "pending"`). Fecha a pendência A1 do CHATBOT.md. | Nascer `scheduled` | Mesmo tratamento de pedido vindo de fora: o tenant mantém o controle da agenda. |

## Regra de status (D4)

Ditada pelo Sérgio:

- **`completed` é final.** A única interação permitida depois é o
  **pagamento**. Não remarca, não muda status, não troca serviço nem
  profissional.
- **`no_show` é final e registra falta.** Para registrar presença é preciso
  marcar **um novo agendamento**; o `no_show` não volta para
  `arrived`/`completed`.
- **`canceled` é final.**

| De | Para |
|---|---|
| `pending` | `scheduled`, `confirmed`, `canceled` |
| `scheduled` | `confirmed`, `arrived`, `completed`, `no_show`, `canceled` |
| `confirmed` | `arrived`, `completed`, `no_show`, `canceled` |
| `arrived` | `completed`, `canceled` (quem chegou não é falta) |
| `completed` / `no_show` / `canceled` | — (só `completed` recebe pagamento) |

`no_show` e `canceled` não recebem pagamento (sem taxa de falta).

Remarcar ou editar só vale em `pending`/`scheduled`/`confirmed`. Repetir o
status atual é idempotente.

## Confirmados em 2026-10-06

- C6 (`autoatendimento_config`) e C7 (token de serviço único + ticket; o token
  do bot **não** é linha de `api_keys`).
- As duas inferências da regra de status acima.

## Pendências

- **Conformidade do painel com D4** — conferência em paralelo. Já se sabe
  que `update-appointment-status.ts` grava qualquer string sem checar o
  status atual, e que `calendar-view.tsx:351` usa `"finalized"`, que não é
  um status válido.
- **Migration `20260930120000`** — confirmar no Studio se foi aplicada.
