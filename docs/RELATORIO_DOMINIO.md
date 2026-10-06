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


## Etapa 2 (passos 3-4)

Escopo: 00-dominio §10 passos 3 e 4. Branch `development`, sem push, sem migration.
Os componentes (passo 5) e as rotas v1 (passo 6) **não** foram tocados.

### O que foi feito

**Passo 3 (`lib/domain/`)**

- `status.ts` (puro, sem `server-only`): `STATUS`, `ATIVOS`, `EDITAVEIS`, `FINAIS`, `TRANSICOES`,
  `podeTransicionar` (-> `no_show` só com `inicio <= agora`, D11), `podeEditar`,
  `podeReceberPagamento`, `METODOS_PAGAMENTO`, `acoesDisponiveis` (só das três funções, sem `if`
  próprio). Extras: `ehStatus`, `STATUS_DE_PAGAMENTO`, tipos `MetodoPagamento`/`StatusPagamento`/
  `AcoesDisponiveis`. `horarios.ts` usa `ATIVOS` no lugar do `STATUS_ATIVOS` local.
- `STATUS_CONFIG` ganhou `no_show` ("Faltou", laranja, ícone `UserX`).
- `clientes.ts`: `buscarPorTelefone` (`phone_normalized IN brPhoneVariants`, `deleted_at IS NULL`),
  `resolverCliente` (0 cria, 1 reusa sem sobrescrever, 2+ `CUSTOMER_AMBIGUOUS`; telefone de um e
  documento de outro também conta como 2). Documento normalizado como o trigger do banco
  (`[^0-9A-Za-z]` removido), conferido em `normalize_customer_fields`. Corrida no insert (23505)
  refaz a busca; sem resolver, `CUSTOMER_CONFLICT`.
- `mensagens.ts`: textos centralizados (criação pendente/criada com template + fallback, alteração,
  cancelamento com template `msg_appointment_canceled`, confirmação, pedido aprovado/recusado,
  respostas do webhook). Datas formatadas por `utcParaHoraLocal` (nada de fuso fora de `tempo.ts`).
