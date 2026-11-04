# Relatório da execução: adicionais no agendamento, fase 1

> Contrato: `docs/contratos/adicionais/README.md` · Executado em 2026-11-03/04 na branch `development`, **sem commit**.
> Escopo: passos 2 a 7 do §10. O passo 1 (migration) já estava aplicado. Fase 2 não foi tocada.

## Arquivos

**Novos**

- `web/app/actions/adjust-appointment-addons.ts`
- `web/components/appointments/addons-picker.tsx`
- `web/components/appointments/adjust-addons-dialog.tsx`
- `web/components/appointments/addons-summary.tsx`

**Alterados**

- Biblioteca e domínio: `web/lib/adicionais.ts`, `web/lib/preco.ts` (`formatarReais`), `web/lib/domain/agendamentos.ts`, `web/lib/domain/catalogo.ts`, `web/lib/domain/status.ts`, `web/lib/api/serializar.ts`, `web/lib/api/leitura-agendamentos.ts`
- Contratos Zod: `web/contracts/api-v1/catalogo.ts`, `web/contracts/autoatendimento/catalogo.ts`, `web/contracts/publico/catalogo.ts`, `web/contracts/comum/adicionais.ts` (só o comentário do cabeçalho)
- Actions: `web/app/actions/create-appointment.ts`
- Telas: `web/app/marcar/[slug]/public-booking-form.tsx`, `web/components/appointments/create-appointment-dialog.tsx`, `appointment-card-actions.tsx`, `appointment-context-menu.tsx`, `acoes-agendamento.ts`, `update-appointment-dialog.tsx`, `web/components/services/service-addons-field.tsx`, `web/app/(app)/agendamentos/page.tsx`, `web/app/(app)/dashboard/page.tsx`, `web/app/(app)/clientes/[id]/page.tsx`
- Tipos: `web/utils/database.types.ts` (`addons` em `appointments`: Row `Json`, Insert e Update `Json?`)
- Textos: `web/lib/openapi/v1.ts`, `autoatendimento.ts`, `publica.ts`, `docs/API.md`, `docs/API_PUBLICA.md`, `docs/contratos/autoatendimento/03-catalogo-e-horarios.md`, `CHANGELOG.md`

## O que foi feito

- **§3** `lib/adicionais.ts`: `id` na leitura (item sem id válido some), `id` opcional na escrita (mantém o recebido, gera `crypto.randomUUID()`, repetido é erro), `AdicionalAplicado`, `lerAdicionaisAplicados`, `somarAdicionais`, e `adicionaisParaColuna`. `service-addons-field.tsx` reenvia o `id` de cada linha gravada. Os três catálogos ganharam `id` e os serializadores o devolvem.
- **§4** `resolverAdicionais` (exportada de `lib/domain/agendamentos.ts`), `criarAgendamento` (preço = serviço + adicionais, `addons` gravado), `podeAjustarAdicionais` e `AcoesDisponiveis.adicionais` em `status.ts`, `ajustarAdicionais` (guarda por status, pagamento e preço, log `addons_updated`, sem notificar), catálogo lido sem filtrar `is_active` (`adicionaisDoServico` em `lib/domain/catalogo.ts`).
- **§6** `editarAgendamento`: troca de serviço recalcula `price`, zera `addons` e recusa pago ou estornado; o `update` também condiciona a `payment_status`.
- **§5.3** `createAppointmentCore` lê `addons` do FormData ("Adicionais inválidos." para JSON ruim ou fora do Zod; ausente = `[]`) e a action `adjustAppointmentAddons` (org pela sessão, ator do painel sem notificar, revalida `/agendamentos`, `/dashboard`, `/clientes`).
- **§5.1/5.2** `AddonsPicker` (quantidade 0 a 20 com botões de 44 px, checkbox sem unidade, tokens de tema) e `/marcar`: seletor logo após o serviço, zera ao trocar de serviço, envia `addons`, bloco de valor com serviço, adicionais, "Total estimado" ou "Total a partir de", e "O valor final é confirmado no atendimento."; serviço sem preço mostra só "Adicionais: + R$ X"; resumo do celular, linha de total no passo 1 (celular) e tela de sucesso refletem o total.
- **§5.4** seletor no diálogo de criação; `AdjustAddonsDialog` com item no card e no clique direito (só com adicional no catálogo ou na cópia); selects com `addons`/`price`; adicionais listados nos cards do painel inicial e da ficha do cliente; aviso no diálogo de edição ao trocar de serviço.
- **§7** textos corrigidos (ver verificação do grep) e `CHANGELOG.md` reescrito: item de adicionais em `### Adicionado`, troca de serviço em `### Corrigido`, correção de WhatsApp mantida.

