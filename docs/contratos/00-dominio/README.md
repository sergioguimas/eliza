# Contrato — Domínio compartilhado (`web/lib/domain/`)

> **Tipo:** TO-BE. `web/lib/domain/` não existe. Hoje a regra está espalhada
> em server actions e duplicada em `web/lib/api/domain/` e `web/lib/api/tempo.ts`.
> **Escrito em:** 2026-10-06 · **Decisões de origem:** [../DECISOES_API.md](../DECISOES_API.md) (D2, D4, D8)
> **É o passo 0** de [api-v1](../api-v1/README.md) e de [autoatendimento](../autoatendimento/README.md).

## Para quem executa

Este contrato descreve a **regra de negócio de agendamento** que painel,
página pública, API v1 (B2B) e Autoatendimento passam a compartilhar. Ele não
tem rota HTTP nem Zod: as assinaturas TypeScript daqui são o contrato.

Onde der valor fechado, use o valor. Se o código contradisser uma premissa
daqui, pare, registre em `docs/RELATORIO_DOMINIO.md` e siga o que é correto.

**Regra de ouro:** depois deste contrato, **nenhum** arquivo fora de
`lib/domain/` faz `insert`/`update` em `appointments`, nem calcula horário
livre, nem converte hora local para UTC. Verificável por grep (ver Aceite).

## 1. Estrutura

```
web/lib/domain/
  tempo.ts          fuso, conversão local <-> UTC, Momento
  catalogo.ts       serviços e profissionais ativos
  horarios.ts       horários livres + validação de um horário (UMA fonte)
  status.ts         máquina de status (D4) e guardas
  clientes.ts       identificação e resolução de cliente
  agendamentos.ts   criar, remarcar/editar, mudar status, pagamento
  mensagens.ts      textos de WhatsApp de agendamento (templates + fallback)
  erros.ts          DomainError
```

- Todo arquivo começa com `import "server-only"`, **exceto `status.ts` e
  `tempo.ts`**, que são puros (sem banco, sem segredo) e são importados também
  por código do navegador: `status.ts` pelos componentes do painel para
  decidir quais ações mostrar (§8.2); `tempo.ts` por `lib/utils.ts` e pelo
  dashboard, para eliminar o offset fixo `-03:00` (decisão de 2026-10-06,
  depois da etapa 1). Nenhum dos dois pode importar nada `server-only`. **Nenhum** tem `'use server'`: server
  action vira endpoint POST público (lição de `send-whatsapp.ts`).
- O domínio recebe um client Supabase **service role** como parâmetro
  (`db: Db`). Como o RLS não escopa nada, **toda** query filtra por
  `organization_id`, sem exceção.
- O domínio **nunca** descobre a org sozinho. Quem chama é que resolve: a
  action pela sessão, a API pela chave, o Autoatendimento pelo ticket, a
  página pública pelo slug. O domínio só recebe `organizationId` já confiável.
- O domínio não chama `revalidatePath`, não lê `headers()` e não conhece HTTP.

### Erros

```ts
export type CodigoDominio =
  | "NOT_FOUND"            // recurso inexistente OU de outro tenant (nunca diferenciar)
  | "VALIDATION_ERROR"     // entrada malformada (data inválida, campo faltando)
  | "SLOT_UNAVAILABLE"     // horário fora de expediente, ocupado, fora da grade
  | "INVALID_TRANSITION"   // máquina de status ou guarda de edição/pagamento
  | "CUSTOMER_AMBIGUOUS"   // mais de um cadastro casa com telefone/documento
  | "CUSTOMER_CONFLICT"    // documento já pertence a outro cliente

export class DomainError extends Error {
  constructor(public codigo: CodigoDominio, message: string, public detalhes?: unknown) {
    super(message)
  }
}
```

- `message` é em português e pode ir direto ao usuário final. Nunca contém
  dado de outro cliente.
- Erro inesperado de banco: `console.error("[domain:<funcao>]", ...)` e
  `throw`. Quem chama converte em 500 genérico. Não repetir a mesma string de
  erro em dois `throw` da mesma função.
- As server actions convertem `DomainError` em `{ error: message }`, que é o
  formato que o painel já consome. A API converte pelo mapa da
  [api-v1 §4](../api-v1/README.md).

## 2. `tempo.ts`

Fonte única de fuso. Hoje há **quatro cópias** da conversão: `create-appointment.ts`,
`update-appointment.ts`, `lib/api/tempo.ts` e o `-03:00` fixo de
`get-available-slots.ts`. O fixo erraria se o Brasil voltar a ter horário de
verão. Todas viram esta.

