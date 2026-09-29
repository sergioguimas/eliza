# 04 — Agendamentos do cliente

> TO-BE · Contrato v1 · Zod: `agendamentos.ts` · ver [README](README.md)

Todos os endpoints daqui exigem `identificacao.situacao = "identificado"`.
Se não, `desconhecido` → `CLIENTE_NAO_IDENTIFICADO`; `ambiguo` →
`CLIENTE_AMBIGUO`.

## Posse

Todo endpoint com `{id}` carrega o agendamento com
`id = :id AND organization_id = org do ticket AND customer_id = cliente
identificado`. Se não achar, `NAO_ENCONTRADO`, inclusive quando o
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
2. Serviço e profissional ativos e da org; senão `NAO_ENCONTRADO`.
3. Cliente com `max_agendamentos_ativos` ou mais agendamentos futuros ativos →
   `LIMITE_AGENDAMENTOS_ATIVOS`.
4. `inicio` → UTC (`lib/domain/tempo.ts`). Data fora de [hoje, hoje + janela]
   → `FORA_DA_JANELA`. Antes de agora + antecedência →
   `ANTECEDENCIA_INSUFICIENTE`.
5. **`inicio` precisa estar em `calcularHorariosLivres(...)`**, com a duração
   do serviço e o mesmo `naoAntesDe`. Se não estiver, `HORARIO_INDISPONIVEL`,
   com `detalhes.sugestoes` = até 3 horários livres do mesmo dia e
   profissional. Não há segunda validação de expediente: a lista **é** a
   regra (decisão C4).
6. `criarAgendamento` (`lib/domain/agendamentos.ts`) com contexto:
   ```ts
   {
     organizationId,
     canal: "autoatendimento",
     clienteId,                       // do ticket, nunca do body
     statusInicial: config.statusInicial,
     notificar: false,                // o atendente responde; sem mensagem duplicada
   }
   ```
   `price` vem do serviço. `payment_status = 'pending'` e
   `payment_method = null`, como no fluxo público. `notes` = `observacao`.
7. `23P01` na inserção: se já existe agendamento **deste cliente** com mesmo
   profissional e mesmo `start_time`, criado há menos de 10 min, devolver
   esse como sucesso (retentativa; decisão C5). Senão, `HORARIO_INDISPONIVEL`.
8. `appointment_logs`: `action = 'created'`, `source = 'autoatendimento'`,
   `raw_message = null`, `push_name = null`.
9. Resposta: `AgendamentoResposta` com status 201.

## `POST /agendamentos/{id}/remarcar`

Body `RemarcarAgendamentoBody`.

1. `aa-escrita`. Posse. `podeRemarcar` falso → `ANTECEDENCIA_INSUFICIENTE` se
   o motivo for tempo; `TRANSICAO_INVALIDA` se for status.
2. Profissional = `profissionalId` do body ou o atual; se veio no body, precisa
   ser ativo e da org. **O serviço não muda.**
3. Mesmas validações 4 e 5 da criação, com
   `ignorarAgendamentoId = id` em `calcularHorariosLivres`.
4. `UPDATE` no mesmo registro: `start_time`, `end_time` (duração do serviço),
   `professional_id`, `status = config.statusInicial`,
   `reminder_sent_at = null`, `reminder_morning_sent_at = null` e
   `updated_at`. Zerar os lembretes faz o cron avisar sobre o horário novo.
   `status` volta ao inicial porque um "confirmado" valia para o horário
   antigo.
5. `23P01` → `HORARIO_INDISPONIVEL`.
6. Log `action = 'rescheduled'`, com `raw_message` = `"<inicio antigo local> -> <inicio novo local>"`.

Remarcar é um `UPDATE` só, não um cancelar + criar: o histórico, o pagamento e
o id continuam os mesmos.

## `POST /agendamentos/{id}/cancelar`

Body `CancelarAgendamentoBody`.

1. `aa-escrita`. Posse.
2. Status fora de {`pending`, `scheduled`, `confirmed`} → `TRANSICAO_INVALIDA`.
3. Fora da antecedência → `ANTECEDENCIA_INSUFICIENTE`. O atendente deve escalar;
   a equipe decide exceções.
4. `status = 'canceled'`, `updated_at`. **Nunca `DELETE`** (D7).
5. Log `action = 'canceled'`, `raw_message = motivo`.
6. Nenhuma notificação: o atendente responde.

## `POST /agendamentos/{id}/confirmar`

Body vazio.

1. `aa-escrita`. Posse.
2. `status = 'confirmed'` → sucesso idempotente (devolve o agendamento).
3. `status ≠ 'scheduled'` ou `inicio <= agora` → `TRANSICAO_INVALIDA`.
4. `status = 'confirmed'`, `updated_at`. Log `action = 'confirmed'`.

## Mudança em `criarAgendamento` (lib/domain)

O `BookingContext` da sessão de segurança vira:

```ts
type ContextoCriacao = {
  organizationId: string
  canal: "painel" | "publico" | "autoatendimento"
  statusInicial: "pending" | "scheduled"
  clienteId?: string                 // obrigatório em "autoatendimento"
  notificar: boolean
  allowNotify?: () => Promise<boolean>   // mantém o teto por org do público
}
```

- `painel` → `statusInicial: "scheduled"`, `notificar: true`. Igual a hoje.
- `publico` → `"pending"`, `notificar: true` + `allowNotify`. Igual a hoje.
- `autoatendimento` → como descrito acima.

A entrada deixa de ser `FormData`: `criarAgendamento` recebe um objeto tipado.
As actions convertem `FormData` → objeto antes de chamar. `revalidatePath`
fica nas actions, fora do domínio. As rotas da API não revalidam nada, porque
o painel é dinâmico: conferir se alguma página do painel está com cache
estático e, se estiver, registrar.

## Aceite

- [ ] Criar no horário livre → 201, status = `status_inicial` da org, log com `source='autoatendimento'`, **nenhum** WhatsApp enviado.
- [ ] Criar em horário que não aparece em `/horarios` → 409 com `sugestoes`.
- [ ] Criar duas vezes seguidas o mesmo corpo → a 2ª devolve o mesmo `id`.
- [ ] Criar com cliente já no máximo de ativos → 409 `LIMITE_AGENDAMENTOS_ATIVOS`.
- [ ] Body com `organizationId` ou `customerId` extra → 422 `VALIDACAO`.
- [ ] Remarcar para 30 min depois do próprio horário atual (sobreposto) → sucesso.
- [ ] Remarcar zera `reminder_sent_at` e volta o status ao inicial.
- [ ] Cancelar/remarcar/confirmar agendamento de **outro** cliente da mesma org → 404.
- [ ] Cancelar dentro da antecedência → 422; fora → sucesso, e o registro continua existindo.
- [ ] Confirmar `pending` → 409; confirmar `confirmed` → 200 sem log duplicado.
- [ ] Painel e página pública seguem criando exatamente como antes (status, mensagem, log).
