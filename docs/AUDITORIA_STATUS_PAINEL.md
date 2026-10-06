# Auditoria — painel x regra de status (D4)

Data: 2026-10-06 · Branch: `development` · Só leitura (nenhum código alterado).
Regra de referência: `docs/contratos/DECISOES_API.md`, seção "Regra de status (D4)".

Banco conferido direto no projeto `ttrzlxuqyrqxgbztfmwv` (catálogo do Postgres,
não as migrations do repo).

## Resumo

- **Nenhuma camada aplica a máquina de status hoje.** As server actions gravam
  sem ler o status atual, e o banco só restringe o *valor* do status, não a
  *transição*.
- **Alcançável pela UI hoje:** finalizar ou marcar chegada a partir de
  `pending`; voltar de `arrived` para `confirmed`; remarcar, trocar
  serviço/profissional e cancelar um `completed` (inclusive já pago);
  dar baixa de pagamento em agendamento não finalizado.
- **`no_show` não é gravado em lugar nenhum do painel** (0 linhas no banco).
  Toda violação envolvendo `no_show` está latente: aparece quando a API v1
  (ou o futuro bot) começar a gravar `no_show`.
- **A RLS permite `UPDATE` direto da tabela pelo navegador** (policy `ALL` por
  org), e o painel já usa esse caminho (`calendar-view.tsx:342`). Por isso,
  pôr a máquina só em `lib/domain` não fecha o buraco: qualquer usuário logado
  faz `PATCH /rest/v1/appointments` com o próprio JWT. Ver "Banco" abaixo.

Legenda: **UI** = o painel expõe a ação; **Direta** = só chamando a server
action (POST público para usuário logado) ou o PostgREST.

## 1. Banco (efeito real)

| Item | Estado | Comentário |
|---|---|---|
| `appointments_status_check` | `status IN (scheduled, pending, confirmed, arrived, canceled, completed, no_show)` | Valida o valor. `"finalized"` é rejeitado aqui. |
| `appointments_payment_status_check` | `pending, paid, partially_paid, refunded` | — |
| `appointments_payment_method_check` | `dinheiro, pix, cartao_credito, cartao_debito, outro` | `'Outros'` (default da action) **viola** — ver §2.3. |
| `appointments_professional_overlap_idx` | EXCLUDE em `pending/scheduled/confirmed/arrived` | Coerente com o `ACTIVE` da API. |
| Triggers | só `update_appointments_updated_at` | **Nenhum trigger de transição.** |
| Funções que alteram `appointments` | só `request_public_appointment` (INSERT, nasce `pending`) | Nenhuma função muda status. |
| `finalize_service_record` | muda `service_records.status` `draft → finalized` | **Não toca em `appointments`.** Provável origem do `"finalized"` do calendário. Não é chamada pelo app. |
| RLS | policy única `Org access appointments`, `ALL`, `organization_id = get_user_org_id()` | Qualquer membro da org faz UPDATE/DELETE de qualquer coluna, por qualquer cliente HTTP. |

**Violação estrutural (Direta):** sem trigger de transição e com RLS `ALL`,
todo o D4 é contornável pelo PostgREST. Ponto para decidir na D2: trigger
`BEFORE UPDATE` espelhando a tabela de transições, ou revogar `UPDATE` do
`authenticated` e obrigar o painel a passar por server action.

Dados atuais (orgs não-demo): `scheduled/pending` 8, `confirmed/pending` 3,
`canceled/pending` 10. Nenhum registro hoje já está em estado proibido.

## 2. Server actions

### 2.1 `web/app/actions/update-appointment-status.ts:7-13`
- **Permite:** gravar qualquer string em `status`, de qualquer status, sem ler o atual. Valor inválido só cai no CHECK.
- **Viola:** todas as finais (`completed`/`no_show`/`canceled` → qualquer coisa) e todas as transições fora da tabela.
- **UI:** sim, parcialmente (ver §3.1). **Direta:** tudo.

### 2.2 `web/app/actions/update-appointment.ts:84-152` (remarcar/editar)
- **Permite:** mudar data/hora, serviço, profissional e notas de qualquer agendamento. O `select` (`:99-110`) nem busca `status`.
- **Viola:** "remarcar/editar só em `pending/scheduled/confirmed`"; "`completed` não troca serviço nem profissional". Também remarca `canceled` e `no_show`; remarcar um `canceled` para cima de outro horário passa pela EXCLUDE (canceled não está no índice) e manda WhatsApp de "alterado" (`:168`).
- **UI:** sim — clicar no card da agenda abre o diálogo de edição para qualquer status visível (`arrived`, `completed`, `completed`+pago, futuramente `no_show`). Agenda esconde `canceled`, então editar `canceled` é só **Direta**.