```ts
export const FUSO = "America/Sao_Paulo"

/** "2026-10-05T14:30" (relógio de SP, sem offset) -> instante UTC.
 *  Também aceita ISO com offset ou Z ("2026-10-05T17:30:00Z"), que é usado como está.
 *  Malformado -> DomainError VALIDATION_ERROR. */
export function horaLocalParaUtc(valor: string): Date

/** Instante -> "2026-10-05T14:30" no relógio de SP. */
export function utcParaHoraLocal(instante: Date | string): string

export type Momento = { utc: string; local: string }   // ISO UTC + "AAAA-MM-DDTHH:mm"
export function momento(instante: Date | string): Momento

/** "AAAA-MM-DD" local -> [início, fim) do dia em UTC. */
export function limitesDoDiaUtc(data: string): { inicio: Date; fim: Date }

export function dataLocal(instante: Date): string        // "AAAA-MM-DD"
export function diaDaSemanaLocal(data: string): number   // 0 = domingo
export function minutosDoDiaLocal(instante: Date): number
```

Implementação: a de `lib/api/tempo.ts` (`wallTimeToUtc` com `hour % 24`, que
já cobre o "24" da meia-noite de alguns runtimes), não a de
`create-appointment.ts`, que não cobre.

## 3. `catalogo.ts`

```ts
listarServicosAtivos(db, orgId): Promise<Servico[]>
listarProfissionaisAtivos(db, orgId): Promise<Profissional[]>
exigirServicoAtivo(db, orgId, id): Promise<Servico>            // senão NOT_FOUND
exigirProfissionalAtivo(db, orgId, id): Promise<Profissional>  // senão NOT_FOUND

type Servico = { id: string; titulo: string; descricao: string | null;
                 duracaoMinutos: number; preco: number | null }
type Profissional = { id: string; nome: string; especialidade: string | null }
```

- `is_active = true`. Serviços por `title`, profissionais por `name`.
- `duracaoMinutos`: `duration_minutes`, ou **30** se nulo/0 (é o fallback que
  todos os caminhos usam hoje).
- **Colunas explícitas.** Profissional nunca devolve `phone` nem
  `license_number`.
- ⚠️ **Achado AS-IS:** `app/marcar/[slug]/page.tsx` faz `select('*')` em
  `professionals` com o client anon e passa o resultado inteiro para um
  componente client. Se o grant de coluna permitir, telefone e registro do
  profissional vão parar no HTML público. A página passa a usar
  `listarProfissionaisAtivos`, e isso fecha o vazamento **pela página**.
  **Confirmado no banco em 2026-10-06:** `anon` tem SELECT em `phone`,
  `license_number` e `user_id` de `professionals`, e a policy
  `Public professionals are viewable by everyone` (`is_active = true`, sem
  filtro de org) libera as linhas. Ou seja, com a anon key (pública) dá para
  ler esses campos de **todos os tenants** via REST, sem passar pela página.
  O fechamento é uma migration de `REVOKE` de coluna, que **só pode ir depois
  do deploy deste passo**: o `select('*')` atual como anon quebraria com 42501
  (regra "código antes de migration que revoga").
- **Não existe vínculo serviço ↔ profissional.** Todo profissional ativo
  atende todo serviço. Não inventar.

## 4. `horarios.ts` — uma fonte só (C4)

Hoje há três caminhos que discordam:

| Caminho | Usado por | O que verifica |
|---|---|---|
| `getAvailableSlots` | página pública, `GET /api/v1/availability` | grade de `appointment_duration`, expediente org ∩ profissional, almoço, pausa, ocupação (`status <> canceled`). Testa a janela com a **duração da org**, não a do serviço. |
| `checkOrganizationBusinessHours` + `checkProfessionalAvailability` | criação no painel, público e API v1 | expediente e pausa, **sem ocupação** (fica para a constraint) |
| nada | remarcação no painel (`update-appointment.ts`) | **nenhuma validação** |

### O predicado único

```ts
type DiaDeAgenda = {          // carregado uma vez por (org, profissional, data)
  data: string
  passoMinutos: number          // organization_settings.appointment_duration || 30
  janelas: Array<[number, number]>   // expediente org ∩ profissional, em minutos do dia
  bloqueios: Array<[number, number]> // almoço da org + pausa do profissional
  ocupados: Array<[number, number]>  // agendamentos ATIVOS do profissional no dia
  motivoFechado: MotivoSemHorario | null
}

carregarDiaDeAgenda(db, { orgId, profissionalId, data, ignorarAgendamentoId? }): Promise<DiaDeAgenda>

/** null = livre. Senão, o motivo. É a ÚNICA função que decide se um intervalo cabe. */
avaliarIntervalo(dia: DiaDeAgenda, inicioMin: number, fimMin: number): MotivoSemHorario | null

type MotivoSemHorario =
  | "organizacao_fechada"      // dia fora de days_of_week
  | "profissional_sem_expediente"
  | "fora_do_expediente"
  | "intervalo"                // almoço ou pausa
  | "ocupado"
  | "antecedencia_minima"
  | "fora_da_grade"
  | "agenda_cheia"             // só em motivoVazio da listagem
```

