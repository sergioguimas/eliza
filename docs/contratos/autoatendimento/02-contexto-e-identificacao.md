# 02 — Contexto e identificação do cliente

> TO-BE · Contrato v1 · Zod: `contexto.ts` · ver [README](README.md)

## Identificação

`lib/autoatendimento/identificar.ts`:

```ts
identificarCliente(orgId: string, telefoneDoTicket: string): Promise<
  | { situacao: "identificado"; clienteId: string; primeiroNome: string }
  | { situacao: "desconhecido" }
  | { situacao: "ambiguo" }
>
```

Regra:

1. `variantes = brPhoneVariants(telefoneDoTicket)` (`lib/phone-br.ts`).
2. `customers` com `organization_id = orgId`, `phone_normalized in variantes`
   e `deleted_at is null`. Service role, colunas `id, name`.
3. 0 linhas → `desconhecido`; 1 → `identificado`; 2 ou mais → `ambiguo`.

**Nunca desempatar.** Não pegar a primeira, a mais recente nem a que "parece"
certa. O webhook antigo fazia `?? candidates[0]` e isso é o que não se repete
aqui. Ambíguo significa que a equipe resolve (o atendente escala).

Como `uq_customers_org_phone` é único só sobre o valor normalizado literal, o
mesmo celular pode existir como `11987654321` e `5511987654321` em dois
cadastros. É esse o caso "ambíguo" real.

`primeiroNome` = primeira palavra de `customers.name`. O nome completo não vai
para o contexto.

## `GET /api/v1/autoatendimento/contexto`

Uma chamada por turno de conversa, antes do atendente responder. Sem query.

Monta, em paralelo quando possível:

| Campo | Fonte |
|---|---|
| `agora` | Relógio do servidor, como `Momento` |
| `organizacao.nome`, `nicho` | `organizations` (id do ticket) |
| `organizacao.termos` | `nicheDictionaries[nicho].entities` + `gender`; nicho sem dicionário → o `base`. `cliente_plural` → `clientePlural` etc. |
| `expediente` | `organization_settings`: `days_of_week`, `open_hours_*`, `lunch_*` (`HH:mm`; `null` se vazio) |
| `politica` | `autoatendimento_config` (01) |
| `identificacao` | `identificarCliente` |
| `agendamentos` | Se identificado: status `pending`/`scheduled`/`confirmed` com `start_time >= agora`, ordem crescente, máx. 10, no formato `AgendamentoResumo` (04) |
| `aguardandoConfirmacao` | ids dentre os `agendamentos` com `status = 'scheduled'` e `reminder_sent_at is not null` |

Erros possíveis: os de autenticação, `ADDON_INATIVO` e `ERRO_INTERNO`.
`desconhecido` e `ambiguo` **não** são erro aqui; são dados.

## O que o contexto nunca contém

- Documento, e-mail, data de nascimento, endereço e observações do cliente
  (ver 05 se o cliente pedir).
- Prontuário (`service_records`), orçamento, financeiro.
- `contato_humano_telefone`, `whatsapp_instance_name`, dados de plano.
- Qualquer informação de outro cliente, inclusive "horário ocupado por fulano".

## Aceite

- [ ] Telefone com 0 cadastros → `desconhecido`, `agendamentos: []`.
- [ ] Telefone gravado como `11987654321` e ticket com `5511987654321` → `identificado`.
- [ ] Ticket com celular antigo sem o 9 (`551187654321`) casa com cadastro `11987654321`.
- [ ] Dois cadastros com o mesmo número em formas diferentes → `ambiguo`, sem agendamentos.
- [ ] Cadastro com `deleted_at` preenchido não é identificado.
- [ ] Agendamento `canceled` ou passado não aparece.
- [ ] `aguardandoConfirmacao` contém só `scheduled` com lembrete enviado.
- [ ] Org de nicho `oficina` (sem dicionário) devolve termos do `base` sem quebrar.
- [ ] Add-on com `ativo=false` → 403 `ADDON_INATIVO`.
