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

- Todo arquivo começa com `import "server-only"`. **Nenhum** tem `'use server'`:
  server action vira endpoint POST público (lição de `send-whatsapp.ts`).
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
| `painel` | não | agora | O tenant marca 14:10 se quiser; é a agenda dele. |
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

export function podeTransicionar(de: Status, para: Status): boolean
export function podeEditar(s: Status): boolean           // EDITAVEIS
export function podeReceberPagamento(s: Status): boolean // tudo menos canceled e no_show
```

A regra, como o Sérgio ditou:

- **`completed` é final.** Depois dele só se registra **pagamento**. Nada de
  remarcar, trocar serviço ou profissional, mudar observação nem mudar status.
- **`no_show` é final e significa falta.** Para registrar presença, marca-se
  um **novo** agendamento. Não recebe pagamento (sem taxa de falta).
- **`canceled` é final.** Não recebe pagamento.
- `arrived` não vira `no_show`: quem chegou não faltou.
- Pagamento antes de concluir (sinal, pré-pago) é permitido em qualquer status
  ativo.

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
3. `update status, updated_at`. Log `action = <para>` (mesmo vocabulário do
   webhook atual), `raw_message = motivo`.
4. Notifica só em `canceled` e `confirmed`, com os textos atuais.

### 6.4 `registrarPagamento(db, ator, id, { metodo, status })`

`status ∈ pending | paid | partially_paid | refunded` (CHECK do banco).

1. Carregar (id + org). `!podeReceberPagamento(status)` → `INVALID_TRANSITION`
   "Agendamento <rótulo> não recebe pagamento".
2. `paid_at = now()` se `paid`; `null` se `pending`; mantém nos demais.
3. Log `action = "payment:<status>"`, `raw_message = metodo`.

### 6.5 Exclusão

O domínio **não** exporta exclusão. `delete-appointment.ts` (painel) continua
como está e fica fora deste contrato. A API não exclui (D5).

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

| Hoje | Passa a chamar |
|---|---|
| `actions/create-appointment.ts` (`createAppointment`, `createPublicAppointment`) | `criarAgendamento`. As actions continuam: autenticam, montam `Ator`, convertem `FormData`, aplicam o rate limit do público e revalidam. |
| `actions/update-appointment.ts` | `editarAgendamento` (org pela sessão, como em `createAppointment`) |
| `actions/update-appointment-status.ts` | `mudarStatus`. ⚠️ Hoje grava **qualquer** string sem olhar o status atual. |
| `actions/update-appointment-payment.ts` | `registrarPagamento` com `status: "paid"` |
| `actions/get-available-slots.ts` | `listarHorariosLivres` |
| `app/marcar/[slug]/page.tsx` | `listarServicosAtivos` / `listarProfissionaisAtivos` |
| webhook WhatsApp (troca de status) | `mudarStatus` com canal `whatsapp_webhook` |
| `lib/api/domain/appointments.ts`, `lib/api/tempo.ts` | **apagados**. As rotas v1 chamam o domínio. |
| `checkOrganizationBusinessHours` / `checkProfessionalAvailability` (`lib/appointment-config.ts`) | Removidos após a migração. `STATUS_CONFIG` fica. |

**Autorização nas actions do painel**: hoje `update-appointment*.ts` usa o
client de sessão e o RLS escopa a org. Com o domínio rodando em service role,
a action resolve `organizationId` pelo perfil da sessão (mesmo padrão de
`createAppointment`, linhas 142–173) e passa ao domínio, que filtra por ela.
Papéis: igual a hoje, qualquer membro da org. Não muda permissão nesta etapa.

Achado da conferência paralela (`docs/AUDITORIA_STATUS_PAINEL.md`, quando
existir): todo ponto de chamada listado lá entra nesta tabela antes de
executar.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| E1 | Painel e API aceitam horário fora da grade (dentro do expediente e livre). Público e autoatendimento exigem grade. | Grade obrigatória em tudo | O painel já aceita horário livre hoje, e o tenant é dono da agenda. A grade só protege canais de terceiros. |
| E2 | Um predicado só (`avaliarIntervalo`) para listar e para validar | Manter `check*` separados | É a C4: o que a lista ofereceu, a validação aceita. |
| E3 | Ocupado = status ativos (os da constraint) | `<> canceled` | Uma definição só de "ocupa agenda". |
| E4 | Toda escrita loga em `appointment_logs` com `source` = origem | Logar só API/bot | A auditoria passa a cobrir o painel. Custa uma linha por ação. |
| E5 | Domínio recebe `organizationId` pronto e roda em service role | Domínio com client de sessão | Funciona igual para os 4 canais. O custo é que toda query precisa do filtro de org, e isso entra no Aceite. |

## 10. Ordem de execução

Cada passo termina com o app funcionando para painel, página pública e API v1.

1. `erros.ts`, `tempo.ts`, `catalogo.ts`. Trocar as quatro cópias de fuso e a
   página pública. `lib/api/tempo.ts` sai.
2. `horarios.ts` + wrapper `getAvailableSlots` + `GET /api/v1/availability`
   (a rota perde o filtro próprio de duração e chama `listarHorariosLivres`).
3. `status.ts`, `clientes.ts`, `mensagens.ts`, `agendamentos.ts`.
4. Apontar as actions do §8, uma por commit: criar → editar → status →
   pagamento → webhook.
5. Apontar as rotas v1 e apagar `lib/api/domain/`.
6. Relatório em `docs/RELATORIO_DOMINIO.md` com o resultado do Aceite.

Não há migration nesta etapa.

## Aceite

Grep (rodar em `web/`, fora de `lib/domain/` e `node_modules`):

- [ ] `from("appointments")` / `from('appointments')` seguido de `.insert(` ou `.update(` → zero ocorrências, exceto em `delete-appointment.ts` e no cron de lembretes (que só marca `reminder_*_sent_at`).
- [ ] `America/Sao_Paulo` aparece só em `lib/domain/tempo.ts` e em formatação de exibição (`toLocaleString` de componente).
- [ ] `-03:00` → zero ocorrências.
- [ ] Nenhum arquivo de `lib/domain/` contém `'use server'`.
- [ ] Toda query em `lib/domain/` sobre tabela com `organization_id` filtra por ele.

Comportamento (browser + curl):

- [ ] Painel: criar, remarcar, chegou, finalizar e pagar funcionam como antes. Cada ação gera uma linha em `appointment_logs` com `source='painel'`.
- [ ] Painel: tentar mudar um `completed` para `scheduled` (chamando a action direto) → erro, sem alterar.
- [ ] Painel: remarcar para cima de outro agendamento → erro "ocupado"; antes passava até a constraint.
- [ ] Painel: pagar um `no_show` → erro.
- [ ] Público: mesmos serviços/profissionais; serviço de 60 min com almoço 12–13 → 11:30 não aparece, 11:00 aparece; horários passados de hoje não aparecem.
- [ ] Público: cliente cadastrado no painel como `11987654321` agenda pelo público com `(11) 98765-4321` → reusa o cadastro (não duplica).
- [ ] HTML de `/marcar/<slug>` não contém telefone nem registro de profissional.
- [ ] API v1: `availability` e `POST /appointments` concordam: todo horário listado é aceito, e um horário ocupado é recusado com `sugestoes`.
- [ ] Webhook: resposta "confirmo" a um `completed` não muda nada.