Regras do `carregarDiaDeAgenda`, que mantêm o AS-IS de `getAvailableSlots`:

- O profissional precisa ser ativo e da org. Senão, `NOT_FOUND`.
- `days_of_week` vazio ou nulo = todos os dias abertos.
- Expediente = `[max(início org, início prof), min(fim org, fim prof))`.
  Org sem `open_hours_*` usa o do profissional. Sem `professional_availability`
  ativo no dia → `motivoFechado = "profissional_sem_expediente"`.
- **Ocupados = status ATIVOS** = `pending`, `scheduled`, `confirmed`,
  `arrived`. É o mesmo conjunto da exclusion constraint
  `appointments_professional_overlap_idx`. *(Muda o AS-IS, que usava
  `<> canceled` e contava `completed`/`no_show` como ocupado. Na prática só
  afeta horário passado.)*
- Busca de ocupados recortada por `limitesDoDiaUtc(data)` com
  `start_time < fim AND end_time > inicio`, para pegar agendamento que
  atravessa a meia-noite.
- `ignorarAgendamentoId` tira esse agendamento dos ocupados (remarcação para
  um horário que se sobrepõe ao atual).

### As duas funções públicas

```ts
listarHorariosLivres(db, p: {
  orgId: string; profissionalId: string; data: string
  duracaoMinutos: number          // DO SERVIÇO
  naoAntesDe?: Date               // omitido = sem corte
  ignorarAgendamentoId?: string
}): Promise<{ horarios: string[]; motivoVazio: MotivoSemHorario | null }>   // "HH:mm"

validarHorario(db, p: {
  orgId: string; profissionalId: string
  inicio: Date; duracaoMinutos: number
  naoAntesDe?: Date
  exigirGrade: boolean
  ignorarAgendamentoId?: string
}): Promise<void>   // ok, ou DomainError SLOT_UNAVAILABLE com detalhes { motivo, sugestoes }
```

- `listarHorariosLivres` percorre a grade (passo = `passoMinutos`, a partir do
  início de cada janela) e mantém os pontos em que
  `avaliarIntervalo(dia, t, t + duracaoMinutos) === null` e `t >= naoAntesDe`.
  **A janela testada tem a duração do serviço.** Corrige o caso do serviço de
  60 min oferecido às 11:30 com almoço às 12:00.
- `validarHorario` chama `avaliarIntervalo` para o intervalo pedido. Com
  `exigirGrade`, também exige que o início caia num ponto da grade
  (`fora_da_grade`). `detalhes.sugestoes` = até 3 horários de
  `listarHorariosLivres` no mesmo dia e profissional.
- **Agendamento que atravessa a meia-noite** não é suportado em nenhum canal
  (`fora_do_expediente`). Hoje também não é.

### Quem exige grade

| Canal | `exigirGrade` | `naoAntesDe` | Motivo |
|---|---|---|---|
| `painel` | não | **início do dia de hoje** (revisto em 2026-10-06, na revisão) | O tenant marca 14:10 se quiser e lança o encaixe que já começou ou o atendimento de mais cedo; é a agenda dele. Dia anterior é recusado. |
| `api` (B2B) | não | agora | A chave age como o tenant (mesmo poder do painel). |
| `publico` | sim | agora | Só aceita o que a página ofereceu. |
| `autoatendimento` | sim | agora + `antecedencia_minima_minutos` | Idem, mais a política do add-on. |

*(Recomendação deste contrato, decisão E1 abaixo.)*

Tanto o painel quanto a API passam a recusar horário passado, ocupado ou fora
do expediente na **remarcação**, que hoje não valida nada. É uma mudança de
comportamento **desejada**: registrar no CHANGELOG.

A exclusion constraint continua sendo a garantia final contra corrida:
`23P01` → `SLOT_UNAVAILABLE` "Este horário acabou de ser ocupado".

`getAvailableSlots` (action) continua existindo com a mesma assinatura e o
mesmo formato de retorno, como wrapper fino de `listarHorariosLivres`, porque o
form público a usa. Ganha um 4º parâmetro opcional `serviceId`; sem ele, usa
`appointment_duration` (comportamento antigo). O form público passa a enviar
o serviço escolhido.

## 5. `status.ts` — máquina de status (D4)

