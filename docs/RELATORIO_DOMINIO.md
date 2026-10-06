# Relatório — Domínio compartilhado (`web/lib/domain/`)

Contrato: [contratos/00-dominio/README.md](contratos/00-dominio/README.md).

## Etapa 1 (passos 1–2)

Escopo: §10 passos 1 e 2 do 00-dominio (erros, tempo, catálogo, horários). Branch
`development`, sem push. Sem migration.

### O que foi feito

**Passo 1** (commit `refactor(domain): erros, tempo e catalogo ...`)

- `web/lib/domain/erros.ts` (`DomainError`), `tempo.ts` (fuso, conversões, limites do dia),
  `catalogo.ts` (serviços e profissionais ativos, colunas explícitas) e `db.ts` (só o tipo `Db`).
- As quatro cópias de fuso viraram `lib/domain/tempo.ts`: `create-appointment.ts`,
  `update-appointment.ts`, `lib/api/tempo.ts` (apagado) e o `-03:00` fixo de
  `get-available-slots.ts`. `lib/api/domain/appointments.ts` importa `utcParaHoraLocal`.
- As rotas v1 usam `parseApiDateTime` de `lib/api/http.ts` (wrapper de
  `horaLocalParaUtc` que converte `DomainError VALIDATION_ERROR` em `ApiError` 422 com a mesma
  mensagem de antes) e `limitesDoDiaUtc`.
- `app/marcar/[slug]/page.tsx` usa `listarServicosAtivos` / `listarProfissionaisAtivos` com
  `createAdminClient()` (service role) e a org resolvida pelo slug. `PublicBookingForm` passou a
  receber `Servico[]` / `Profissional[]` (`titulo`, `preco`, `nome`).

**Passo 2**

- `web/lib/domain/horarios.ts`: `carregarDiaDeAgenda`, `avaliarIntervalo` (único predicado),
  `listarHorariosLivres`, `validarHorario`.
- `app/actions/get-available-slots.ts` virou wrapper fino (mesma assinatura e mesmo formato de
  retorno, 4º parâmetro opcional `serviceId`). O form público envia o serviço escolhido e refaz a
  busca ao trocá-lo.
- `GET /api/v1/availability` exige `service_id` (`AvailabilityQuery` de
  `contracts/api-v1/catalogo.ts`, `.strict()`), chama `listarHorariosLivres` com
  `naoAntesDe = agora` e responde no formato `Availability` + `AvailabilityMeta`. O filtro próprio
  de duração e de passado da rota foi apagado.
- `docs/CHANGELOG.md` com as mudanças de comportamento.

### Arquivos

Criados: `web/lib/domain/{erros,db,tempo,catalogo,horarios}.ts`.
Alterados: `web/app/actions/{create-appointment,update-appointment,get-available-slots}.ts`,
`web/app/api/v1/appointments/route.ts`, `web/app/api/v1/appointments/[id]/route.ts`,
`web/app/api/v1/availability/route.ts`, `web/app/marcar/[slug]/{page,public-booking-form}.tsx`,
`web/lib/api/http.ts`, `web/lib/api/domain/appointments.ts`, `docs/CHANGELOG.md`.
Removido: `web/lib/api/tempo.ts`.