## Verificações

### `tsc --noEmit`

```
$ node node_modules/typescript/bin/tsc --noEmit -p .
(sem saída)
exit=0
```

Antes da correção em `leitura-agendamentos.ts` havia um erro (`adicionais` ausente em `AgendamentoCompleto`); corrigido.

### ESLint nos 30 arquivos .ts/.tsx tocados

Nenhum erro ou aviso novo. Conferido de duas formas:

- `git diff -U0 -- web | grep '^+' | grep '\bany\b'` não devolve nada, e os 4 arquivos novos não têm `any`.
- Tudo que o ESLint ainda aponta é código anterior: `no-explicit-any` em `agendamentos/page.tsx` (1), `clientes/[id]/page.tsx` (2), `dashboard/page.tsx` (4), `appointment-card-actions.tsx` (1), `appointment-context-menu.tsx` (2), `create-appointment-dialog.tsx` (9), `update-appointment-dialog.tsx` (5); `no-unused-vars` (`params`, `resServices`, `resAll`, `FileImage`, `setSelectedDocuments`, `setDocumentNotes`, `error` do catch); `no-unescaped-entities` em `clientes/[id]/page.tsx:294`; `no-img-element` em `public-booking-form.tsx`; `set-state-in-effect` em `update-appointment-dialog.tsx:110`. Não rodei o ESLint sobre o HEAD para comparar contagem, porque não posso usar stash; a comparação é pelo diff.

### `resolverAdicionais` e funções puras

Script `scratchpad/verifica-adicionais.cjs`: transpila `lib/adicionais.ts`, `erros.ts`, `status.ts`, o Zod comum, e extrai do arquivo real o trecho de `resolverAdicionais` (sem importar `server-only`).

```
ok   item do catálogo copia nome, valor e unidade
ok   item de atuais mantém valor antigo mesmo com catálogo diferente; só troca a quantidade
ok   item de atuais que saiu do catálogo ainda resolve
ok   id inexistente é recusado
ok   unidade nula com quantidade 2 é recusada
ok   unidade nula com quantidade 1 passa
ok   unidade nula vinda de atuais também recusa quantidade 2
ok   soma com centavos: 3 x 0,10 = 0,30
ok   somarAdicionais com vários itens e centavos
ok   preço do exemplo do contrato: 110 + 2 x 5 = 120
ok   ajuste: base derivada de price - soma dos atuais não reprecifica
ok   id repetido na escolha é recusado
ok   lerAdicionaisAplicados: lê, calcula total e descarta item inválido
ok   adicionaisParaColuna é o formato {id, name, price, unit, quantity}
ok   lerAdicionais: item sem id some; com id passa
ok   validarAdicionais: mantém id recebido, gera id se faltar, recusa id repetido
ok   zod AdicionaisEscolhidos: quantidade 21, 0, repetido e campo extra (valor) são recusados
ok   podeAjustarAdicionais e acoesDisponiveis

18 casos ok
```

### `grep` de texto "adicional não entra no valor"

Padrões: `não entra(m)`, `não soma(m)`, `sem somar`, `só informa(m) o cliente`, `apenas/somente informa`, em `web`, `docs` e `CHANGELOG.md`, excluindo o próprio contrato: **nenhum resultado**. (Os worktrees em `.claude/worktrees/` pertencem a outra sessão e não foram tocados.)

## Divergências do contrato e decisões

