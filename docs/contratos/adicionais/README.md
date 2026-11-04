# Adicionais no agendamento — contrato

> **TO-BE** · fase 1 implementada e revisada em 2026-11-04; fase 2, lado do Eliza (API v1 e Autoatendimento, passos 9 e 10), implementada e revisada em 2026-11-03; falta o `sola-agens` (passo 11) · relatório da execução: `docs/RELATORIO_ADICIONAIS.md`
> **Escrito em:** 2026-11-03 · **Origem:** pedido da Deborah (R$ 5 por unha em mudança de formato e em unha quebrada), decisões do Sérgio na mesma data
> **Pré-requisito:** PR #56 (`services.addons`) na `main`
> **Zod novo:** `web/contracts/comum/adicionais.ts`
> **Zod tocados:** `web/contracts/api-v1/catalogo.ts`, `api-v1/agendamentos.ts`, `autoatendimento/catalogo.ts`, `autoatendimento/agendamentos.ts`, `publico/catalogo.ts`

## Para quem executa

Os `.md` dizem **o que** e **por quê**; os Zod são a forma exata. Onde este arquivo der um valor
fechado, use o valor. Se o código contradisser uma premissa daqui, o código vence: pare, registre no
relatório e siga o que é correto. Branch `development`; nada vai para a `main` sem revisão Opus.

**Regras que não se negociam:**

- **`appointments.price` é sempre o total** (serviço + adicionais). Finanças, dashboard e ranking
  somam esse campo. Não mexa em `get-financial-summary.ts` nem nas somas do dashboard.
- **Valor nunca vem do navegador nem da API.** Quem chama informa `id` e quantidade; nome e valor
  saem do catálogo, no servidor.
- **Toda escrita em `appointments` passa por `lib/domain`** (`authenticated` só lê, D9).
- **O agendamento guarda uma cópia do que foi escolhido.** Mudar ou apagar um adicional no catálogo
  não muda agendamento já feito.
- Dinheiro é arredondado para centavos depois de cada soma (`Math.round(x * 100) / 100`).
- Mudança de API é **aditiva**, exceto a correção do §6, que é registrada como correção.

## Resumo

| # | Mudança | Fase | Por quê |
|---|---|---|---|
| 1 | `id` estável em cada adicional do serviço | 1 | Sem ele não há como apontar o item escolhido nem manter a referência se o nome mudar |
| 2 | Coluna `appointments.addons` | 1 | Guarda a cópia do que foi escolhido |
| 3 | `criarAgendamento` soma os adicionais ao `price` | 1 | Valor final e financeiro |
| 4 | `/marcar`: escolha com quantidade e total estimado | 1 | Pedido da Deborah |
| 5 | Painel: escolher ao criar e ajustar até ser pago | 1 | A contagem real só existe no atendimento |
| 6 | Troca de serviço recalcula o preço | 1 | Corrige defeito atual, que passaria a gerar valor errado |
| 7 | Textos que dizem "não entra no preço" | 1 | Passam a ser falsos |
| 8 | API v1 aceita e devolve adicionais | 2 | Canal de integração |
| 9 | Autoatendimento e `sola-agens` | 2 | Sem isso, o que entra pelo bot nasce com o preço base |

**Fora de escopo:** adicional não muda a duração do agendamento; não entra em orçamento
(`estimates`) nem em prontuário; não há relatório separado de adicionais (o valor conta dentro do
serviço em `porProcedimento`); ajuste depois da criação pela API v1 ou pelo bot; variável de
adicionais nos modelos de WhatsApp; preenchimento pelo chat do `/marcar` (contrato 08 não construído).

## Decisões

| # | Decisão | Quem | Alternativa descartada e motivo |
|---|---|---|---|
| A1 | Cliente informa a quantidade no `/marcar` e vê o total estimado | Sérgio | Só marcar e contar 1: total subestimado e ajuste manual sempre |
| A2 | Ajuste permitido até ser pago, inclusive em `arrived` e `completed` | Sérgio | Só até concluir: quem conclui antes de lançar ficaria com valor errado sem correção |
| A3 | Todos os canais escolhem ao criar, em duas fases | Sérgio | Só painel e `/marcar`: bot nasceria com preço base |
| A4 | Trocar de serviço recalcula o preço e limpa os adicionais; pago recusa | Sérgio | Manter como hoje: valor errado em silêncio, herdado pelo financeiro |
| A5 | Catálogo continua em JSONB, com `id` por item; agendamento guarda JSONB próprio | Opus | Tabelas `service_addons` e `appointment_addons`: exigiriam RLS e grants novos sem ganho, porque o financeiro lê só `price` e a cópia precisa sobreviver ao catálogo de todo modo. Reavaliar se surgir relatório por adicional |
| A6 | Preço base é derivado: `price` menos a soma dos adicionais | Opus | Coluna `base_price`: dois campos que podem discordar. Nenhum caminho altera `price` fora do domínio |
| A7 | `pending` e `partially_paid` ajustam; `paid` e `refunded` não | Opus | "Pago" da A2 lido como só `paid`: alteraria valor de pagamento estornado |
| A8 | Ajuste não avisa o cliente pelo WhatsApp | Opus | Avisar: o ajuste acontece com a cliente presente |