### 2.3 `web/app/actions/update-appointment-payment.ts:6-16`
- **Permite:** marcar `paid` em qualquer agendamento, inclusive `canceled`, `no_show`, `pending`, `scheduled`; repetir sobre um já pago reescreve `paid_at`/`payment_method`.
- **Viola:** "só `completed` recebe pagamento" (e a inferência a confirmar: `no_show`/`canceled` não recebem).
- **UI:** sim, pelo financeiro (§3.5). `canceled` só **Direta**.
- **Bug lateral (não D4):** sem `method`, grava `'Outros'` (`:14`), que o CHECK rejeita. A UI sempre passa método, então só quebra em chamada direta.

### 2.4 `web/app/actions/cancel-appointment.ts:8-13`
- **Permite:** `canceled` a partir de qualquer status; dispara WhatsApp de cancelamento mesmo se já era `canceled`/`completed`.
- **Viola:** `completed → canceled`, `no_show → canceled` (finais). `canceled → canceled` é idempotente pela regra, mas reenvia a mensagem.
- **UI:** sim — botão lixeira do diálogo de edição (`update-appointment-dialog.tsx:276-281` → `cancel-appointment-dialog.tsx:46`), alcançável para `completed` (pago ou não). Cancelar um `completed` pago tira a receita do financeiro (`get-financial-summary.ts:47` ignora `canceled`).

### 2.5 `web/app/actions/delete-appointment.ts`
- `cancelAppointment` (`:10-27`): mesma falha do 2.4, duplicada. **UI:** os menus usam este (§3.1/3.2), com gate correto (só aparece fora de `canceled`/`completed`/pago) — mas `no_show` cai no ramo de ações rápidas.
- `deleteAppointment` (`:69-84`): **DELETE físico** de qualquer agendamento, inclusive `completed` pago; `appointment_logs` some em cascata. Viola o espírito de "final" e a D5. **UI:** nenhuma (não é importado em lugar nenhum). **Direta:** sim — é export de arquivo `'use server'`, então é endpoint.

### 2.6 `web/app/actions/handle-appointment-request.ts:11-26`
- **Permite:** `confirmed` ou `canceled` a partir de qualquer status.
- **Viola (Direta):** `completed/no_show/canceled → confirmed|canceled`, `arrived → confirmed`.
- **UI:** só lista `status = 'pending'` (`dashboard/page.tsx:183` → `pending-request-list.tsx:46`). Transições `pending→confirmed|canceled` são válidas. Corrida: se o pedido mudar de status entre o carregamento do dashboard e o clique, a action não confere.

### 2.7 `web/app/actions/create-appointment.ts:273-275, 456`
- Status inicial correto (`pending` público, `scheduled` painel). Mas `payment_status` vem do `formData` no fluxo do painel: dá para criar `scheduled` já `paid`.
- **Viola (Direta):** pagamento fora de `completed`. **UI:** o diálogo de criação não envia `payment_status`.

### 2.8 `web/app/actions/service-records.ts`
- Só lê `appointments.professional_id` (`:73-80`). Não altera agendamento. Sem violação.

## 3. Componentes do painel

### 3.1 `web/components/appointments/appointment-card-actions.tsx` (menu "...")
Gate por status (`:132-221`):

| Status | O que aparece | Veredito |
|---|---|---|
| `canceled` | item desabilitado | OK |
| `completed` não pago | só pagamento | OK |
| qualquer status com `payment_status = paid` | item desabilitado | OK (mas esconde Cancelar/Finalizar de um `scheduled` pago — só existe por chamada direta) |
| `pending` | Confirmar, **Chegada**, **Finalizar**, Cancelar | **Viola (UI):** `pending→arrived`, `pending→completed` |
| `scheduled` | Confirmar, Chegada, Finalizar, Cancelar | OK (falta `no_show`, lacuna e não violação) |
| `confirmed` | idem | OK (Confirmar é idempotente) |
| `arrived` | **Confirmar**, Chegada, Finalizar, Cancelar | **Viola (UI):** `arrived→confirmed` |
| `no_show` (latente) | **Confirmar, Chegada, Finalizar**, Cancelar | **Viola (UI, latente):** final reaberto |

Usado em: `calendar-view.tsx:498`, `app/(app)/dashboard/page.tsx:498`, `app/(app)/clientes/[id]/page.tsx:259`.