1. **`adicionaisParaColuna`**: o contrato chama `paraColuna(adicionais)` sem dizer onde mora. Ficou em `lib/adicionais.ts`, pura, ao lado de `lerAdicionaisAplicados`.
2. **`resolverAdicionais` recusa id repetido na escolha** ("Adicional repetido."), além do que o contrato descreve. O Zod já recusa antes; é só defesa do domínio.
3. **`lib/api/leitura-agendamentos.ts` foi tocado**, embora fora da lista: `AgendamentoCompleto` ganhou `adicionais` (§4.2) e esse arquivo monta o tipo à mão. Ele agora lê `addons`. O corpo da resposta da v1 não muda, porque `paraAppointment` mapeia campo a campo e não emite `adicionais` (isso é fase 2).
4. **`AddonsPicker` tem uma prop opcional `titulo`** (padrão "Adicionais (opcional)"), usada no diálogo de ajuste como "Adicionais usados".
5. **Mensagem do ajuste recusado**: o contrato só fixa a mensagem do caso pago. Pago e estornado usam "Agendamento pago: desfaça o pagamento para ajustar os adicionais." (para estornado o "pago" é impreciso); status cancelado ou falta usam "Agendamento <status> não aceita ajuste de adicionais."
6. **Texto do Autoatendimento mantido em parte**: a descrição OpenAPI de `GET /servicos` ainda diz "nunca os some ao preço por conta própria", mas agora explica que o agendamento por esse canal nasce com o preço base até a fase 2. Remover a instrução seria errado hoje: o bot não consegue enviar adicionais. O mesmo vale para a descrição do `/services` da v1 ("o `POST /appointments` ainda não os aceita") e para o contrato 03.
7. **Docs além da lista do §7**, exigidas pelo §6: linha do `PATCH` em `docs/API.md` e a descrição do `PATCH /appointments/{id}` na OpenAPI v1 dizem que trocar o serviço recalcula o valor. Os exemplos de OpenAPI e docs ganharam `id` nos adicionais (UUIDs de exemplo válidos).
8. **`web/contracts/comum/adicionais.ts`**: só o comentário do cabeçalho mudou ("TO-BE: ainda sem consumidor" deixou de ser verdade). Nenhum schema foi alterado.
9. **Cards**: os adicionais aparecem no card da lista do painel inicial e no card da ficha do cliente. O card pequeno do calendário não tem espaço e não os lista; o diálogo de edição só avisa da troca de serviço.
10. **Dashboard**: o mapeamento de `upcomingAppointments` reconstrói `services`, então precisei repassar `addons` ali.

## Pontos para a revisão Opus

- **Histórico na ficha do cliente (anterior a esta mudança):** `clientes/[id]/page.tsx` lista TODO `appointment_logs` e rotula qualquer ação diferente de `confirmed` como "Cancelamento via Bot". O novo log `addons_updated` (como já ocorre com `created`, `updated`, `payment:*`) aparece lá com esse rótulo. Não corrigi, por estar fora do escopo.
- `update` do ajuste filtra `price` com `.eq("price", <número lido>)`. Funciona com `numeric` e com os valores arredondados a centavos que o domínio grava, mas não foi exercitado contra o banco.
- `ajustarAdicionais` calcula a base com `lerAdicionaisAplicados`, que descarta item malformado da coluna. A coluna só é escrita pelo domínio, então não deve haver item inválido; se houvesse, a base subestimaria o desconto.

## Não verificado

- **Nada foi exercitado no navegador nem contra o banco** (regra da tarefa). Sem verificação: layout a 375 px, o seletor e o diálogo de ajuste, o diálogo abrindo a partir do menu (dropdown e clique direito) sem problema de foco, o bloco de total do `/marcar` e o comportamento com `?servico=`.
- Criar agendamento com adicionais, ajustar em `arrived` e `completed`, recusa quando pago, troca de serviço e a condição por `payment_status` e `price` no `update`: validados só por leitura de código e pelo script de funções puras, não por chamada real. O Aceite do §11 inteiro fica para o tenant demo.
- O `update` de ids do §2 foi aplicado antes; a **nova execução depois do deploy** (passo 8) continua pendente.
- `tsc` e ESLint passaram, mas ESLint não foi comparado contra o HEAD (ver acima).
- Fase 2 não foi tocada: API v1 (`CreateAppointmentBody`, `Appointment`), Autoatendimento e `sola-agens`.

## Revisão Opus (2026-11-03)

Diff do domínio, das actions e das telas lido contra o contrato. Aceite rodado em tenant demo, no navegador e conferido no banco.

**Corrigido na revisão:**