---

## 1. AS-IS que este contrato muda

| Onde | Hoje |
|---|---|
| `lib/domain/agendamentos.ts`, `criarAgendamento` | `price: servico.preco ?? 0` |
| `lib/domain/agendamentos.ts`, `editarAgendamento` | `mudancas` não inclui `price`: trocar de serviço mantém o valor antigo |
| `lib/domain/status.ts` | `EDITAVEIS` = `pending`, `scheduled`, `confirmed`; `arrived` e `completed` não editam |
| `lib/adicionais.ts`, `Linha` | Item sem `id`: `{ name, price, unit }` |
| `web/components/services/service-addons-field.tsx` | Não conhece `id` |
| `app/(app)/agendamentos/page.tsx` e `clientes/[id]/page.tsx` | Serviços carregados sem `addons` |

Deborah tem 3 serviços com adicionais, todos com `price_from = false`. `authenticated` lê
`appointments` por grant de tabela: coluna nova não precisa de grant. `appointment_logs.action` é
texto sem CHECK.

---

## 2. Banco

Migration `supabase/migrations/<timestamp>_appointments_addons.sql`, aditiva:

```sql
alter table public.appointments
  add column if not exists addons jsonb not null default '[]'::jsonb;

alter table public.appointments
  drop constraint if exists appointments_addons_array,
  add constraint appointments_addons_array
    check (case when jsonb_typeof(addons) = 'array' then jsonb_array_length(addons) <= 10 else false end);

comment on column public.appointments.addons is
  'Cópia dos adicionais escolhidos: [{id, name, price, unit, quantity}]. price é o valor unitário da época. appointments.price já inclui a soma.';

update public.services s
set addons = (
  select coalesce(jsonb_agg(
    case when item ? 'id' then item else item || jsonb_build_object('id', gen_random_uuid()) end
    order by ordem
  ), '[]'::jsonb)
  from jsonb_array_elements(s.addons) with ordinality as t(item, ordem)
)
where exists (select 1 from jsonb_array_elements(s.addons) as e(item) where not e.item ? 'id');

comment on column public.services.addons is
  'Custos adicionais opcionais: [{id, name, price, unit}]. Até 10. Escolhidos no agendamento, somam ao appointments.price.';
```

**Ordem de deploy:** aplicar a migration, subir o código e rodar o `update` de novo. Ele é
idempotente. A segunda execução cobre quem salvou um serviço pelo código antigo nesse intervalo,
porque esse código descarta o `id`.

---

## 3. `lib/adicionais.ts`

Continua sem `server-only`. Acrescente:

- `Linha` ganha `id`. Na **leitura**, item sem `id` válido é descartado, como os outros inválidos.
  Na **escrita** (`validarAdicionais`), `id` é opcional: mantém o recebido e gera
  `crypto.randomUUID()` se faltar. `id` repetido na mesma lista é erro.
- `Adicional` ganha `id: string`.
- `service-addons-field.tsx` guarda e reenvia o `id` de cada linha. Sem isso, salvar o serviço troca
  os ids e quebra a referência.
- Tipo `AdicionalAplicado = { id; nome; valorUnitario; unidade; quantidade; total }`.
- `lerAdicionaisAplicados(valor: unknown): AdicionalAplicado[]`: leitura tolerante de
  `appointments.addons`, com `total` calculado.
- `somarAdicionais(itens: { valorUnitario: number; quantidade: number }[]): number`: arredondada.
  O formulário usa a mesma função para o total estimado, para a tela não divergir do servidor.

Os três contratos de catálogo ganham `id: uuid` no item (`ServiceAddon`, `AdicionalServico`,
`AdicionalPublico`), que é a referência usada ao agendar.

