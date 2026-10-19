# API pública (`/api/public/v1`) — contrato

> **AS-IS** · §1 implementado em `de33f29`; §2–§5 executados em 2026-10-19 (merge `09f83e2` na `development`, sem deploy) · relatório: [RELATORIO_API_PUBLICA.md](../../RELATORIO_API_PUBLICA.md)
> **Escrito em:** 2026-10-19 · **Origem:** LP da Deborah (`SolaSoftware/clientes/deborah/lp/docs/ELIZA_CATALOGO.md`, decisões D1–D5)
> **Zod tocados:** `web/contracts/publico/catalogo.ts`, `web/contracts/api-v1/catalogo.ts`, `web/contracts/autoatendimento/catalogo.ts`
> Guia de consumo: [API_PUBLICA.md](../../API_PUBLICA.md)

## Para quem executa

Os `.md` dizem **o que** e **por quê**; os Zod são a forma exata. Onde este arquivo der um valor
fechado, use o valor. Se o código contradisser uma premissa daqui, o código vence: pare, registre
no relatório e siga o que é correto. Branch `development`; nada vai para a `main` sem revisão Opus.
Relatório da execução: `docs/RELATORIO_API_PUBLICA.md`.

**Regras que não se negociam:**

- A rota pública só devolve o que já aparece em `/marcar/[slug]`. Nunca `organization_id`, `color`,
  `created_at`, profissional, cliente ou agenda. Schemas `.strict()`.
- Escrita em `services` continua pelo caminho que já existe (`app/actions/create-service.ts`); este
  contrato só **acrescenta** um campo. Não migrar a action para o domínio aqui.
- Toda mudança de API é **aditiva**: campo novo, opcional na leitura, nunca renomear/remover.

## Resumo

| # | Mudança | Tipo | Por quê |
|---|---|---|---|
| 1 | `GET /api/public/v1/orgs/{slug}/catalogo` + `?servico=` no `/marcar` | AS-IS | Site estático do cliente não pode ter token |
| 2 | Coluna `services.category` + campo no formulário de serviço | TO-BE | D2: agrupar variações do mesmo serviço (ex.: alongamento molde/fibra) |
| 3 | Categoria nas três APIs (`categoria` / `category`) | TO-BE | D2, decidido por Sérgio em 2026-10-19: "em tudo" |
| 4 | OpenAPI da API pública + entrada no Swagger | TO-BE | Mesma regra das outras APIs: a spec é gerada do Zod |
| 5 | Script de verificação de contrato da rota pública | TO-BE | Pegar campo vazado/cabeçalho errado sem depender de olho |

---

## 1. AS-IS — o que já existe

`web/app/api/public/v1/orgs/[slug]/catalogo/route.ts`: sem autenticação, sem cookie, sem auditoria.
Org pelo slug (`organizations` com `id, name, slug`, client service role), serviços por
`listarServicosAtivos` (`lib/domain/catalogo.ts`), mapeados para `ServicoPublico`. Resposta validada por
`CatalogoPublicoResposta.safeParse`; falha → `500 INTERNAL_ERROR`.

| Item | Valor |
|---|---|
| Sucesso | `{ data: { organizacao: { nome, slug }, servicos: ServicoPublico[], atualizadoEm } }` |
| `ServicoPublico` | `id, nome, descricao, duracaoMinutos, preco, categoria` (`categoria` hoje sempre `null`) |
| Limite | 30 serviços, ordem por título |
| Erros | `404 NOT_FOUND` (slug inexistente ou fora de `^[a-z0-9-]{1,60}$`, mesma resposta), `429 RATE_LIMITED` + `Retry-After`, `500 INTERNAL_ERROR` |
| CORS | Origem exata de `LP_PUBLIC_ORIGINS`; fora da lista, sem `Access-Control-Allow-Origin`. `OPTIONS` → 204 |
| Cache | `public, max-age=30, stale-while-revalidate=300`; `ETag` do conteúdo sem `atualizadoEm`; `If-None-Match` → 304 |
| Taxa | 120/min por IP (hash), `consume_demo_rate_limit`, prefixo `lpcat`, fail-closed |
| Middleware | `middleware.ts` exclui `api/public` do matcher |

Deep link: `app/marcar/[slug]/page.tsx` lê `?servico=<id>`; se for serviço ativo da org, passa
`initialServiceId` ao `PublicBookingForm`, que usa como `defaultValues.service_id`. Qualquer outro valor é ignorado.

**D1 (preço 0) fechada como AS-IS:** a API devolve `0` como `0` em todas as superfícies. Quem consome
decide como mostrar (a LP mostra "Consulte"). Origem do `0`: `upsertService` faz `Number(formData.get('price'))`,
então campo vazio grava `0`. Não mudar neste contrato.

---

## 2. Coluna `services.category`

### 2.1 Migration

Arquivo `supabase/migrations/<timestamp>_services_category.sql` (DDL sempre como migration, nunca à mão):