- `agendamentos/page.tsx` não buscava `service_id`: o diálogo de edição não mostrava o serviço atual e o aviso de troca aparecia mesmo mantendo o serviço.
- `clientes/[id]/page.tsx`: `addons_updated` ganhou rótulo próprio, em vez de cair em "Cancelamento via Bot".
- `lib/adicionais.ts`: quantidade máxima usa a constante do contrato, não `20` fixo.

**Confirmado com execução real:**

- Salvar serviço sem mexer mantém os ids.
- `/marcar`: seleção com `?servico=`, total estimado de R$ 195,00, 375 px sem estouro, botões de 44 px.
- Painel: criar com 2 unidades grava `price = 190` e a cópia.
- Ajuste em `completed` não pago: R$ 190 para R$ 202, com item já escolhido mantendo R$ 5 e item novo usando R$ 7 do catálogo alterado. Log `R$ 190,00 -> R$ 202,00`.
- Pago durante o ajuste: recusado com a mensagem do contrato, valor e itens intactos. Pago não oferece o ajuste.
- Financeiro: Recebido R$ 292,00 e serviço com R$ 202,00, sem mudança no código do financeiro.
- Troca de serviço: R$ 45 para R$ 180; R$ 187 com adicional para R$ 90 e `addons = []`. Sem troca, sem aviso.

**Aceite não exercitado no navegador:**

- Envio final do `/marcar`: exige CPF, e nenhum documento foi digitado. A gravação foi exercitada pelo painel, que usa o mesmo `createAppointmentCore`; o envio de `addons` no formulário público só foi lido.
- POST forjado, quantidade 21, adicional sem unidade com quantidade 2: cobertos pelo script e pelo Zod, sem requisição real.
- Item apagado do catálogo no diálogo de ajuste; desfazer pagamento e voltar a ajustar; menus de `canceled` e `no_show`.
- Diálogos do painel em 375 px.
- A entrada do log não apareceu na ficha da cliente no teste, então o rótulo novo não foi visto em tela.

**Pendente no deploy:** rodar de novo o `update` de ids do §2.

---

# Fase 2, lado do Eliza: API v1 e Autoatendimento

> Contrato: §8, §9 (parte Eliza) e passos 9 e 10 do §10. Executado em 2026-11-03 na branch `development`, **sem commit**.
> O `sola-agens` (passo 11) não foi tocado.

## Arquivos alterados

- Contratos Zod: `web/contracts/api-v1/agendamentos.ts` (`CreateAppointmentBody.addons`, `Appointment.addons`), `web/contracts/autoatendimento/agendamentos.ts` (`CriarAgendamentoBody.adicionais`, `AgendamentoResumo.adicionais` e `valorTotal`), `web/contracts/comum/adicionais.ts` (só o comentário do cabeçalho).
- API v1: `web/lib/api/serializar.ts` (`paraAppointment` devolve `addons`), `web/app/api/v1/appointments/route.ts` (repassa `addons` como `adicionais` ao domínio).
- Autoatendimento: `web/lib/autoatendimento/agendamentos.ts` (resumo com `adicionais` e `valorTotal`), `web/lib/autoatendimento/escrita.ts` (`criarDoCliente` repassa `adicionais`).
- OpenAPI: `web/lib/openapi/v1.ts`, `web/lib/openapi/autoatendimento.ts`.
- Docs: `docs/API.md`, `docs/API_AUTOATENDIMENTO.md`, `docs/contratos/autoatendimento/03-catalogo-e-horarios.md`, `04-agendamentos.md`, cabeçalho de `docs/contratos/adicionais/README.md`, este relatório e `CHANGELOG.md` (`[Não publicado]` › `Adicionado`).
- `web/lib/api/leitura-agendamentos.ts` e `web/lib/domain/agendamentos.ts` não precisaram de mudança: a fase 1 já lia `addons` e `criarAgendamento` já aceitava `adicionais`.

## O que foi feito

