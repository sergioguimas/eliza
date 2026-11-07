# 11 — Agenda visível por N dias (e agenda fechada)

> TO-BE · Contrato v1, **revisão aditiva** (o header de versão continua `1`, ver C8) · ver [README](README.md)
> **Escrito em:** 2026-11-07 · **Origem:** pedido da Deborah (migração do Google Agenda para o Eliza: o atendente
> oferecia como livres horários que ela ainda ia lançar) + ideia do Sérgio de visualização configurável por tenant.
> **Zod tocados:** `comum/envelope.ts`, `autoatendimento/contexto.ts`, `autoatendimento/mensagens.ts`
> **Migration:** `supabase/migrations/20261107140000_organization_settings_agenda_visivel.sql` (**já aplicada** no
> Supabase em 07/11, aditiva; `utils/database.types.ts` já tem a coluna)
> **Repos:** Eliza (§1–§7) e sola-agens (§8)

## Para quem executa

Mesmas regras do [README](README.md#para-quem-executa): os `.md` dizem **o que** e **por quê**; os Zod são a forma
exata. Onde este arquivo der um valor fechado, use o valor. Se o código contradisser uma premissa daqui, o código
vence: pare, registre e siga o que é correto. Não aplique migration nem rode SQL de escrita no Supabase: o banco é o
de produção.

## Resumo

| # | Mudança | Por quê |
|---|---|---|
| 1 | Coluna `organization_settings.agenda_visivel_dias` (0–365, padrão 60) | Um ajuste por tenant, no núcleo (o `/marcar` não é add-on) |
| 2 | Autoatendimento lê a janela dessa coluna; `janela_maxima_dias` fica obsoleta | Uma fonte só para atendente e `/marcar` |
| 3 | `0` = agenda fechada: horários, criar e remarcar respondem `AGENDA_FECHADA` | O atendente só faz triagem e o responsável finaliza |
| 4 | `/marcar` respeita a janela; com `0` mostra aviso no lugar do formulário | Mesmo conflito da migração existe na página pública |
| 5 | Campo em Configurações → Preferências | Hoje a janela só muda por SQL |
| 6 | `x-atendente-agenda` nas operações de agenda e motivo `triagem` | O sola-agens esconde essas ferramentas sem conhecer nomes do Eliza |
| 7 | sola-agens: modo triagem quando a janela é 0 | O pedido em si |

## Regra (vale para todo o contrato)

`agenda_visivel_dias = N` define o intervalo de datas **[hoje, hoje + N]** (datas locais, `America/Sao_Paulo`, como
`dataLocal`/`somarDias` já fazem) em que o **atendente** (API de Autoatendimento, WhatsApp e canal web) e a página
pública **`/marcar`** podem mostrar horário livre e criar/remarcar agendamento.

- `N = 0` é **agenda fechada**: nenhuma data vale, nem hoje. Não é "só hoje".
- `N ≥ 1`: igual à janela de hoje (o teste `data > somarDias(hoje, N)` continua o mesmo).
- **Não** se aplica a: painel (equipe logada), API v1 (integrações com chave), confirmar e cancelar pelo atendente.
  Cancelar e confirmar continuam funcionando com a agenda fechada: a cliente precisa poder desmarcar.
- A antecedência mínima (`antecedencia_minima_minutos`) continua no autoatendimento, sem mudança.

---

## 1. Banco (feito)

`organization_settings.agenda_visivel_dias integer not null default 60`, CHECK `0..365`. Toda org já tem linha em
`organization_settings` (conferido: 10 de 10), mas quem ler deve tratar linha ausente como **60**.
`autoatendimento_config.janela_maxima_dias` ganhou comentário de OBSOLETO: o código **para de ler** essa coluna. Não
remover a coluna nem o CHECK dela (sai numa MAIOR).

## 2. Helper de leitura

Criar em `web/lib/domain/agenda-visivel.ts` (server-only, sem dependência de autoatendimento):

```ts
export const AGENDA_VISIVEL_PADRAO = 60
/** Dias à frente que atendente e /marcar podem usar. Linha ausente = padrão. */
export async function lerAgendaVisivelDias(db: Db, orgId: string): Promise<number>
/** Pura: a data local `data` (AAAA-MM-DD) está em [hoje, hoje + dias]? dias=0 => sempre false. */
export function dentroDaAgendaVisivel(data: string, hoje: string, dias: number): boolean
```

`dentroDaAgendaVisivel` é a única implementação da regra; autoatendimento e `/marcar` usam ela. Teste unitário em
`web/tests/` (node --test, padrão de `tests/clientes.test.mjs`): 0 recusa hoje; 1 aceita hoje e amanhã, recusa
depois de amanhã e ontem.

## 3. Autoatendimento

### 3.1 Config

`carregarConfig` (`lib/autoatendimento/config.ts`) passa a preencher `janelaMaximaDias` com
`lerAgendaVisivelDias`. O resto da config não muda. Nenhum outro código lê `janela_maxima_dias`.

### 3.2 Erro novo

`comum/envelope.ts`: código `AGENDA_FECHADA`, HTTP **422** (mesma família de `OUT_OF_WINDOW`), comentário
`autoatendimento e /marcar: a org fechou a agenda (agenda_visivel_dias = 0)`.

### 3.3 Onde

- `consultarHorarios` (`lib/autoatendimento/horarios.ts`): com janela 0, depois de validar serviço/profissional e a
  data de calendário, `ApiError("AGENDA_FECHADA", "A agenda está fechada para marcação automática no momento; a equipe
  vai combinar o horário com você.")`. Com janela ≥ 1, comportamento atual (`OUT_OF_WINDOW`), usando
  `dentroDaAgendaVisivel`.
- `validarJanelaEAntecedencia` (`lib/autoatendimento/escrita.ts`, criar e remarcar): mesma regra e mesma mensagem,
  antes da antecedência.
- Cancelar e confirmar: sem mudança.

### 3.4 Contexto

`contracts/autoatendimento/contexto.ts`: `politica.janelaMaximaDias` passa de `.positive()` para `.nonnegative()`,
com comentário `0 = agenda fechada: o atendente não oferece horário, faz triagem e chama a equipe (motivo triagem)`.
O valor é o da coluna nova (vem da config, §3.1).

### 3.5 Motivo `triagem`

`contracts/autoatendimento/mensagens.ts`: `EscalonarBody.motivo` ganha `"triagem"`. Em
`lib/autoatendimento/escalonamento.ts`, `ROTULO_DO_MOTIVO.triagem = "agenda fechada para o atendimento automático: o
cliente quer marcar, finalize o horário com ele"`.

### 3.6 OpenAPI (`lib/openapi/autoatendimento.ts`)

- `"x-atendente-agenda": true` (mesmo nível de `x-atendente`) **exatamente** em `consultarHorarios`,
  `criarAgendamento` e `remarcarAgendamento`.
- Na seção "Operações do atendente" da descrição, um parágrafo: operações com `x-atendente-agenda: true` dependem da
  agenda aberta; com `politica.janelaMaximaDias = 0` o atendente não deve oferecê-las e elas respondem
  `AGENDA_FECHADA`.
- Atualizar a documentação de erros (onde `OUT_OF_WINDOW` aparece) com `AGENDA_FECHADA`, e o enum de motivo.
- O exemplo de `politica` pode ficar com 60.

## 4. Página pública `/marcar`

- `app/marcar/[slug]/page.tsx` lê `agenda_visivel_dias` da org (service role, como o resto da página) e passa ao
  formulário.
- **N = 0:** a página **não** renderiza o formulário nem o chat (`chat-flutuante`/`chat-agendamento`). No lugar, um
  cartão no mesmo estilo da página: título "Agenda online fechada no momento" e texto "Para marcar um horário, fale
  diretamente com {nome da org}." (o Eliza não guarda telefone da org; não inventar link).
- **N ≥ 1:** o calendário do formulário desabilita datas depois de `hoje + N` (além das regras atuais, que ficam).
- `getAvailableSlots` (`app/actions/get-available-slots.ts`): data fora de `dentroDaAgendaVisivel` devolve
  `{ slots: [] }` com um `reason` novo `"outside_window"` e mensagem "Data fora do período liberado para agendamento
  online." (ou `"agenda_closed"`/"A agenda online está fechada no momento." quando N = 0). Ajustar o tipo
  `AvailableSlotsReason`.
- `createPublicAppointment` → `criarAgendamento` com `canal: "publico"`: recusar no domínio
  (`lib/domain/agendamentos.ts`, só para `ator.canal === "publico"`) com `DomainError("VALIDATION_ERROR", ...)`
  usando as mesmas mensagens acima, **antes** de validar horário e cliente. Painel e API v1 não passam por isso.

## 5. Configurações

Em Configurações → Preferências (`components/settings/preferences-form.tsx`, bloco `form_type === "schedule"`), campo
numérico "Agenda visível para clientes (dias)", inteiro 0–365, com ajuda curta:

> Até quantos dias à frente o atendente automático e a página de agendamento podem mostrar e marcar horários.
> Use 0 para fechar a agenda: o atendente só anota o pedido e passa a conversa para você.

`app/actions/update-preferences.ts` (schedule): ler `agenda_visivel_dias`, exigir inteiro 0–365 (senão
`{ error: "Agenda visível deve ser um número de 0 a 365." }`) e gravar junto do resto. A página que monta o
formulário passa o valor atual (padrão 60).

## 6. O que não muda

Painel, API v1 (rotas e OpenAPI v1), lembretes, cancelar/confirmar pelo atendente, antecedência mínima,
`canal_web`, versão do contrato (`1`).

## 7. Ordem de execução e aceite (Eliza)

1. Zod (§3.2, §3.4, §3.5) → helper (§2) + teste → config/horários/escrita (§3) → OpenAPI (§3.6) → `/marcar` (§4) →
   Configurações (§5) → `CHANGELOG.md` em `[Não publicado]`.
2. `npm test` e `npx tsc --noEmit` limpos em `web/`.

Aceite:
- [ ] Org com 0: `GET /horarios` e `POST /agendamentos` → 422 `AGENDA_FECHADA`; cancelar/confirmar → como antes.
- [ ] Org com 1: horário de depois de amanhã → `OUT_OF_WINDOW`; amanhã → normal.
- [ ] `GET /contexto` com 0 passa no Zod (`politica.janelaMaximaDias: 0`).
- [ ] `POST /escalonamentos` com `motivo: "triagem"` → 200, rótulo da §3.5 na mensagem à equipe.
- [ ] OpenAPI servida tem `x-atendente-agenda: true` só nas três operações.
- [ ] `/marcar` com 0: cartão no lugar do formulário e sem chat; com N: datas depois de hoje+N desabilitadas; envio
      forjado fora da janela é recusado no servidor.
- [ ] Configurações grava 0, 30 e 365; recusa -1, 366 e texto.

## 8. sola-agens

O agente lê esta OpenAPI. Mudanças (repo `Projetos/sola-agens`, Go):

1. **`internal/openapi`:** `Ferramenta` ganha `Agenda bool`, lido de `x-atendente-agenda` (como `Publica`). Teste no
   `openapi_test.go`.
2. **Ferramentas do turno (`internal/agent`):** quando `contexto.Politica.JanelaMaximaDias == 0`, as ferramentas com
   `Agenda` **não** entram em `decls()` (WhatsApp e web) **e** uma chamada a elas é tratada como ferramenta
   desconhecida (o LLM pode alucinar o nome). Com janela ≥ 1, nada muda.
3. **Prompt WhatsApp (`prompt.go`):** com janela 0:
   - a linha "Política" diz `agenda fechada para marcação automática` no lugar de "até N dias à frente";
   - a regra "Para marcar" é trocada por um bloco **MODO TRIAGEM**: não ofereça, não consulte e não prometa horário;
     descubra o serviço (pode usar `listarServicos`) e a preferência de dia e turno; avise que a equipe vai confirmar
     o horário pessoalmente; chame `chamar_humano(motivo=triagem)` com um resumo (serviço, preferência, nome) **uma
     vez** por pedido, na mesma resposta em que avisa a cliente; pedido de remarcar também vira triagem;
   - cancelar e confirmar seguem as regras atuais.
4. **Prompt web (`prompt_web.go`):** com janela 0 o `/marcar` nem mostra o chat; ainda assim, se chegar turno web,
   responda que a agenda online está fechada e que a cliente fale com o estabelecimento; sem ferramentas de agenda
   e sem `preencher_agendamento`.
5. **`motivosHumano`** (`run.go`) ganha `triagem`. O fallback para `outro` que já existe é só do escalonamento de falha técnica; para Eliza antigo, `chamarHumano` com `triagem` recusado (`ErrSistema`) tenta de novo com `fora_da_politica` (corrigido na revisão).
6. Testes: `prompt_test.go` (bloco de triagem só com 0; política com N), teste do filtro de ferramentas com 0 e com
   N, motivo `triagem` aceito. `go test ./...` limpo.
7. `CHANGELOG.md` do agens em `[Não publicado]`; nota curta em `specs/02-ferramentas-e-prompt.md` (motivo novo e
   modo triagem) e decisão em `docs/DECISOES.md` se o arquivo registrar decisões numeradas.

**Ordem de deploy:** Eliza primeiro (aceita `triagem`, serve as marcas e o 0), depois o agens. Agens antigo com
Eliza novo: as ferramentas de agenda respondem `AGENDA_FECHADA` e o LLM explica o erro, sem quebrar. Só depois dos
dois, trocar a Deborah do fechamento temporário (`clientes/deborah/agenda-fechada-2026-11-07.sql`) para
`agenda_visivel_dias = 0`.

## 9. Decisões deste contrato

| # | Decisão | Alternativa descartada | Por quê |
|---|---|---|---|
| C13 | Janela no núcleo (`organization_settings`), uma para atendente e `/marcar` | Reaproveitar `autoatendimento_config.janela_maxima_dias` | `/marcar` é núcleo; o add-on pode sair sem levar a regra; config do add-on não tem tela nem é criada pelo código |
| C14 | `0` = fechada (nem hoje) | `0` = só hoje | Pedido do Sérgio: 0 não mostra nenhum horário |
| C15 | Marca `x-atendente-agenda` na OpenAPI | Lista de operationIds no yaml do agens | O agens segue genérico: o sistema diz o que é agenda |
| C16 | Cancelar/confirmar livres com a agenda fechada | Fechar tudo | A cliente precisa desmarcar; não mostra horário livre |
| C17 | `/marcar` com 0 sem link de contato | Link de WhatsApp | O Eliza não guarda telefone da org; não inventar |