```ts
export const STATUS = ["pending","scheduled","confirmed","arrived","completed","canceled","no_show"] as const
export type Status = (typeof STATUS)[number]

export const ATIVOS: Status[]   = ["pending","scheduled","confirmed","arrived"]  // ocupam agenda
export const EDITAVEIS: Status[] = ["pending","scheduled","confirmed"]          // remarcar/editar
export const FINAIS: Status[]   = ["completed","canceled","no_show"]

export const TRANSICOES: Record<Status, Status[]> = {
  pending:   ["scheduled", "confirmed", "canceled"],
  scheduled: ["confirmed", "arrived", "completed", "no_show", "canceled"],
  confirmed: ["arrived", "completed", "no_show", "canceled"],
  arrived:   ["completed", "canceled"],
  completed: [],
  canceled:  [],
  no_show:   [],
}

export function podeTransicionar(de: Status, para: Status, inicio: Date, agora: Date): boolean
export function podeEditar(s: Status): boolean           // EDITAVEIS
export function podeReceberPagamento(s: Status): boolean // tudo menos canceled e no_show

export const METODOS_PAGAMENTO = ["dinheiro", "pix", "cartao_credito", "cartao_debito", "outro"] as const
// = appointments_payment_method_check no banco. O default 'Outros' de
// update-appointment-payment.ts viola o CHECK (achado da auditoria §2.3).

/** Para a UI: quais ações o painel mostra para este agendamento agora. */
export function acoesDisponiveis(a: { status: Status; inicio: Date; pagamento: string | null }, agora: Date): {
  confirmar: boolean; chegou: boolean; finalizar: boolean; faltou: boolean
  cancelar: boolean; editar: boolean; pagar: boolean
}
```

`acoesDisponiveis` é derivada **só** de `podeTransicionar` / `podeEditar` /
`podeReceberPagamento` (sem `if` próprio), com `pagar = podeReceberPagamento && pagamento !== "paid"`.

A regra, como o Sérgio ditou:

- **`completed` é final.** Depois dele só se registra **pagamento**. Nada de
  remarcar, trocar serviço ou profissional, mudar observação nem mudar status.
- **`no_show` é final e significa falta.** Para registrar presença, marca-se
  um **novo** agendamento. Não recebe pagamento (sem taxa de falta).
- **`canceled` é final.** Não recebe pagamento.
- `arrived` não vira `no_show`: quem chegou não faltou.
- **`→ no_show` só depois do horário de início** (`inicio <= agora`), em
  todos os canais (D11). Não se marca falta antecipada.
- **Pagamento antes de concluir (sinal, pré-pago) é permitido** em `pending`,
  `scheduled`, `confirmed` e `arrived` (D10, confirmado em 2026-10-06).

### Quem pode o quê, por canal

| Ação | painel | api | publico | autoatendimento |
|---|---|---|---|---|
| Criar | `scheduled` | `pending` \| `scheduled` \| `confirmed` | `pending` | `pending` (D8) |
| Qualquer transição da tabela | sim | sim | — | — |
| `scheduled → confirmed` (cliente diz "vou") | sim | sim | — | sim |
| `→ canceled` | sim | sim | — | sim, de `pending`/`scheduled`/`confirmed` |
| Remarcar | sim | sim | — | sim (volta a `pending`, ver 6.2) |
| Pagamento | sim | sim (escopo `payments`) | — | — |

O webhook do WhatsApp (resposta "confirmo"/"cancelar" ao lembrete) passa a
chamar `mudarStatus` com canal `whatsapp_webhook`, com o mesmo poder do
autoatendimento. Hoje ele faz `update` direto.

## 6. `agendamentos.ts`

```ts
type Canal = "painel" | "publico" | "api" | "autoatendimento" | "whatsapp_webhook"

type Ator = {
  canal: Canal
  organizationId: string
  /** vai para appointment_logs.source: "painel", "publico", "api:elz_live_ab12cd", "autoatendimento", "whatsapp_webhook" */
  origem: string
  /** null = não notifica. Função = notifica se devolver true (teto por org do público, D6 da API). */
  podeNotificar: null | (() => Promise<boolean>)
}
```

### 6.1 `criarAgendamento(db, ator, entrada)`

```ts
type EntradaCriacao = {
  cliente: { id: string } | NovoCliente
  profissionalId: string
  servicoId: string
  inicio: Date                    // já convertido por horaLocalParaUtc
  observacao?: string | null
  status: "pending" | "scheduled" | "confirmed"   // validado contra a tabela do §5
  pagamento?: { metodo: string | null; status: "pending" | "paid" }  // só painel; demais = pending/null
}
→ Promise<{ agendamento: AgendamentoCompleto; clienteCriado: boolean; notificado: boolean }>
```

Passos, na ordem:

1. `exigirServicoAtivo` e `exigirProfissionalAtivo` (ambos da org).
2. `fim = inicio + duracaoMinutos`. `validarHorario` com `exigirGrade` e
   `naoAntesDe` do §4.
3. `resolverCliente` (§7). `clienteCriado` diz se o cadastro nasceu agora.
4. `insert` com `price = servico.preco ?? 0`, `payment_status` e
   `payment_method` de `entrada.pagamento` (ou `pending`/`null`).
   `23P01` → `SLOT_UNAVAILABLE`.