- **v1:** `POST /appointments` aceita `addons: [{ id, quantity }]` (opcional) e o repassa ao domínio; a resposta e o `GET` trazem `addons` (`{ id, name, unit_price, unit, quantity, total }`), sempre presente. Adicional inválido sai como `VALIDATION_ERROR` pelo mapeamento existente de `DomainError`. `price` está documentado como total.
- **Autoatendimento:** `criarDoCliente` repassa `body.adicionais`. `AgendamentoResumo` ganhou `adicionais` e `valorTotal` (= `appointments.price`). `paraResumo` é o único lugar que monta o resumo e usa `lerAdicionaisAplicados`. Os `select` (listagem, que também alimenta o contexto, posse por id e retentativa C5) agora usam a mesma constante `SELECT_RESUMO`, com `price` e `addons`. A resposta do domínio (`resumoDeCompleto`) passa `price` e a cópia pelo mesmo caminho.
- **C5:** o pedido repetido devolve o agendamento já criado pelo `select` e nada é somado de novo. O pedido repetido não revalida os `adicionais` do novo corpo (ele nem chega ao domínio); fica documentado nas descrições e no 04.
- **Remarcar:** nenhuma mudança de código. `editarAgendamento` só toca `price` e `addons` na troca de serviço, e a remarcação do Autoatendimento nunca troca. Documentado no 04.
- **OpenAPI do atendente:** a descrição do `POST /agendamentos` ganhou a regra (só oferecer adicional que o serviço tem, nunca inventar item; perguntar a quantidade quando há `unidade`; enviar só `id` e `quantidade`; apresentar `valorTotal` como estimado, com o valor final confirmado no atendimento; nunca calcular outro valor). `x-atendente: true` segue no `POST` (conferido gerando o documento). Também ganhou exemplo `comAdicionais`, anotação de campos e menção na seção "Regras de agendamento".
- **Textos da fase 1:** `GET /servicos` deixou de dizer "nunca os some ao preço" e "nasce com o preço base"; agora manda enviar `id` e `quantidade` e diz que o valor é calculado pelo Eliza (`valorTotal`). `GET /services` da v1, `docs/API.md` e o contrato 03 deixaram de dizer que o `POST` não aceita adicionais.

## Verificações

- `node node_modules/typescript/bin/tsc --noEmit -p .`: sem saída, `exit=0`.
- `npm test`: `# tests 16`, `# pass 16`, `# fail 0`.
- ESLint nos 9 arquivos `.ts` tocados (`contracts/autoatendimento/agendamentos.ts`, `contracts/api-v1/agendamentos.ts`, `contracts/comum/adicionais.ts`, `lib/api/serializar.ts`, `app/api/v1/appointments/route.ts`, `lib/autoatendimento/escrita.ts`, `lib/autoatendimento/agendamentos.ts`, `lib/openapi/v1.ts`, `lib/openapi/autoatendimento.ts`): `exit=0`, sem erro nem aviso.
- Script sem banco `scratchpad/verifica-fase2.cjs`, 31 casos, todos ok. Transpila os arquivos reais do repositório e exercita: `AppointmentAddonsInput` e `AdicionaisEscolhidos` (aceitam válido; recusam id repetido, quantidade 21, mais de 10 itens e campo extra `price` ou `valor`); `CreateAppointmentBody` e `CriarAgendamentoBody` (válidos sem o campo novo e com ele; recusam item com valor, quantidade 21 e repetido); `paraAppointment` (`addons` sai como `[{ id, name: "Unha quebrada", unit_price: 5, unit: "por unha", quantity: 2, total: 10 }]`, `price` 120, `[]` quando não há, saída aceita pelo Zod `Appointment`, que exige `addons`); `paraResumo` e `resumoDeCompleto` (`adicionais` com total, `valorTotal = price`, agendamento antigo vira `[]` e `null`, `addons` malformado vira `[]`, saída aceita pelo Zod `AgendamentoResumo`).
- Script sem banco `scratchpad/verifica-openapi.cjs`: gera os dois documentos OpenAPI e confere `x-atendente: true` no `POST /agendamentos` do Autoatendimento, as cinco instruções do atendente na descrição, exemplos `comAdicionais`, schemas com `adicionais`, `valorTotal`, `addons` e suas descrições, `Appointment.addons` obrigatório na v1 e o texto antigo de `GET /servicos` ausente.
- `grep` de `preço base`, `até a fase 2`, `ainda não os aceita`, `nunca os some`, `ainda nasce`, `preço vem do serviço` em `web` e `docs`, fora do contrato e deste relatório: restam só dois comentários ("o preço base é o total gravado menos os adicionais atuais", A6), que são verdadeiros e não falam de canal.