### 3.2 `web/components/appointments/appointment-context-menu.tsx` (clique direito)
Mesma árvore de decisão do 3.1 (`:124-187`), mesmas violações. Usado em
`calendar-view.tsx:460`, `dashboard/page.tsx:445`, `clientes/[id]/page.tsx:202`.

### 3.3 `web/components/appointments/calendar-view.tsx`
- `:315-319` `handleEventClick` abre o diálogo de edição para qualquer card visível → §2.2 e §2.4 pela UI.
- `:342-358` `handleStatusChange`: **segunda escrita do mesmo status, direto do navegador** (`supabase.from("appointments").update` com o client do browser), passada como `onStatusChange` ao menu de contexto (`:462`). O menu já gravou pela action; o calendário grava de novo pelo PostgREST. Prova de que o painel depende do UPDATE liberado na RLS.
- `:351` `"finalized"`: não é status de agendamento (é de `service_records`). Ramo morto — o menu nunca passa esse valor, e se passasse o CHECK rejeitaria.
- Não há drag-and-drop: nenhum `draggable`/`onDrag*` no arquivo. Remarcar é só pelo diálogo.
- Esconde `canceled` da grade (`:563`, `:626`).

### 3.4 `web/components/appointments/update-appointment-dialog.tsx` / `cancel-appointment-dialog.tsx`
- Formulário (`:202`) e lixeira (`:276-281`) sem nenhum gate por status. Ver §2.2 e §2.4.

### 3.5 `web/components/dashboard/financial-cards.tsx` (Finanças)
- Lista "a prazo" = todo agendamento não-`canceled` e não pago do mês (`get-financial-summary.ts:47-57`): inclui `pending`, `scheduled`, `confirmed`, `arrived` e `no_show`.
- Botão "Baixar" (`:293-350`) aparece para todos eles → `updateAppointmentPayment`.
- **Viola (UI):** pagamento fora de `completed`, inclusive `no_show` (latente).
- Efeito colateral: "a prazo" soma como receita esperada agendamentos `no_show` e `pending`.

### 3.6 `web/components/appointments/payment-menu.tsx`
- Chama `updateAppointmentPayment` (`:55`) sem gate, mas **não é usado em lugar nenhum**. Código morto.

### 3.7 Telas
- `app/(app)/dashboard/page.tsx`: só monta os componentes 3.1/3.2 e a lista de pedidos (2.6). Rótulos (`:476-492`) não cobrem `pending`/`no_show` e um filtro usa `"cancelled"` (`:160`), que não existe — cosmético, não é transição.
- `app/(app)/clientes/[id]/page.tsx`: histórico do cliente com todos os status, cada um com 3.1 e 3.2 → mesmas violações, e é o lugar onde `arrived`/`no_show` antigos ficam mais expostos.

## 4. Fora do painel (automação)

| Caminho | O que faz | Veredito |
|---|---|---|
| Webhook WhatsApp `app/api/webhooks/whatsapp/[[...slug]]/route.ts:356-401` | busca próximo agendamento futuro em `pending/scheduled/confirmed` e grava `confirmed` ou `canceled` | Transições válidas. Ressalva: lê e grava em duas etapas sem `.in("status", ...)` no UPDATE — se o tenant finalizar/cancelar entre as duas, o webhook sobrescreve. |
| Cron `app/api/cron/reminders.ts:169, 255, 293, 363` | lê `scheduled/confirmed`, grava só `reminder_*_sent_at` | Não muda status. OK. |
| `whatsapp-messages.ts:78, 206` | só leitura | OK. |
| Seeds de demo (`lib/demo/seed.ts`, `actions/demo/create-demo-timeline.ts`) | INSERT com status arbitrário | Não é transição; fora do escopo. |

## 5. A API v1 (`lib/api/domain/appointments.ts`) também diverge do D4

Relevante porque é a candidata natural a virar `lib/domain`:

- `:28` `arrived: ["completed", "no_show", "canceled"]` — D4 diz `arrived → completed | canceled`. Sobra `no_show`.
- `:490` `registerPayment` só bloqueia `canceled`; D4 diz só `completed` recebe (e `no_show` não, a confirmar).
- `:513` `deleteAppointment` existe e é exposto em `app/api/v1/appointments/[id]/route.ts:30` — D5 diz sem DELETE na API.
- `:22` `EDITABLE` e o idempotente de `:451` batem com o D4.

## 6. Lista de violações

**Alcançáveis pela UI hoje**