5. Log `action = "created"`, `source = ator.origem`. *(Novo para o painel e o
   público, que hoje não logam a criação.)*
6. Se `ator.podeNotificar` e ele devolver `true`, e o cliente tiver telefone:
   mensagem de `mensagens.ts` (template `msg_appointment_pending` se
   `status = pending`, senão `msg_appointment_created`, com o fallback atual).
   Falha no envio **não** desfaz o agendamento: só log.

`AgendamentoCompleto` tem o shape de `serializeAppointment` de
`lib/api/domain/appointments.ts` (que vira a fonte), com `inicio`/`fim` como
`Momento`.

### 6.2 `editarAgendamento(db, ator, id, entrada)`

Cobre a remarcação e a edição do painel e da API, que hoje são
`update-appointment.ts` e `rescheduleAppointment`.

```ts
type EntradaEdicao = {
  inicio?: Date; profissionalId?: string; servicoId?: string; observacao?: string | null
}
```

1. Carregar por `id` **e** org (senão `NOT_FOUND`). Status fora de
   `EDITAVEIS` → `INVALID_TRANSITION` "Agendamento <status> não pode ser
   alterado".
2. Serviço e profissional efetivos (o novo ou o atual) ativos e da org.
3. Se mudou início, profissional ou duração: `validarHorario` com
   `ignorarAgendamentoId = id`, zerar `reminder_sent_at` e
   `reminder_morning_sent_at`.
4. Canal `autoatendimento`: o serviço não muda e o status volta a `pending`
   (o "confirmado" valia para o horário antigo, D8). Nos outros canais o
   status não muda.
5. `update` com `updated_at`. `23P01` → `SLOT_UNAVAILABLE`.
6. Log `rescheduled` com `raw_message = "<local antigo> -> <local novo>"` se
   mudou horário; senão `updated`.
7. Notifica (texto atual de "foi *alterado*") só se mudou horário e
   `podeNotificar` deixar. *(Painel: hoje notifica sempre; continua
   notificando, mas só quando o horário muda.)*

### 6.3 `mudarStatus(db, ator, id, para, opcoes?: { motivo?: string })`

1. Carregar (id + org). `para === atual` → devolve sem escrever nem logar
   (idempotente).
2. `podeTransicionar` e a tabela de canal do §5. Senão, `INVALID_TRANSITION`
   "Não é possível mudar de <rótulo> para <rótulo>". Os rótulos vêm de
   `STATUS_CONFIG`.
3. `update status, updated_at` **condicionado ao status lido**
   (`.eq("status", atual)`). Se 0 linhas forem afetadas, alguém mudou o
   agendamento entre a leitura e a escrita: `INVALID_TRANSITION` "O
   agendamento foi alterado por outra pessoa; atualize a tela". Fecha a
   corrida apontada pela auditoria (§4, webhook × painel).
4. Log `action = <para>` (mesmo vocabulário do webhook atual), `raw_message = motivo`.
5. Notifica só em `canceled` e `confirmed`, com os textos atuais.

**Toda escrita do domínio** (6.2, 6.3, 6.4) usa a mesma condição de
concorrência: `update ... where id and organization_id and status = <lido>`.

### 6.4 `registrarPagamento(db, ator, id, { metodo, status })`

`metodo ∈ METODOS_PAGAMENTO`; `status ∈ pending | paid | partially_paid | refunded`
(os dois são CHECK do banco).

1. Carregar (id + org). `!podeReceberPagamento(status)` → `INVALID_TRANSITION`
   "Agendamento <rótulo> não recebe pagamento".
2. Já está `paid` e o pedido é `paid` → devolve sem escrever (idempotente;
   hoje repagar sobrescreve `paid_at`).
3. `paid_at = now()` se `paid`; `null` se `pending`; mantém nos demais.
4. Log `action = "payment:<status>"`, `raw_message = metodo`.

### 6.5 Exclusão

O domínio **não** exporta exclusão (D5).
`delete-appointment.ts` exporta `deleteAppointment` (DELETE físico), que
**nenhum componente importa**, mas que, por ser `'use server'`, é um endpoint
público para usuário logado. **Remover o export.** O `cancelAppointment`
duplicado do mesmo arquivo é unificado com `cancel-appointment.ts` (ver §8).

## 7. `clientes.ts`

```ts
type NovoCliente = { nome: string; telefone: string; documento?: string | null;
                     dataNascimento?: string | null; genero?: string | null; email?: string | null }

buscarPorTelefone(db, orgId, telefone): Promise<ClienteResumo[]>  // phone_normalized IN brPhoneVariants, deleted_at IS NULL
resolverCliente(db, orgId, entrada: { id: string } | NovoCliente,
                opcoes: { exigirDocumento: boolean }): Promise<{ id: string; criado: boolean }>
```

`resolverCliente`:

- `{ id }` → existir na org e `deleted_at is null`; senão `NOT_FOUND`.
- `NovoCliente` → procura por `phone_normalized IN brPhoneVariants(telefone)`
  **ou** `document_normalized = <documento normalizado>`:
  - 0 → cria;
  - 1 → **reusa sem sobrescrever nada**;
  - 2+ → `CUSTOMER_AMBIGUOUS` "Há mais de um cadastro com esses dados; informe o cliente".

**Corrige um bug AS-IS de três lugares** (painel, público, API v1): hoje a
busca é `phone.eq.<dígitos>`, que não casa `11987654321` com `5511987654321`
nem a forma sem o 9º dígito. O resultado é cadastro duplicado. No painel e no
público, dois cadastros casando faziam `.maybeSingle()` estourar com "Erro ao
verificar cadastro".

`exigirDocumento`: painel e público `true` (AS-IS), api `false` (AS-IS da v1),
autoatendimento segue o contrato 05. O telefone é gravado como cada canal
grava hoje: o público com `55` na frente, os demais como vierem, só dígitos.

## 8. Quem passa a chamar o quê

Fonte: este contrato + [`docs/AUDITORIA_STATUS_PAINEL.md`](../../AUDITORIA_STATUS_PAINEL.md)
(conferência de 2026-10-06, que lista arquivo:linha de cada violação).

### 8.1 Server actions e automação

| Hoje | Passa a chamar | Violação que fecha (auditoria) |
|---|---|---|
| `actions/create-appointment.ts` (`createAppointment`, `createPublicAppointment`) | `criarAgendamento`. As actions continuam: autenticam, montam `Ator`, convertem `FormData`, aplicam o rate limit do público e revalidam. | §2.7: `payment_status` do form deixava criar já pago; passa a ser `entrada.pagamento` validado (`metodo` no enum) |
| `actions/update-appointment.ts` | `editarAgendamento` (org pela sessão) | §2.2: edita `arrived`/`completed`/`canceled` |
| `actions/update-appointment-status.ts` | `mudarStatus` | §2.1: qualquer string, de qualquer status |
| `actions/update-appointment-payment.ts` | `registrarPagamento` (`status: "paid"`, `metodo` obrigatório) | §2.3: paga `canceled`; default `'Outros'` viola o CHECK |
| `actions/cancel-appointment.ts` + `cancelAppointment` de `actions/delete-appointment.ts` | **uma** action `cancelAppointment` (fica em `cancel-appointment.ts`) → `mudarStatus(canceled)`. Importadores do outro arquivo passam a usar esta. | §2.4/§2.5: cancela `completed` pago (some a receita) e reenvia WhatsApp em `canceled` |
| `deleteAppointment` de `actions/delete-appointment.ts` | **removido** (§6.5) | §2.5: DELETE físico por chamada direta |
| `actions/handle-appointment-request.ts` | `mudarStatus` (`confirmed` \| `canceled`) | §2.6: confirma/cancela de qualquer status; corrida com o dashboard |
| `actions/get-available-slots.ts` | `listarHorariosLivres` | — |
| `app/marcar/[slug]/page.tsx` | `listarServicosAtivos` / `listarProfissionaisAtivos` | colunas de profissional (§3) |
| webhook WhatsApp `route.ts:356-401` | `mudarStatus` com canal `whatsapp_webhook` | §4: escrita sem condição de status |
| `actions/get-financial-summary.ts:47-57` ("a prazo") | Sem chamada ao domínio, mas o filtro passa a ser: `status ∈ {scheduled, confirmed, arrived, completed}` e não pago | §3.5: somava `pending` e `no_show` como receita esperada |
| `lib/api/domain/appointments.ts`, `lib/api/tempo.ts` | **apagados**. As rotas v1 chamam o domínio. | §5: `arrived → no_show` permitido; DELETE exposto |
| `checkOrganizationBusinessHours` / `checkProfessionalAvailability` (`lib/appointment-config.ts`) | Removidos após a migração. `STATUS_CONFIG` fica (ganha `no_show: "Faltou"`). | — |

### 8.2 Componentes do painel

Nenhum componente decide ação por `if` próprio de status: todos perguntam a
`acoesDisponiveis` (§5).