## Divergências do contrato e decisões

1. **`web/lib/api/leitura-agendamentos.ts` não foi alterado.** O contrato (§8) manda tocá-lo, mas a fase 1 já o deixou lendo `addons` e preenchendo `adicionais`; `paraAppointment` era a peça que faltava.
2. **Pedido repetido não valida o corpo novo contra o catálogo** (a retentativa C5 responde antes de `criarAgendamento`). É o que o contrato pede ("sem somar nada de novo"); anotado nas docs.
3. **`resumoDeCompleto` converte `adicionais` com `adicionaisParaColuna` e lê de volta com `lerAdicionaisAplicados`**, em vez de copiar direto: `paraResumo` recebe uma linha de banco, então o resumo vindo do domínio reconstrói a linha e passa pelo mesmo leitor. Resultado igual, ao custo de uma conversão de ida e volta.
4. **`SELECT_RESUMO` virou constante única, movida para o topo do arquivo**, e a listagem passou a usá-la (antes tinha o mesmo texto escrito à mão). Evita que um `select` fique sem `price` e `addons`.
5. **`CHANGELOG.md`:** um item para a v1 e outro para o Autoatendimento, ambos em `Adicionado`; sem item `Modificado` para os textos de documentação.
6. **Exemplo `comAdicionais` do Autoatendimento** reaproveita o id de serviço de exemplo ("Corte de cabelo") com adicional de unhas, só para ilustrar o formato.

## Não verificado

- **Nenhuma rota foi chamada** (sem servidor, sem banco): `POST /api/v1/appointments` com `addons`, `POST /autoatendimento/agendamentos` com `adicionais`, os `GET`, o contexto, remarcar pelo bot e a retentativa C5 foram verificados só por leitura de código e pelos scripts de funções puras. O Aceite da fase 2 do §11 fica para depois do deploy.
- Os `select` do Supabase com `price, addons` não foram exercitados contra o banco; `price` é lido como `number`, como já era na v1.
- O `422` para adicional inválido na rota do Autoatendimento depende do mapeamento de `DomainError` em `criarRota`, não testado em execução.
- A "conversa real" com a atendente (último item do Aceite) depende do `sola-agens`, passo 11, que não foi feito.
- Nenhuma tela foi tocada nem aberta.

## Revisão Opus da fase 2, lado do Eliza (2026-11-03)

Diff lido contra o contrato, sem correções. Rotas chamadas de verdade em servidor local, na org `admin`, com adicionais temporários. Dados de teste removidos em seguida.

| Chamada | Resultado |
|---|---|
| `POST /api/v1/appointments` com 2 unidades e 1 fixo | 201, `price` 330 e `addons` com `unit_price`, `quantity` e `total` |
| Mesmo POST sem `addons` | 201, `price` 300, `addons: []` |
| `GET /api/v1/appointments/{id}` | 200, com `addons` |
| v1 com id inexistente, fixo com quantidade 2, quantidade 21, `price` no item, item repetido | 422 nos cinco casos |
| `GET /autoatendimento/servicos` | `adicionais` com `id` |
| `POST /autoatendimento/agendamentos` com 3 unidades | 201, `valorTotal` 315, `pending` |
| Pedido repetido com quantidade 9 (C5) | Mesmo agendamento, `valorTotal` 315 |
| `GET /autoatendimento/agendamentos` | `valorTotal` e `adicionais` em cada item |
| Autoatendimento com `valor` no item | 422 |
| Remarcar pelo Autoatendimento | 200, mantém `valorTotal` e `adicionais` |

**Não provado:** id inexistente no Autoatendimento parou antes em `ACTIVE_LIMIT_REACHED`, gerado pelo próprio teste. A validação é a mesma do domínio, que respondeu 422 na v1.

**Update de ids pós-deploy da fase 1:** não foi preciso rodar. O catálogo no ar já traz `adicionais` com `id`, e o banco tem 0 itens sem `id`.

**Pendente:** passo 11, `sola-agens`, depois do deploy desta fase. Lá `agentes/eliza.yaml` tem mudanças não commitadas de outra sessão.