---

## 4. Domínio

### 4.1 `resolverAdicionais`

Função pura em `lib/domain/agendamentos.ts`:

```ts
function resolverAdicionais(
  catalogo: Adicional[],
  escolhidos: AdicionalEscolhido[],
  atuais: AdicionalAplicado[] = []
): AdicionalAplicado[]
```

Para cada item de `escolhidos`:

1. Está em `atuais`: mantém nome, valor e unidade da cópia, e só troca a quantidade. O ajuste nunca
   reprecifica o que já foi escolhido.
2. Senão, está em `catalogo`: copia do catálogo.
3. Senão: `DomainError("VALIDATION_ERROR", "Adicional não disponível para este serviço.")`.
4. `unidade === null` com `quantidade !== 1`:
   `DomainError("VALIDATION_ERROR", "Este adicional não aceita quantidade.")`.

### 4.2 Criar

`EntradaCriacao` ganha `adicionais?: AdicionalEscolhido[]`. Em `criarAgendamento`, depois de
`exigirServicoAtivo`:

```ts
const adicionais = resolverAdicionais(servico.adicionais, entrada.adicionais ?? [])
// insert:
price: arredondar((servico.preco ?? 0) + somarAdicionais(adicionais)),
addons: paraColuna(adicionais), // [{ id, name, price, unit, quantity }]
```

`SELECT`, `Linha` e `completo` passam a incluir `addons`; `AgendamentoCompleto` ganha
`adicionais: AdicionalAplicado[]`.

### 4.3 Ajustar

Nova regra pura em `status.ts`, usada nos dois lados como as demais:

```ts
export function podeAjustarAdicionais(s: Status, pagamento: string | null): boolean {
  return s !== "canceled" && s !== "no_show" && pagamento !== "paid" && pagamento !== "refunded"
}
```

`AcoesDisponiveis` ganha `adicionais: boolean`. Atualize o cabeçalho do arquivo: depois de
`completed`, registra-se pagamento **e ajustam-se adicionais enquanto não estiver pago** (A2).

Nova função:

```ts
export async function ajustarAdicionais(
  db: Db, ator: Ator, id: string, escolhidos: AdicionalEscolhido[]
): Promise<{ agendamento: AgendamentoCompleto; alterado: boolean }>
```

1. Só `canal === "painel"`; qualquer outro é `INVALID_TRANSITION`.
2. Carrega o agendamento. Sem `podeAjustarAdicionais`: `INVALID_TRANSITION`, com a mensagem
   "Agendamento pago: desfaça o pagamento para ajustar os adicionais." quando o motivo for pagamento.
3. Lê o catálogo do serviço **sem filtrar `is_active`**: serviço desativado depois de agendado ainda
   precisa fechar a conta. Sem `service_id`, catálogo vazio.
4. `novos = resolverAdicionais(catalogo, escolhidos, atuais)`.
5. `base = arredondar((atual.price ?? 0) - somarAdicionais(atuais))`;
   `novoPreco = arredondar(base + somarAdicionais(novos))`.
6. Mesma lista e mesmas quantidades: devolve `alterado: false`, sem escrever nem logar.
7. `update` de `price`, `addons` e `updated_at`, condicionado a `status`, `payment_status` **e**
   `price` iguais aos lidos. Zero linhas: `INVALID_TRANSITION` com `MSG_ALTERADO_POR_OUTRA_PESSOA`.
   É o que impede pagar e ajustar ao mesmo tempo.
8. `registrarLog` com ação `addons_updated` e detalhe `R$ 110,00 -> R$ 120,00`. Não notifica (A8).

---

## 5. Telas

### 5.1 Seletor compartilhado

`components/appointments/addons-picker.tsx`, controlado, usado no `/marcar` e nos diálogos do painel:

```ts
{ adicionais: Adicional[]; value: AdicionalEscolhido[]; onChange: (v: AdicionalEscolhido[]) => void }
```

Por item: nome e valor. Com `unidade`, seletor de quantidade de 0 a 20 com botões − e + de pelo
menos 44 px, onde 0 significa não escolhido. Sem `unidade`, checkbox. Não renderiza nada com lista
vazia. Use os tokens de tema, porque a página herda `theme-<nicho>` e `palette-<id>`.

### 5.2 `/marcar`

Em `public-booking-form.tsx`:

- O seletor aparece logo depois da escolha do serviço, com o título "Adicionais (opcional)".
- Trocar de serviço zera a seleção, inclusive com `?servico=`.
- `handleFinalSubmit` envia `addons` como JSON de `AdicionalEscolhido[]`. Sem seleção, envia `[]`.
- O bloco de valor mostra serviço, cada adicional com sua quantidade e "Total estimado", calculado
  com `somarAdicionais`, seguido de "O valor final é confirmado no atendimento."
- Com `precoAPartirDe`, o rótulo é "Total a partir de".
- Serviço sem preço (`preco` nulo ou 0): não mostra total; mostra só "Adicionais: + R$ X".
- `mobileSummary` e a tela de sucesso refletem o total estimado e os adicionais.

### 5.3 Actions

`createAppointmentCore` lê `addons` do `FormData`, valida com `AdicionaisEscolhidos` e repassa como
`adicionais`. JSON inválido responde "Adicionais inválidos." Vale para painel e público, depois dos
limites de requisição que já existem. Campo ausente equivale a `[]`.

Nova action `app/actions/adjust-appointment-addons.ts`: org pela sessão (`organizacaoDaSessao`), nunca
por argumento; `atorDoPainel(orgId, false)`; revalida `/agendamentos`, `/dashboard` e `/clientes`.

### 5.4 Painel

- `create-appointment-dialog.tsx`: seletor abaixo do serviço, zerado ao trocar de serviço.
- Selects que passam a trazer `addons`: lista de serviços em `agendamentos/page.tsx` e
  `clientes/[id]/page.tsx`; relação `services(...)` em `agendamentos/page.tsx`, `dashboard/page.tsx` e
  `clientes/[id]/page.tsx`, além de `addons` do próprio agendamento.
- Novo `components/appointments/adjust-addons-dialog.tsx`: seletor iniciado com a cópia do agendamento,
  serviço, adicionais e novo total. Item que saiu do catálogo continua na lista, com seus dados da cópia.
- Item "Ajustar adicionais" em `AppointmentCardActions` e `appointment-context-menu.tsx`, quando
  `acoes.adicionais` e houver adicional no catálogo do serviço ou no agendamento. Inclua em `temAcao`.
- Card do agendamento: lista os adicionais escolhidos.

---

## 6. Trocar de serviço (A4)

Em `editarAgendamento`, quando `servico.id !== atual.service_id`:

- Sem `podeAjustarAdicionais`: `INVALID_TRANSITION`, "Agendamento pago: desfaça o pagamento para
  trocar o serviço."
- Senão, `mudancas.price = servico.preco ?? 0` e `mudancas.addons = []`, e o `update` também condiciona
  a `payment_status` igual ao lido.

Sem troca de serviço, `price` e `addons` não são tocados. No painel, o diálogo de edição avisa que os
adicionais serão removidos. Isso muda `PATCH /appointments/{id}` da v1: entra no changelog como
**Corrigido**, e `docs/API.md` e a OpenAPI passam a dizer que o preço acompanha o serviço.

---

## 7. Textos a corrigir na fase 1

"Não entra no valor do agendamento" e equivalentes deixam de ser verdade em: comentários dos três
`catalogo.ts`, `lib/adicionais.ts`, `lib/domain/catalogo.ts`, descrições de `lib/openapi/v1.ts`,
`autoatendimento.ts` e `publica.ts`, `docs/API.md`, `docs/API_PUBLICA.md`, contrato autoatendimento 03,
e o item de adicionais em `CHANGELOG.md`, se ainda estiver em `Não publicado`. Não edite versão já lançada.

---

## 8. Fase 2: API v1

- `CreateAppointmentBody.addons`: `AppointmentAddonsInput.optional()`.
- `Appointment.addons`: `z.array(AppointmentAddon)`, sempre presente. `price` continua o campo e passa
  a ser documentado como total.
- `paraAppointment` e `lib/api/leitura-agendamentos.ts` passam a devolver `addons`.
- Adicional inválido responde `VALIDATION_ERROR`, pelo mapeamento existente de `DomainError`.
- Sem rota de ajuste: fora de escopo.

---

## 9. Fase 2: Autoatendimento e `sola-agens`

**Eliza** (versão do contrato continua `1`, tudo aditivo):

- `CriarAgendamentoBody.adicionais`: `AdicionaisEscolhidos.optional()`; `criarDoCliente` repassa ao domínio.
- `AgendamentoResumo` ganha `adicionais: z.array(AdicionalDoAgendamento)` e
  `valorTotal: z.number().nullable()`. Também chega ao contexto, que reaproveita o resumo.