| Componente | Mudança | Violação que fecha |
|---|---|---|
| `components/appointments/appointment-card-actions.tsx:132-221` | Itens por `acoesDisponiveis`. **Novo item "Faltou"** (`→ no_show`), visível em `scheduled`/`confirmed` só depois do horário de início (D11). | §3.1: `pending → arrived/completed`, `arrived → confirmed`, `no_show` reaberto |
| `components/appointments/appointment-context-menu.tsx:124-187` | Idem, incluindo "Faltou" | §3.2 |
| `components/appointments/calendar-view.tsx:342-358` | **Remover a escrita direta** pelo client do navegador (`supabase.from("appointments").update`) e o ramo `"finalized"`. O menu já grava pela action; o calendário só recarrega. | §3.3: segunda escrita via PostgREST |
| `components/appointments/calendar-view.tsx:315-319` | Clique no card abre edição só se `acoesDisponiveis.editar`; senão abre em modo leitura (ou não abre) | §3.3 / §2.2 pela UI |
| `components/appointments/update-appointment-dialog.tsx` (form `:202`, lixeira `:276-281`) | Form desabilitado se `!editar`; lixeira só se `cancelar` | §3.4 |
| `components/dashboard/financial-cards.tsx:293` ("Baixar") | Só se `acoesDisponiveis.pagar` | §3.5 |
| `components/appointments/payment-menu.tsx` | **Remover** (não é usado) | §3.6 |
| `app/(app)/dashboard/page.tsx:160` | `"cancelled"` → `"canceled"` | §3.7 (cosmético) |

### 8.3 Banco: revogar escrita do `authenticated` (D9)

A máquina de status em TS não vale nada enquanto a policy `Org access
appointments` (`ALL`, `organization_id = get_user_org_id()`) deixar qualquer
membro da org fazer `PATCH`/`DELETE /rest/v1/appointments` com o próprio JWT
(auditoria §1). Decisão D9: **usuário logado só lê**; toda escrita passa por
server action → domínio (service role).

Migration `supabase/migrations/<timestamp>_appointments_readonly_for_authenticated.sql`:

```sql
begin;
drop policy if exists "Org access appointments" on public.appointments;
create policy "Org members read appointments" on public.appointments
  for select to authenticated
  using (organization_id = public.get_user_org_id());
revoke insert, update, delete on public.appointments from anon, authenticated;
commit;
```

- Antes de escrever a migration, **conferir no catálogo** se há outra
  policy em `appointments` (a auditoria viu uma só; a anon foi dropada em
  2026-08-11) e se algum caminho ainda faz `insert` como `authenticated`.
  O grep de 2026-10-06 achou só `calendar-view.tsx:346` escrevendo pelo
  navegador.
- ⚠️ **Ordem obrigatória: código antes da migration.** Hoje
  `update-appointment*.ts`, `cancel-appointment.ts`, `delete-appointment.ts` e
  `handle-appointment-request.ts` escrevem com o client de sessão
  (`authenticated`). Com o revoke antes do deploy, todas quebram com 42501.
  A migration só roda depois que o passo 4 do §10 estiver **em produção**.
- `appointment_logs`: conferir os grants. Se `authenticated` puder inserir,
  revogar também, porque o log passa a ser escrito só pelo domínio.

**Autorização nas actions do painel**: hoje `update-appointment*.ts` usa o
client de sessão e o RLS escopa a org. Com o domínio rodando em service role,
a action resolve `organizationId` pelo perfil da sessão (mesmo padrão de
`createAppointment`, linhas 142–173) e passa ao domínio, que filtra por ela.
Papéis: igual a hoje, qualquer membro da org. Não muda permissão nesta etapa.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| E1 | Painel e API aceitam horário fora da grade (dentro do expediente e livre). Público e autoatendimento exigem grade. | Grade obrigatória em tudo | O painel já aceita horário livre hoje, e o tenant é dono da agenda. A grade só protege canais de terceiros. |
| E2 | Um predicado só (`avaliarIntervalo`) para listar e para validar | Manter `check*` separados | É a C4: o que a lista ofereceu, a validação aceita. |
| E3 | Ocupado = status ativos (os da constraint) | `<> canceled` | Uma definição só de "ocupa agenda". |
| E4 | Toda escrita loga em `appointment_logs` com `source` = origem | Logar só API/bot | A auditoria passa a cobrir o painel. Custa uma linha por ação. |
| E5 | Domínio recebe `organizationId` pronto e roda em service role | Domínio com client de sessão | Funciona igual para os 4 canais. O custo é que toda query precisa do filtro de org, e isso entra no Aceite. |
| E6 | Escrita condicionada ao status lido (`.eq("status", atual)`) | Ler e gravar sem condição (AS-IS) | Fecha a corrida webhook × painel × API sem lock nem tabela. |
| E7 | UI pergunta a `acoesDisponiveis`; nenhum `if` de status em componente | Corrigir os `if` de cada menu | Os três menus já divergiam entre si; uma função pura não diverge. |

## 10. Ordem de execução

Cada passo termina com o app funcionando para painel, página pública e API v1.

1. `erros.ts`, `tempo.ts`, `catalogo.ts`. Trocar as quatro cópias de fuso e a
   página pública. `lib/api/tempo.ts` sai.
   **Deploy deste passo** libera a migration de `REVOKE` de colunas de
   `professionals` para `anon` (§3), que entra logo em seguida.
