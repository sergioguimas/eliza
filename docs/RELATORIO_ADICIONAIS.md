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