1. `pending → arrived` e `pending → completed` — menus 3.1/3.2 (agenda, dashboard, ficha do cliente).
2. `arrived → confirmed` — menus 3.1/3.2.
3. Remarcar/editar (data, serviço, profissional) de `arrived` e `completed` (pago ou não) — clique no card da agenda, §2.2.
4. `completed → canceled` (inclusive pago, apagando a receita do financeiro) — lixeira do diálogo de edição, §2.4.
5. Pagamento em `pending/scheduled/confirmed/arrived` — "Baixar" em Finanças, §3.5.
6. Escrita de status direto do navegador pelo PostgREST — `calendar-view.tsx:342`.

**Latentes pela UI (dependem de existir `no_show`)**

7. `no_show → confirmed/arrived/completed/canceled` — menus 3.1/3.2.
8. Remarcar/editar/cancelar `no_show` — §2.2/§2.4 pela agenda.
9. Pagamento em `no_show` — Finanças.

**Só por chamada direta (server action ou PostgREST)**

10. Qualquer transição, qualquer string — `updateAppointmentStatus`.
11. Remarcar/editar `canceled` — `updateAppointment`.
12. Pagamento em `canceled`; repagar sobrescrevendo `paid_at` — `updateAppointmentPayment`.
13. `canceled`/`completed`/`no_show → confirmed|canceled` — `handleAppointmentRequest`.
14. DELETE físico de qualquer agendamento — `deleteAppointment` (actions).
15. Criar já `paid` — `createAppointment` com `payment_status` no form.
16. Tudo acima via `PATCH/DELETE /rest/v1/appointments` — RLS `ALL` sem trigger de transição.

## 7. Pontos de chamada que precisam passar pela máquina de `lib/domain`

Server actions (reescrever em cima de `lib/domain`):

- `web/app/actions/update-appointment-status.ts` → transição (`changeStatus`).
- `web/app/actions/update-appointment.ts` → edição/remarcação (checar `EDITABLE`).
- `web/app/actions/update-appointment-payment.ts` → pagamento (só `completed`).
- `web/app/actions/cancel-appointment.ts` → transição para `canceled`.
- `web/app/actions/delete-appointment.ts` → `cancelAppointment` (duplicata: unificar com o de cima) e `deleteAppointment` (remover ou restringir).
- `web/app/actions/handle-appointment-request.ts` → transição `pending → confirmed|canceled`.
- `web/app/actions/create-appointment.ts` → status/`payment_status` iniciais.

Rotas/automação:

- `web/app/api/webhooks/whatsapp/[[...slug]]/route.ts:393-399` → transição, com o UPDATE condicionado ao status lido.
- `web/lib/api/domain/appointments.ts` (`TRANSITIONS`, `EDITABLE`, `registerPayment`, `deleteAppointment`) → mover/alinhar para `lib/domain` e corrigir §5.

Componentes (passar a perguntar à máquina quais ações mostrar, em vez de `if` próprio):

- `web/components/appointments/appointment-card-actions.tsx:132-221`
- `web/components/appointments/appointment-context-menu.tsx:124-187`
- `web/components/appointments/calendar-view.tsx:315-319` (abrir edição) e `:342-358` (remover a escrita direta e o `"finalized"`)
- `web/components/appointments/update-appointment-dialog.tsx` (formulário e lixeira)
- `web/components/dashboard/financial-cards.tsx:293` (botão "Baixar") e `web/app/actions/get-financial-summary.ts:47-57` (o que conta como "a prazo")
- `web/components/appointments/payment-menu.tsx` (morto: remover)

Banco (decidir na D2):

- Trigger `BEFORE UPDATE OF status, start_time, end_time, service_id, professional_id, payment_status` em `appointments` com a mesma tabela de transições, **ou** retirar `UPDATE/DELETE` do `authenticated` na policy e forçar tudo por server action. Sem um dos dois, a máquina em `lib/domain` é contornável.

## Pendências para o Sérgio

- Confirmar `arrived → no_show` proibido (D4 diz que não; a API hoje permite).
- Confirmar que `no_show`/`canceled` não recebem pagamento, e se pagamento antecipado (sinal) em `scheduled`/`confirmed` é proibido mesmo — hoje Finanças permite.
- Painel não tem ação para marcar `no_show`. Lacuna de produto, não violação.

**Respondidas em 2026-10-06** (`docs/contratos/DECISOES_API.md`): `arrived → no_show`
proibido; `no_show`/`canceled` não recebem pagamento; sinal antes de concluir
**permitido** (D10); painel ganha "Faltou" só após o horário (D11); escrita
direta pelo PostgREST fechada revogando `UPDATE/DELETE` do `authenticated`
(D9). Incorporado ao `docs/contratos/00-dominio/README.md` §8.