2. `horarios.ts` + wrapper `getAvailableSlots` + `GET /api/v1/availability`
   (a rota perde o filtro próprio de duração e chama `listarHorariosLivres`).
2b. `tempo.ts` sem `server-only` (e `erros.ts` também, porque `tempo.ts` o
   importa); trocar o `-03:00` de `lib/utils.ts` (`SAO_PAULO_UTC_OFFSET`) e de
   `app/(app)/dashboard/page.tsx` por `limitesDoDiaUtc` / `diaDaSemanaLocal`.
   Depois disso, `-03:00` dá zero no grep.
3. `status.ts` (com `acoesDisponiveis` e `no_show` em `STATUS_CONFIG`),
   `clientes.ts`, `mensagens.ts`, `agendamentos.ts`.
4. Apontar as actions e a automação do §8.1, uma por commit: criar → editar →
   status → cancelar (unificado) → pedido pendente → pagamento → webhook →
   "a prazo" do financeiro. Remover `deleteAppointment`.
5. Componentes do §8.2, incluindo o item "Faltou" e a remoção da escrita
   direta em `calendar-view.tsx`.
6. Apontar as rotas v1 e apagar `lib/api/domain/`.
7. Relatório em `docs/RELATORIO_DOMINIO.md` com o resultado do Aceite.
8. **Depois do deploy de 1–6 em produção:** migration do §8.3 (D9).

## Aceite

Grep (rodar em `web/`, fora de `lib/domain/` e `node_modules`):

- [ ] `from("appointments")` / `from('appointments')` seguido de `.insert(`, `.update(` ou `.delete(` → zero ocorrências, exceto no cron de lembretes (que só marca `reminder_*_sent_at`), em `lib/demo/` (seed e limpeza) e em `create-demo-timeline.ts`.
- [ ] Nenhum componente `"use client"` escreve em `appointments`.
- [ ] Nenhum componente compara `status ===` para decidir ação (só `acoesDisponiveis`); rótulo e cor continuam por `STATUS_CONFIG`.
- [ ] `deleteAppointment` e `payment-menu.tsx` não existem mais.
- [ ] `America/Sao_Paulo` aparece só em `lib/domain/tempo.ts` e em formatação de exibição (`toLocaleString` de componente).
- [ ] `-03:00` → zero ocorrências.
- [ ] Nenhum arquivo de `lib/domain/` contém `'use server'`.
- [ ] Toda query em `lib/domain/` sobre tabela com `organization_id` filtra por ele.

Comportamento (browser + curl):

- [ ] Painel: criar, remarcar, chegou, finalizar e pagar funcionam como antes. Cada ação gera uma linha em `appointment_logs` com `source='painel'`.
- [ ] Painel: tentar mudar um `completed` para `scheduled` (chamando a action direto) → erro, sem alterar.
- [ ] Painel: remarcar para cima de outro agendamento → erro "ocupado"; antes passava até a constraint.
- [ ] Painel: pagar um `no_show` → erro; pagar um `scheduled` (sinal) → ok; pagar duas vezes → a 2ª não muda `paid_at`.
- [ ] Menus (card, clique direito, ficha do cliente) para cada status mostram exatamente as ações da tabela do §5: `pending` sem Chegada/Finalizar; `arrived` sem Confirmar; `completed` só Pagar; `canceled`/`no_show` nada (exceto Pagar, que também some neles).
- [ ] "Faltou" aparece em `scheduled`/`confirmed` só depois do horário; marcar falta antes do horário pela action direta → erro.
- [ ] Cancelar um `completed` pela action direta → erro; a receita continua no financeiro.
- [ ] Clique num card `completed` não abre o formulário de edição editável.
- [ ] Finanças "a prazo" não conta `pending`, `canceled` nem `no_show`.
- [ ] Duas abas: aba A finaliza, aba B (desatualizada) tenta "Chegada" → erro "alterado por outra pessoa", sem sobrescrever.
- [ ] Público: mesmos serviços/profissionais; serviço de 60 min com almoço 12–13 → 11:30 não aparece, 11:00 aparece; horários passados de hoje não aparecem.
- [ ] Público: cliente cadastrado no painel como `11987654321` agenda pelo público com `(11) 98765-4321` → reusa o cadastro (não duplica).
- [ ] HTML de `/marcar/<slug>` não contém telefone nem registro de profissional.
- [ ] API v1: `availability` e `POST /appointments` concordam: todo horário listado é aceito, e um horário ocupado é recusado com `sugestoes`.
- [ ] Webhook: resposta "confirmo" a um `completed` não muda nada.

Depois da migration do §8.3 (D9):

- [ ] `PATCH /rest/v1/appointments?id=eq.<id>` com JWT de membro da org → 401/403 (42501), sem alterar.
- [ ] `DELETE` idem.
- [ ] Painel continua criando, editando, mudando status e pagando normalmente.
