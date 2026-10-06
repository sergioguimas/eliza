# 04 — Agendamentos do cliente

> TO-BE · Contrato v1 · Zod: `agendamentos.ts` · ver [README](README.md)

Todos os endpoints daqui exigem `identificacao.situacao = "identificado"`.
Se não, `desconhecido` → `CUSTOMER_NOT_IDENTIFIED`; `ambiguo` →
`CUSTOMER_AMBIGUOUS`.

## Posse

Todo endpoint com `{id}` carrega o agendamento com
`id = :id AND organization_id = org do ticket AND customer_id = cliente
identificado`. Se não achar, `NOT_FOUND`, inclusive quando o
agendamento existe mas é de outro cliente.

## `AgendamentoResumo`

- `servico` / `profissional`: `{ id, nome }` do join. `null` se a FK for nula.
- `inicio` / `fim`: `Momento` a partir de `start_time` / `end_time`.
- Flags (com `antecedenciaOk = inicio - agora >= antecedenciaMinimaMinutos`):
  - `podeCancelar` = status ∈ {`pending`, `scheduled`, `confirmed`} e `antecedenciaOk`
  - `podeRemarcar` = `podeCancelar`
  - `podeConfirmar` = status = `scheduled` e `inicio > agora`

`pending` significa **aguardando aprovação do estabelecimento**. Confirmar
é o cliente dizer "vou", não aprovar; por isso `pending` não se confirma.

## `GET /agendamentos`

Os futuros e ativos do cliente (mesmo filtro do contexto, máx. 20).

## `POST /agendamentos` — criar

Body `CriarAgendamentoBody`. Passo a passo:

1. `aa-escrita` e `aa-criar` (README §6).
2. Serviço e profissional ativos e da org; senão `NOT_FOUND`.
3. Cliente com `max_agendamentos_ativos` ou mais agendamentos futuros ativos →
   `ACTIVE_LIMIT_REACHED`.
4. `inicio` → UTC (`lib/domain/tempo.ts`). Data fora de [hoje, hoje + janela]
   → `OUT_OF_WINDOW`. Antes de agora + antecedência →
   `NOTICE_TOO_SHORT`.
5. `validarHorario` (00-dominio §4) com a duração do serviço,
   `exigirGrade: true` e o mesmo `naoAntesDe`. Recusado → `SLOT_UNAVAILABLE`
   com `details.sugestoes` (até 3 horários livres do mesmo dia e profissional).
   É o mesmo predicado que gera `/horarios`, então a lista **é** a regra (C4).
6. `criarAgendamento` (00-dominio §6.1) com
   `Ator { canal: "autoatendimento", origem: "autoatendimento", podeNotificar: null }`
   (o atendente responde; sem mensagem duplicada), `cliente: { id: clienteId }`
   do ticket (nunca do body) e **`status: "pending"`** (D8: aguarda o
   estabelecimento confirmar, igual à página pública). `price` vem do serviço,
   `payment_status = 'pending'`, `payment_method = null`, `notes` = `observacao`.
7. `23P01` na inserção: se já existe agendamento **deste cliente** com mesmo
   profissional e mesmo `start_time`, criado há menos de 10 min, devolver
   esse como sucesso (retentativa; decisão C5). Senão, `SLOT_UNAVAILABLE`.
8. `appointment_logs`: `action = 'created'`, `source = 'autoatendimento'`,
   `raw_message = null`, `push_name = null`.
9. Resposta: `AgendamentoResposta` com status 201.

## `POST /agendamentos/{id}/remarcar`

Body `RemarcarAgendamentoBody`.

1. `aa-escrita`. Posse. `podeRemarcar` falso → `NOTICE_TOO_SHORT` se
   o motivo for tempo; `INVALID_TRANSITION` se for status.
2. Profissional = `profissionalId` do body ou o atual; se veio no body, precisa
   ser ativo e da org. **O serviço não muda.**
3. Mesmas validações 4 e 5 da criação, com
   `ignorarAgendamentoId = id` (via `editarAgendamento`, 00-dominio §6.2).
4. `UPDATE` no mesmo registro: `start_time`, `end_time` (duração do serviço),
   `professional_id`, `status = 'pending'`,
   `reminder_sent_at = null`, `reminder_morning_sent_at = null` e
   `updated_at`. Zerar os lembretes faz o cron avisar sobre o horário novo.
   `status` volta a `pending` porque um "confirmado" valia para o horário
   antigo, e o estabelecimento aprova de novo (D8).
5. `23P01` → `SLOT_UNAVAILABLE`.
6. Log `action = 'rescheduled'`, com `raw_message` = `"<inicio antigo local> -> <inicio novo local>"`.

Remarcar é um `UPDATE` só, não um cancelar + criar: o histórico, o pagamento e
o id continuam os mesmos.

## `POST /agendamentos/{id}/cancelar`

Body `CancelarAgendamentoBody`.

1. `aa-escrita`. Posse.
2. Status fora de {`pending`, `scheduled`, `confirmed`} → `INVALID_TRANSITION`.
3. Fora da antecedência → `NOTICE_TOO_SHORT`. O atendente deve escalar;
   a equipe decide exceções.
4. `status = 'canceled'`, `updated_at`. **Nunca `DELETE`** (D7).
5. Log `action = 'canceled'`, `raw_message = motivo`.
6. Nenhuma notificação: o atendente responde.

## `POST /agendamentos/{id}/confirmar`

Body vazio.

1. `aa-escrita`. Posse.
2. `status = 'confirmed'` → sucesso idempotente (devolve o agendamento).
3. `status ≠ 'scheduled'` ou `inicio <= agora` → `INVALID_TRANSITION`.
4. `status = 'confirmed'`, `updated_at`. Log `action = 'confirmed'`.

## Domínio

Criar, remarcar, cancelar e confirmar passam por `lib/domain/agendamentos.ts`
([00-dominio §6](../00-dominio/README.md)). A seção "Mudança em
`criarAgendamento`" da versão de 2026-09-23 (`ContextoCriacao`,
`statusInicial`) foi **substituída** pelo `Ator` do 00-dominio. As rotas não
fazem `insert`/`update` em `appointments`.

As rotas da API não revalidam nada, porque o painel é dinâmico: conferir se
alguma página do painel está com cache estático e, se estiver, registrar.

## Aceite

- [ ] Criar no horário livre → 201, status = `pending`, log com `source='autoatendimento'`, **nenhum** WhatsApp enviado.
- [ ] Criar em horário que não aparece em `/horarios` → 409 com `sugestoes`.
- [ ] Criar duas vezes seguidas o mesmo corpo → a 2ª devolve o mesmo `id`.
- [ ] Criar com cliente já no máximo de ativos → 409 `ACTIVE_LIMIT_REACHED`.
- [ ] Body com `organizationId` ou `customerId` extra → 422 `VALIDATION_ERROR`.
- [ ] Remarcar para 30 min depois do próprio horário atual (sobreposto) → sucesso.
- [ ] Remarcar zera `reminder_sent_at` e volta o status ao inicial.
- [ ] Cancelar/remarcar/confirmar agendamento de **outro** cliente da mesma org → 404.
- [ ] Cancelar dentro da antecedência → 422; fora → sucesso, e o registro continua existindo.
- [ ] Confirmar `pending` → 409; confirmar `confirmed` → 200 sem log duplicado.
- [ ] Painel e página pública seguem criando exatamente como antes (status, mensagem, log).