### Verificação

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p .` antes de mexer | limpo (zero erros) |
| `npx tsc --noEmit -p .` depois (nos dois commits) | limpo (zero erros) |
| `npm run lint` nos arquivos tocados | `lib/domain`, `lib/api`, `app/api/v1`, `get-available-slots.ts`, `page.tsx`: limpo. `create-appointment.ts` tem 2 `no-explicit-any` e 1 `unused-var` (linhas que não foram tocadas, já existiam); `public-booking-form.tsx` tem 4 warnings antigos (imports e vars sem uso, `<img>`) |
| `npm run build` | passou; `/marcar/[slug]` e `/api/v1/availability` compilam como dinâmicas |
| `grep -- "-03:00"` em `web/` | **4 ocorrências restantes, fora do escopo**: `app/(app)/dashboard/page.tsx:50,51,64` e `lib/utils.ts:14` (`SAO_PAULO_UTC_OFFSET`, usado em `getFinancialMonthRange`). Ver divergência 1 |
| `grep America/Sao_Paulo` | `lib/domain/tempo.ts` + exibição, **mais** usos de lógica fora do domínio. Ver divergência 1 |
| `'use server'` em `lib/domain/` | zero |
| `import "server-only"` em todo arquivo de `lib/domain/` | sim (`status.ts` ainda não existe) |
| Toda query de `lib/domain/` filtra `organization_id` | sim. Exceção natural: `professional_availability` não tem a coluna; é lida por `professional_id` depois que `exigirProfissionalAtivo` validou o vínculo com a org |

**Prova do Aceite de horários** (script descartável fora do repo: transpila
`lib/domain/*.ts` com o `typescript` do projeto e roda com um `db` falso que devolve
settings, expediente e agendamentos fixos). 26 casos passaram, entre eles:

- Org passo 30, expediente 08–18, almoço 12–13, serviço de 60 min: **11:00 aparece, 11:30 não**,
  12:00 e 12:30 não, 13:00 sim, 17:00 sim e 17:30 não (estouraria o expediente).
- Sem `duracaoMinutos` (wrapper sem serviço): 11:30 aparece (comportamento antigo).
- Agendamento 14–15 e serviço de 60 min: 13:30, 14:00 e 14:30 somem; 13:00 e 15:00 ficam.
- **C4:** para cada horário de 07:00 a 19:00 (passo 30), `validarHorario(exigirGrade: true)`
  aceita se e somente se `listarHorariosLivres` oferece.
- `fora_da_grade` só com `exigirGrade`; `detalhes.sugestoes` com até 3 itens; `ocupado` com
  sugestões `["13:00","15:00","15:30"]` para o pedido de 14:00.
- `naoAntesDe` corta o passado; tudo no passado dá `antecedencia_minima`; domingo dá
  `organizacao_fechada`; sem expediente do profissional; serviço maior que o expediente dá
  `fora_do_expediente`; lotado dá `agenda_cheia`; agendamento que entra de ontem ocupa só até
  09:00 (corte na borda do dia); org sem `open_hours_*` usa o do profissional; pausa do
  profissional; profissional de outro tenant dá `NOT_FOUND`.
- `tempo`: `14:30` local = `17:30Z`; ISO com `Z` passa; `2026-02-30T10:00` e `T25:00` recusados com
  `VALIDATION_ERROR` e o nome do campo na mensagem; limites do dia `03:00Z`–`03:00Z`.

O que o `db` falso **não** prova: filtros reais do PostgREST (`.lt/.gt/.in/.neq`) e
`ignorarAgendamentoId` (só se confirma que é aceito). Isso fica para o browser/curl.

### Divergências entre contrato e código

1. **"Quatro cópias" de fuso é incompleto.** Fora as quatro do contrato, ainda há `-03:00` em
   `app/(app)/dashboard/page.tsx` (`getBrazilDayBounds`, `formatShortDayLabel`) e em
   `lib/utils.ts` (`SAO_PAULO_UTC_OFFSET`, usado pelo financeiro). `lib/utils.ts` é importado por
   componentes client, então não pode importar `lib/domain/tempo.ts` (`server-only`). Não mexi: são
   painel/financeiro, fora do escopo desta etapa. Para o grep do Aceite chegar a zero, precisam de
   decisão (por exemplo, uma função pura de fuso sem `server-only`, ou `limitesDoDiaUtc` no
   dashboard). Também usam `America/Sao_Paulo` com lógica (não só exibição):
   `app/api/cron/reminders.ts`, `lib/appointment-config.ts` (`check*`, que o contrato manda remover
   depois), `app/actions/demo/get-appointment-defaults.ts` (cópia própria de data/hora de SP),
   `lib/demo/seed.ts`, `app/actions/demo/create-demo-timeline.ts`.
2. **`/marcar/[slug]` precisa de service role.** O contrato já prevê (o domínio recebe service
   role), mas isso muda o client da página: serviços e profissionais passam a ser lidos sem RLS,
   filtrados por `organization_id`. A org continua resolvida com o client de sessão (anon) pelo
   slug. A migration de `REVOKE` de colunas de `professionals` para `anon` agora pode ir (depois do
   deploy deste passo).
3. **`/api/v1/professionals` e `/api/v1/services`** (rotas v1) ainda fazem a própria query e não
   usam `catalogo.ts`. Contrato os cobre no passo 6 / api-v1; não toquei.
4. **`get-appointment-defaults.ts`** (demo) chama `getAvailableSlots` sem `serviceId`; continua
   funcionando (agora também sem horário passado), mas usa a duração do passo, não a do serviço.

### Decisões que não estavam no contrato

- **`lib/domain/db.ts`** (só o tipo `Db = SupabaseClient<Database>`). O contrato cita `db: Db` mas
  não diz onde mora o tipo; `lib/api/handler.ts` já exporta um igual, mas o domínio não deve
  depender da API.
- **`horaLocalParaUtc(valor, campo = "start_time")`**: 2º parâmetro opcional só para a mensagem de
  erro citar o campo (a API usa `from`, `to`, `start_time`, `slot`), mantendo a mensagem 422 de
  antes. O DomainError→422 fica em `parseApiDateTime` (`lib/api/http.ts`), compartilhado pelas
  três rotas.
- **Validação de faixa em `horaLocalParaUtc`**: 30/02 ou 25:00 eram aceitos e "rolavam" para
  outro dia; agora voltam `VALIDATION_ERROR` (checagem por ida e volta). Mais estrito que o
  AS-IS. `updateAppointment` captura o erro e devolve `{ error: "Horário do agendamento inválido." }`
  (antes lançava `Error` sem tratamento), igual ao `createAppointment`.
- **`listarHorariosLivres`**: `duracaoMinutos` é opcional (omitido = passo da organização), para o
  wrapper sem `serviceId` manter o comportamento antigo; o retorno ganhou `passoMinutos`, que a API
  expõe em `meta.grid_step_minutes`. O contrato tem `duracaoMinutos` obrigatório e retorno só com
  `horarios` e `motivoVazio`.
- **`motivoVazio` na listagem** (o contrato só cita `agenda_cheia`): `fora_do_expediente` se
  nenhum ponto da grade comporta o serviço; `antecedencia_minima` se só o relógio cortou;
  `agenda_cheia` no resto (almoço, pausa e ocupação não são distinguidos); motivo do dia fechado
  quando é o caso.
- **Sugestões do `validarHorario`**: até 3, as **mais próximas** do horário pedido (em ordem
  crescente), em vez dos 3 primeiros do dia, que seriam inúteis para um pedido de fim de tarde.
- **`>=`** em `naoAntesDe` (horário igual ao corte é aceito); a rota antiga usava `>`.
- **Wrapper `getAvailableSlots`**: motivos do domínio traduzidos para o vocabulário antigo
  (`intervalo`/`ocupado`/`antecedencia_minima`/`agenda_cheia` viram `fully_booked`); novo
  `reason: "service_unavailable"` quando o `serviceId` não é ativo da org. O `date: Date` continua
  sendo interpretado como dia de calendário de SP (`dataLocal`).
- **`/availability`**: serviço ou profissional inexistente, inativo ou de outro tenant dá 404 com a
  mensagem do domínio ("Serviço não encontrado." / "Profissional não encontrado."), que difere por
  um "(a)" da do helper `notFound` antigo. Resposta sem `message` nem `example_start_time`, por
  seguir o Zod `Availability`/`AvailabilityMeta`. `STATUS_ATIVOS` está local em `horarios.ts` até
  existir `status.ts`.

### Pendente (browser / curl; o orquestrador verifica)

- `/marcar/<slug>`: lista os mesmos serviços e profissionais de antes (agora ordenados por
  `title`/`name`); o select de serviço mostra título e preço.
- Fluxo do form: escolher serviço, profissional e data; os horários aparecem; trocar o serviço
  refaz a busca e limpa o horário. Serviço de 60 min com almoço 12–13: 11:30 não aparece, 11:00
  aparece. Hoje: horários passados não aparecem.
- `view-source` de `/marcar/<slug>`: sem telefone nem registro de profissional.
- `GET /api/v1/availability` sem `service_id` → 422; com `service_id` → `slots`, `empty_reason`,
  `meta.grid_step_minutes`; serviço de outro tenant → 404.
- `POST /api/v1/appointments` com `start_time` malformado → 422 com a mensagem de antes.
- Conferir no banco real o recorte de ocupados (`start_time < fim AND end_time > início`) e que o
  `appointments` visível ao service role inclui os `pending`.
- Liberada a migration de `REVOKE` de colunas de `professionals` para `anon` (1b), depois do
  deploy deste passo.