```sql
alter table public.services
  add column if not exists category text
  check (category is null or (char_length(btrim(category)) between 1 and 40));

comment on column public.services.category is
  'Agrupamento opcional exibido em sites/canais públicos (ex.: "Alongamento"). null = sem grupo.';
```

- Sem índice (catálogo de no máximo dezenas de linhas por org).
- Grants: a coluna nova herda os grants de tabela. **Conferir** com
  `select grantee, privilege_type from information_schema.column_privileges where table_name='services' and column_name='category'`
  que `anon` tem `SELECT` (a página pública e a policy anon já leem `services`). Se `services` tiver grant
  por coluna para `anon`, acrescentar `grant select (category) on public.services to anon;`. Registrar no relatório.
- Depois de aplicar: regenerar `web/utils/database.types.ts` (`supabase gen types` / MCP
  `generate_typescript_types`), nunca editar à mão.

**Ordem de deploy:** a migration vai **antes** do código (o código passa a selecionar `category`; sem a
coluna, toda listagem de serviço quebra com 42703). É aditiva e inofensiva para o código atual.

### 2.2 Domínio (`lib/domain/catalogo.ts`)

- `COLUNAS_SERVICO` ganha `category`.
- `Servico` ganha `categoria: string | null`; `LinhaServico` ganha `category: string | null`.
- `paraServico`: `categoria: linha.category?.trim() ? linha.category.trim() : null`.

Consequência: `/marcar/[slug]`, as duas APIs e a rota pública passam a receber o campo pelo mesmo caminho.

### 2.3 Formulário e action

`components/services/create-service-dialog.tsx`: campo de texto **opcional** "Categoria", `name="category"`,
`maxLength={40}`, abaixo do nome, placeholder do nicho (ex.: "Ex.: Alongamento"), com o texto de ajuda
"Serviços com a mesma categoria aparecem juntos no seu site." Ao editar, vem preenchido com o valor atual.
O dialog usa os textos do keckleon (`actions.edit`, `servico`): seguir o mesmo padrão; se não houver chave
para o rótulo, texto fixo em português.

`app/actions/create-service.ts` (`upsertService`): ler `category`, `trim()`, vazio → `null`, cortar em 40;
incluir em `serviceData`. Nada mais muda na action.

Se a página `app/(app)/servicos/page.tsx` monta a lista com `select` explícito, incluir `category` no que
alimenta o dialog de edição. Mostrar a categoria na lista é opcional (chip discreto); não é requisito.

---

## 3. Categoria nas três APIs

| Superfície | Zod | Campo | Mapeamento |
|---|---|---|---|
| Pública | `contracts/publico/catalogo.ts` `ServicoPublico` | `categoria: string(max 40) \| null` (já existe) | `s.categoria` (hoje está fixo `null` na rota: trocar) |
| v1 B2B | `contracts/api-v1/catalogo.ts` `Service` | `category: z.string().nullable()` | `paraService` em `lib/api/serializar.ts`: `category: s.categoria` |
| Autoatendimento | `contracts/autoatendimento/catalogo.ts` `Servico` | `categoria: z.string().nullable()` | `app/api/v1/autoatendimento/servicos/route.ts`: `categoria: s.categoria` |

- Campo sempre presente (`null` quando vazio), não opcional: quem consome não precisa distinguir ausência.
- O header de versão do Autoatendimento continua `1` (revisão aditiva, mesma regra do contrato 07 / C8).
- Nenhuma rota de escrita das APIs ganha `category` (catálogo é editado só pelo painel).
- Atualizar `docs/API.md` (tabela de `Service`), `docs/API_AUTOATENDIMENTO.md` e `docs/API_PUBLICA.md`
  (tirar "sempre null").

---

## 4. OpenAPI da API pública

Mesmo padrão de `lib/openapi/v1.ts`:

- `lib/openapi/publica.ts` exporta `gerarOpenApiPublica({ origem })`, gerado de `CatalogoPublicoResposta`
  e `ApiErrorBody`. Uma operação: `GET /api/public/v1/orgs/{slug}/catalogo`, `operationId: obterCatalogoPublico`,
  `security: []`, respostas 200, 304, 404, 429 (com header `Retry-After`) e 500. Descrever CORS e cache no `description`.
  Exportar em `lib/openapi/index.ts`.
- Rota `app/api/public/v1/openapi.json/route.ts`: igual à de `api/v1/openapi.json` (documentação é pública,
  `Cache-Control: no-store`).
- `lib/openapi/swagger-ui.ts`: terceira entrada no seletor, `{ url: "/api/public/v1/openapi.json", name: "API pública (sites)" }`,
  sempre visível (não depende de `docsInternasLiberadas`). Conferir que a CSP da página (`CSP_DA_PAGINA`) permite
  buscar o novo caminho (mesma origem; deve bastar).
- Sem `x-atendente` (não é ferramenta do sola-agens).

---

## 5. Verificação de contrato

O Eliza não tem test runner, e este contrato **não** introduz um. Criar `web/scripts/verificar-api-publica.mjs`
(Node puro, `fetch`, sem dependência), no estilo de `web/scripts/ticket-dev.mjs`:

```
node web/scripts/verificar-api-publica.mjs <base-url> <slug> [origem-permitida]
# ex.: node web/scripts/verificar-api-publica.mjs http://localhost:3001 admin http://localhost:3200
```

Checa e sai com código 1 na primeira falha, imprimindo o que falhou:

1. `200`; chaves de topo exatamente `["data"]`; `data` exatamente `organizacao, servicos, atualizadoEm`;
   cada serviço exatamente `id, nome, descricao, duracaoMinutos, preco, categoria` (lista fechada **no script**:
   campo novo reprova, de propósito).
2. Sem `set-cookie`; `cache-control` igual ao do §1; `etag` presente.
3. Com `If-None-Match: <etag>` → `304`.
4. Slug inexistente (`nao-existe-<aleatório>`) e slug inválido (`BAD!`) → `404` com corpo idêntico exceto `request_id`.
5. Com `[origem-permitida]`: `access-control-allow-origin` igual a ela; com `Origin: https://exemplo.invalid` → sem o cabeçalho.
6. `OPTIONS` com origem permitida → `204`.

Não testa o 429 (gastaria a cota do IP local): anotar no relatório como verificado à parte ou não verificado.
Documentar o comando em `docs/API_PUBLICA.md`.

---

## 6. O que não muda

- Envelope e códigos (`contracts/comum/envelope.ts`), limites e cabeçalhos da rota pública.
- Regras de horário, agendamento e status (00-dominio).
- RLS/policies de `services` (só a coluna nova; grants conferidos no §2.1).
- `upsertService` continua com client de sessão; D1 (preço 0) continua como está.

## 7. Ordem de execução

1. Migration §2.1 (aplicar via MCP Supabase no projeto `ttrzlxuqyrqxgbztfmwv`) + conferência de grants + tipos regenerados. Commit.
2. Domínio §2.2 + formulário/action §2.3. `tsc` e browser (criar e editar serviço com e sem categoria). Commit.
3. APIs §3 + docs. Commit.
4. OpenAPI §4. Abrir `/api/v1/docs` e conferir as três specs. Commit.
5. Script §5, rodar contra o dev local com a org `admin`. Relatório. Commit.

Um commit por passo, mensagem no padrão do repo (`feat(api-publica): ...`), com o rodapé de coautoria.
Não fazer push nem PR: isso é do Sérgio depois da revisão Opus.

## 8. Aceite

- [ ] `services.category` existe com o check; `anon` lê a coluna; `database.types.ts` regenerado.
- [ ] Criar serviço com categoria "Alongamento" e editar removendo (vazio → `null`) funcionam no painel.
- [ ] Rota pública, `GET /api/v1/services` e `GET /api/v1/autoatendimento/servicos` devolvem a categoria
      (testar a v1 com `ELIZA_TEST_API_KEY` do `web/.env.local`; o autoatendimento com `web/scripts/ticket-dev.mjs`).
- [ ] `/marcar/admin` continua funcionando, inclusive `?servico=<id>`.
- [ ] `/api/public/v1/openapi.json` válido e visível no Swagger, ao lado das outras duas specs.
- [ ] `verificar-api-publica.mjs` passa contra o local; reprova se um campo extra for acrescentado à resposta (testar e reverter).
- [ ] `tsc --noEmit` sem erro novo (o erro pré-existente em `public-booking-form.tsx:~319`, `success` em união, não é deste contrato; registrar se ainda existir).
- [ ] LP da Deborah (`npm run dev` na :3200 com `NEXT_PUBLIC_ELIZA_ORG=admin`) agrupa dois serviços com a mesma categoria numa ilha.

## 9. Decisões deste contrato

| # | Decisão | Quem/quando |
|---|---|---|
| P1 | Categoria em todas as superfícies (pública, v1, autoatendimento) | Sérgio, 2026-10-19 |
| P2 | Preço 0 continua 0 nas APIs (fecha D1 da LP) | Opus, segue contrato 03 do autoatendimento |
| P3 | Categoria texto livre por serviço, sem tabela de categorias | Opus: dezenas de serviços por org; tabela só se surgir ordenação/ícone por categoria |
| P4 | Verificação por script, sem test runner novo | Opus: preferência por ferramenta leve; o repo não tem runner |

## 10. Fora deste contrato

- **Tema da página `/marcar` com a paleta do cliente (D5 da LP):** hoje o tema vem só do nicho (`theme-${niche}`).
  Paleta por org é mudança do keckleon, não da API. Contrato próprio quando a Deborah tiver org.
- **Domínio da LP no CORS (D4):** configuração (`LP_PUBLIC_ORIGINS` na VPS), não código.
- **Coletor de analytics da LP (`lp-collect`):** Edge Function no Supabase, rascunho na LP, bloqueada pela política de privacidade.
- **Horários livres públicos para a LP:** não pedido; o agendamento acontece em `/marcar`.
- Migrar `upsertService` para `lib/domain` com service role.