- `agendamentos.ts`: `Canal`, `Ator` (campo opcional `pushName`), `AgendamentoCompleto`,
  `criarAgendamento`, `editarAgendamento`, `mudarStatus`, `registrarPagamento` com os passos do
  §6: validação de horário por canal (`exigirGrade` só publico/autoatendimento, `naoAntesDe` = agora),
  escrita condicionada ao status lido (E6, 0 linhas -> `INVALID_TRANSITION` "O agendamento foi
  alterado por outra pessoa; atualize a tela."), log com `source = ator.origem` em toda escrita (E4),
  23P01 -> `SLOT_UNAVAILABLE`, notificação via `ator.podeNotificar` sem desfazer a escrita, pagamento
  idempotente (paid -> paid não reescreve `paid_at` nem método).

**Passo 4 (um commit por item)**

| Item | Commit |
|---|---|
| passo 3 (domain) | `ef52bc1` |
| criar (`createAppointment` + `createPublicAppointment`) | `83508d0` |
| editar (`update-appointment.ts`, + `lib/painel-sessao.ts`) | `2be383c` |
| status | `b3e2e85` |
| cancelar unificado | `9ccb32d` |
| remover `deleteAppointment` (arquivo apagado) | `24fa9fe` |
| pedido pendente | `6c41edb` |
| pagamento | `53e2fb1` |
| webhook WhatsApp | `88528f2` |
| "a prazo" + relatório + CHANGELOG | último commit |

`lib/painel-sessao.ts` (novo, `server-only`, sem `'use server'`): `organizacaoDaSessao()` (org do
perfil da sessão) e `atorDoPainel()`. As actions do painel migradas o usam; a org nunca vem de
FormData/argumento (`createAppointment` mantém a leitura própria que já tinha). `DomainError` vira
`{ error: message }`; `revalidatePath` e o formato de retorno (`{ success: true }` / `{ error }`)
ficaram como estavam.

### Verificação

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit -p .` antes | limpo |
| `npx tsc --noEmit -p .` depois de cada commit e no fim | limpo |
| `npm run build` | passou |
| `eslint` nos arquivos tocados | sem erro novo. Restam `no-explicit-any` já existentes em `lib/appointment-config.ts` (3), `get-financial-summary.ts` (2) e no webhook (5) |
| `'use server'` em `lib/domain/` | zero |
| `status.ts` sem `server-only` e sem imports | sim (puro) |
| Toda query de `lib/domain/` filtra `organization_id` | sim (o log insere com o id do agendamento já carregado por id + org) |
| grep de `from("appointments")` com insert/update/delete fora do domínio | restam só: cron de lembretes (`reminder_*`), `lib/demo/seed.ts`, `lib/api/domain/appointments.ts` (passo 6) e `calendar-view.tsx:346` (passo 5) |
| Script descartável (fora do repo) contra db falso | 165 casos passaram, 0 falharam |

O script transpila `lib/domain` e cobre: as 49 combinações de transição (antes e depois do horário;
`no_show` antes do horário recusado e exatamente no horário aceito; `arrived -> no_show` recusado),
`acoesDisponiveis` para os 7 status (incluindo "Faltou" só depois do horário e `pagar` sumindo quando
pago), `podeEditar`, `podeReceberPagamento`; `buscarPorTelefone` (sem DDI, sem 9, outra org, apagado);
`resolverCliente` com 0, 1 e 2 matches, sem sobrescrever, `exigirDocumento`, `{id}` de outra org e
apagado; `mudarStatus` (idempotência sem escrita/log, transições inválidas, rótulos na mensagem, canal
webhook, push_name/raw_message no log, outra org -> NOT_FOUND, **concorrência: status alterado entre
leitura e escrita -> 0 linhas -> INVALID_TRANSITION sem log**); `registrarPagamento` (no_show/canceled
recusados, método fora do enum, sinal em `scheduled`, segundo pagamento não muda `paid_at`/método,
log `payment:paid`); validações de `criarAgendamento`. **Não prova**: `validarHorario` dentro de
criar/editar (já coberto na etapa 1), filtros reais do PostgREST, o select com joins do banco real,
envio real de WhatsApp (o stub só confere o texto).

### Divergências entre contrato e código

1. `delete-appointment.ts` tinha o `cancelAppointment` com mensagem fixa; `cancel-appointment.ts`
   usava `sendAppointmentCancellation` (template `msg_appointment_canceled` com `{name}` só primeiro
   nome, fallback "Consulta"). Unifiquei no texto "foi *cancelado*" com **template da org quando
   houver** (`msg_appointment_canceled`, mesmas variáveis). `whatsapp-messages.ts` ficou **órfão**
   (`sendAppointmentCancellation` e `sendAppointmentConfirmation` sem chamador); não apaguei, fora do
   escopo.
2. O webhook buscava o próximo agendamento em `pending/scheduled/confirmed` e confirmava qualquer um.
   Pela tabela "Quem pode o quê" (§5), o cliente só confirma `scheduled`; então "sim" para um `pending`
   agora **não muda nada** (o webhook responde `transition_not_allowed` e não manda resposta). Antes
   era auto-aprovação de pedido pelo cliente.
3. `get-financial-summary.ts` lê com o client de sessão (RLS) e recebe `organizationId` por argumento.
   É leitura, não escrita (D9 só fecha escrita), então não mudei; vale revisar. `porProfissional` e
   `porProcedimento` ainda somam todo agendamento não cancelado (inclusive `pending` e `no_show`); o
   contrato só manda mudar o "a prazo".
4. Editar exige serviço e profissional **ativos** (contrato §6.2): se o serviço do agendamento foi
   desativado depois, nem editar a observação passa (`NOT_FOUND` "Serviço não encontrado."). Antes
   passava.
5. Criar no painel recusa horário no passado (`naoAntesDe = agora`, tabela do §4). Antes o painel não
   olhava.

### Decisões fora do contrato

- `Ator.pushName?` (opcional) para o `push_name` do log do webhook.
- `EntradaCriacao.antecedenciaMinutos?` (opcional) para o corte do autoatendimento
  ("agora + antecedência"); hoje nada passa.
- `mudarStatus(..., { motivo?, aoResponderPedido? })`: `aoResponderPedido` escolhe os textos de
  pedido aprovado/recusado (com nome da organização) que `handleAppointmentRequest` já usava, sem
  adivinhar pelo status anterior.
- **`updateAppointmentStatus` não avisa o cliente** (`podeNotificar: null`), como antes: o contrato
  manda notificar em `confirmed`/`canceled`, mas a action nunca mandou WhatsApp e confirmar pelo menu
  passaria a mandar. Se o dono quiser, é trocar `false` por `true` numa linha.
  `cancelAppointment` e `handleAppointmentRequest` notificam (como antes).
- Status inicial por canal validado em `criarAgendamento` (painel `scheduled`, público/autoatendimento
  `pending`, api os três, webhook nenhum); fora disso `VALIDATION_ERROR`.
- Pagamento na criação do painel: só entra se o form mandar `payment_method` (validado no enum) e/ou
  `payment_status = paid`; senão `pending/null`.
- Log de edição sem mudança de horário usa `action = "updated"`; com mudança, `rescheduled`.
  `mudarStatus` loga `action = <novo status>` (vocabulário do webhook), não `status:<x>`/`canceled`
  da API v1; o passo 6 unifica.
- O texto de alteração usa "Seu agendamento" (maiúsculo, como o painel); a v1 usava "seu".
- `appointment_logs.push_name` fica `null` fora do webhook.

### Pendente (browser / curl; o orquestrador verifica)

Aceite que depende de browser, com o app rodando em `development`:

- [ ] Painel: criar agendamento (cliente existente e novo com documento) funciona; linha em
  `appointment_logs` com `source='painel'`, `action='created'`. Criar com horário passado ou ocupado
  -> erro.
- [ ] Painel: remarcar um `scheduled` funciona e manda WhatsApp só se o horário mudou; remarcar para
  cima de outro agendamento -> erro "ocupado"; remarcar um `completed` -> erro.
- [ ] Painel: Confirmar, Chegou e Finalizar pelos menus (card e clique direito) funcionam em
  `scheduled`/`confirmed`; em `pending` os itens Chegou/Finalizar ainda **aparecem** (menus só mudam no
  passo 5), mas a action devolve erro (o menu mostra "Erro ao atualizar status").
- [ ] Mudar `completed` para `scheduled` chamando a action direto -> erro, sem alterar.
- [ ] `no_show` antes do horário pela action direta -> erro; depois do horário -> ok.
- [ ] Cancelar pelo menu e pelo diálogo: cancela e manda WhatsApp (se a org tiver número); cancelar
  `completed` -> erro e a receita continua no financeiro. **Atenção:** os menus usam
  `toast.promise(cancelAppointment(...))`, que trata `{ error }` como sucesso; corrigir no passo 5.
- [ ] Pagar: `scheduled` (sinal) ok; `no_show`/`canceled` erro; pagar duas vezes não muda `paid_at`
  (conferir no banco); método vazio/`Outros` -> erro.
- [ ] Dashboard: aprovar/recusar pedido pendente manda os textos de "Agendamento Confirmado!" /
  "Atualização de Agendamento".
- [ ] Finanças "a prazo" não lista `pending`, `canceled` nem `no_show`.
- [ ] Duas abas: aba A finaliza, aba B (desatualizada) tenta "Chegou" -> "alterado por outra pessoa".
- [ ] Público (`/marcar/<slug>`): cliente cadastrado como `11987654321` agenda com `(11) 98765-4321`
  -> reusa o cadastro (sem duplicar); duas pessoas com o mesmo telefone em formas diferentes ->
  "Há mais de um cadastro com esses dados; informe o cliente."; horário fora da grade -> erro.
- [ ] Webhook: "confirmo" a um `scheduled` confirma, loga `source='whatsapp_webhook'` com
  `push_name`/`raw_message`; a um `completed` (ou `pending`) não muda nada; "cancelar" cancela.


## Etapa 2 (passo 5)

Escopo: 00-dominio §10 passo 5 (§8.2, componentes do painel). Branch `development`, sem push,
sem mexer em actions, `lib/domain`, rotas v1, migrations, `lib/demo` ou tour.

### O que foi feito

| Item | Commit |
|---|---|
| menus do card e do clique direito por `acoesDisponiveis` + "Faltou" + toast de erro | `abd3498` |
| calendário sem escrita direta; clique só abre edição se `editar` | `087f0c6` |
| diálogo de edição (formulário e lixeira) | commit "dialogo de edicao" |
| financeiro: "Baixar" só se `pagar` | `0f2589f` |
| remove `payment-menu.tsx` | `8aa8b2b` |
| rótulos do dashboard/ficha por `STATUS_CONFIG`, `cancelled` -> `canceled` | commit "rotulos de status" |

Arquivos: `components/appointments/acoes-agendamento.ts` (novo), `appointment-card-actions.tsx`,
`appointment-context-menu.tsx`, `calendar-view.tsx`, `update-appointment-dialog.tsx`,
`components/dashboard/financial-cards.tsx`, `app/(app)/dashboard/page.tsx`,
`app/(app)/clientes/[id]/page.tsx`; removido `payment-menu.tsx`.

`acoes-agendamento.ts` (puro, só importa `lib/domain/status`): `acoesDoAgendamento(agendamento)`
(adapta status/start_time/payment_status do painel para `acoesDisponiveis`; status desconhecido
ou sem horário = nenhuma ação), `METODOS_NOS_MENUS` (derivado de `METODOS_PAGAMENTO`, sem `outro`
como antes), `rotuloMetodo`, `lancarSeErro` (transforma `{ error }` em rejeição para `toast.promise`).
Os dois menus usam o mesmo helper, então mostram os mesmos itens.

Bugs: (2) cancelar nos menus usava `toast.promise` e mostrava sucesso com `{ error }`; agora
rejeita e o toast mostra a mensagem do domínio. Status e pagamento também mostram `result.error`
(no card, clique direito e financeiro). (3) ver divergências.

### Verificação

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` antes e depois de cada commit | limpo |
| `npm run build` | passou |
| eslint nos arquivos tocados | só erros que já existiam (`no-explicit-any`, `react/no-unescaped-entities`, setState em effect); nenhum novo |
| nenhum componente client escreve em `appointments` | confirmado (grep de `from("appointments")` em arquivos `use client`: zero) |
| `payment-menu.tsx` | não existe |
| `status ===` em componentes | restam: `status === 'arrived'/'completed'` nos handlers dos menus (STATUS ALVO, para evento do tour e redirecionamento, não decidem se a ação aparece); estilo/ocultar cancelado na grade do calendário |

### Divergências

1. **Bug 3 (card do dashboard não atualiza)**: o código dos menus já chamava `router.refresh()`
   após sucesso e o dashboard é `force-dynamic` com `RealtimeAppointments` (que também faz refresh).
   Não consegui reproduzir sem browser; mantive `router.refresh()` em todos os sucessos (menos
   `completed`, que faz `router.push` para a ficha, sem refresh em seguida). Se persistir, é para
   investigar no browser. Não havia callback no dashboard (só o calendário passava `onStatusChange`,
   removido junto com a escrita direta; a prop continua opcional no menu, sem uso).
2. Rótulo de `arrived` no dashboard muda de "Na recepção" para "Chegou" (STATUS_CONFIG).
3. Ficha do cliente: badge para `completed` com pagamento parcial/reembolsado passa a "Finalizado"
   (antes vazio); `pending` e `no_show` ganham rótulo.
4. `get-financial-summary.ts` já selecionava `status` e `start_time`: nada a mudar.
5. Calendário: não existe tela de leitura, então clicar num card não editável não abre nada
   (o cursor deixa de ser pointer).

### Decisões fora do contrato

- Sem nenhuma ação disponível, os dois menus mostram um item desabilitado: "Pagamento concluído"
  se pago, senão o rótulo do status (`STATUS_CONFIG`). O gatilho continua visível.
- Menus oferecem pix/crédito/débito/dinheiro (como antes); o financeiro continua oferecendo
  também `outro`. Todos os valores são do enum.
- `agora` é lido a cada render: um menu renderizado antes do horário não mostra "Faltou" até
  re-renderizar; a action recusa de qualquer forma.
- Diálogo de edição não editável: `<fieldset disabled>` + aviso de status; botão Salvar desabilitado.

### Checklist de browser

- [ ] Dashboard/agenda/ficha, menu "..." e clique direito, por status: `pending` só Confirmar e
  Cancelar; `scheduled`/`confirmed` Confirmar (só `scheduled`), Chegada, Finalizar, Cancelar e
  "Faltou" só depois do horário; `arrived` Finalizar e Cancelar; `completed` não pago só pagamento;
  `completed` pago, `canceled`, `no_show`: item desabilitado. Card e clique direito iguais.
- [ ] Marcar "Faltou" num `confirmed` já passado: vira `no_show`, card atualiza sem F5.
- [ ] Mudar status pelo menu do dashboard: card atualiza sem recarregar (bug 3).
- [ ] Duas abas: aba B (desatualizada) tenta Chegada depois de A finalizar: toast com "alterado por
  outra pessoa" (não sucesso).
- [ ] Cancelar um `scheduled` pelo menu: toast de sucesso; cancelar quando a action recusa: toast de erro.
- [ ] Agenda: clicar num card `completed`/`arrived` não abre diálogo; num `scheduled` abre; lixeira
  só nos status que permitem cancelar.
- [ ] Finanças "a prazo": "Baixar" só nos itens pagáveis; erro de pagamento mostra a mensagem.
- [ ] Tour (demo): anchors `data-tour` e eventos `eliza:appointment-*` preservados (não foram tocados).

## Etapa 1b — migration aplicada em produção (2026-10-06)

`20261006120000_professionals_hide_sensitive_columns_from_anon` aplicada via MCP
depois do deploy do PR #39 (produção conferida servindo o código novo: HTML de
`/marcar/admin` sem `license_number`/`user_id`/`phone`).

- Catálogo: `anon` sem SELECT em `phone`, `license_number`, `user_id`; com SELECT em
  `id`, `name`; `authenticated` mantém `phone`.
- REST com a anon key: `select=phone` e `select=*` → 401/42501; `select=id,name` → 200.
- `/marcar/admin` em produção: 200, profissionais listados.
- Grep: nenhum outro caminho anônimo lê `professionals` (o resto é rota logada ou service role).

## D9 — migration aplicada em produção (2026-10-06)

`20261006120200_appointments_readonly_for_authenticated` aplicada via MCP depois de o
Sérgio testar o painel em produção (criar, editar, mudar status, pagar).

- Antes: uma policy só, `Org access appointments` (ALL).
- Depois: uma policy só, `Org members read appointments` (SELECT, `get_user_org_id()`);
  `authenticated` sem INSERT/UPDATE/DELETE, com SELECT; `service_role` mantém escrita.
- Prova: `set local role authenticated; update appointments ... where false` →
  42501 `permission denied for table appointments` (nenhuma linha tocada).
- Produção: `/marcar/admin` e `/login` respondem 200.