- Remarcar mantém os adicionais: `editarAgendamento` não os toca sem troca de serviço.
- Descrição da OpenAPI: só oferecer adicional que o serviço tem; perguntar a quantidade quando houver
  `unidade`; apresentar o total como estimado; nunca inventar item nem calcular outro valor.
- Atualize `docs/contratos/autoatendimento/03` e `04` e `docs/API_AUTOATENDIMENTO.md`.

**`sola-agens`** (depois do deploy do Eliza, porque o corpo é `.strict()` e campo novo seria recusado):

- Atualize `internal/openapi/testdata/eliza.openapi.json` e o golden `eliza.tools.golden.json`. O
  gerador já aceita array no corpo (`schema.go`).
- `avaliacao/eliza.go`: o Eliza falso passa a devolver e aceitar adicionais, com um cenário de
  "manutenção com 2 unhas quebradas".
- `agentes/eliza.yaml`: regra de adicionais, nas mesmas palavras da descrição da OpenAPI.
- Registre em `sola-agens/CHANGELOG.md`, que tem versão própria.

---

## 10. Ordem de execução

**Fase 1**

1. Migration do §2, aplicada e conferida no catálogo do banco.
2. `lib/adicionais.ts`, `service-addons-field.tsx` e `id` nos três contratos de catálogo (§3).
3. Domínio: `resolverAdicionais`, criar, `podeAjustarAdicionais`, `ajustarAdicionais`, troca de serviço (§4, §6).
4. Actions (§5.3).
5. Seletor e `/marcar` (§5.1, §5.2).
6. Painel (§5.4).
7. Textos (§7), changelog e relatório.
8. **Revisão Opus**, merge, deploy e nova execução do `update` do §2.

**Fase 2**

9. API v1 (§8).
10. Autoatendimento (§9, Eliza). **Revisão Opus**, merge, deploy.
11. `sola-agens` (§9), com avaliação no Gemini real.

Cada passo termina com `tsc --noEmit` limpo. O projeto não tem test runner: a função pura
`resolverAdicionais` é verificada por script, e o resto pelo Aceite.

---

## 11. Aceite

Use tenant demo (`/demo/start`). Não crie dado de teste na org da Deborah.

**Fase 1**

- [ ] Depois da migration, todo item de `services.addons` tem `id`, e rodar o `update` de novo não altera nada.
- [ ] Salvar um serviço sem mexer nos adicionais mantém os mesmos ids.
- [ ] `/marcar`: serviço de R$ 110 com 2 unhas quebradas mostra R$ 120,00, e o agendamento nasce com `price = 120` e a cópia em `addons`.
- [ ] Trocar de serviço no `/marcar` zera a seleção.
- [ ] POST forjado com `id` de outro serviço é recusado; valor enviado junto é ignorado ou recusado, nunca gravado.
- [ ] Quantidade 21 e quantidade 2 em adicional sem unidade são recusadas.
- [ ] Mudar o valor no catálogo não altera agendamento existente, nem depois de ajustar a quantidade de item já escolhido.
- [ ] Apagar o adicional do catálogo: o agendamento mantém a cópia, e o ajuste ainda o mostra.
- [ ] Ajuste em `arrived` e em `completed` não pago atualiza `price`, e finanças e dashboard mostram o valor novo sem nenhuma mudança neles.
- [ ] Agendamento `paid` não oferece o ajuste; desfazer o pagamento volta a oferecer.
- [ ] `canceled` e `no_show` não oferecem o ajuste.
- [ ] Trocar de serviço em agendamento com adicionais: `price` vira o do novo serviço e `addons` fica `[]`; pago é recusado.
- [ ] Editar só a observação não muda `price` nem `addons`.
- [ ] Agendamento antigo (`addons = []`) continua igual em todas as telas.
- [ ] `/marcar` e diálogos conferidos em 375 px, e a tela mostra o mesmo total gravado.

**Fase 2**

- [ ] `POST /api/v1/appointments` com `addons` grava o total; sem o campo, comportamento igual ao de hoje.
- [ ] `GET` devolve `addons`, `[]` quando não há.
- [ ] `POST /autoatendimento/agendamentos` com `adicionais` grava o total, e o resumo traz `valorTotal`.
- [ ] Remarcar pelo bot mantém adicionais e `price`.
- [ ] Conversa real: a atendente oferece só adicionais do serviço, pergunta a quantidade e informa o total como estimado.
