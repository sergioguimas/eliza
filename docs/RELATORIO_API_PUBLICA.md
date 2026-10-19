# Relatório — API pública e categoria de serviço

> Execução do contrato [`docs/contratos/api-publica/README.md`](contratos/api-publica/README.md) · 2026-10-19 · branch `claude/api-publica-categoria-74fae3`
> Sem push e sem PR (revisão Opus pendente).

## Commits (um por passo)

| # | Commit | Conteúdo |
|---|---|---|
| 1 | `9232627` | Migration `20261019120000_services_category.sql` + `database.types.ts` |
| 2 | `a84d027` | `lib/domain/catalogo.ts`, `create-service-dialog.tsx`, `create-service.ts` |
| 3 | `af53498` | Categoria nas 3 APIs + `API.md`, `API_AUTOATENDIMENTO.md`, `API_PUBLICA.md` |
| 4 | `d6f2f4e` | `lib/openapi/publica.ts`, rota `openapi.json`, 3ª entrada no Swagger |
| 5 | último | `scripts/verificar-api-publica.mjs`, seção no `API_PUBLICA.md`, este relatório |

(`git log --oneline` tem os hashes exatos.)

## Passo 1 — migration

- Aplicada no projeto `ttrzlxuqyrqxgbztfmwv` via MCP Supabase (`apply_migration`, nome `services_category`), com o mesmo SQL do arquivo.
  O MCP estava sem permissão no início da sessão; Sérgio liberou e a aplicação seguiu.
- Grants (`information_schema.column_privileges`): `anon` tem `SELECT`, `INSERT`, `UPDATE`, `REFERENCES` na coluna
  (herdados do grant de tabela); `authenticated`, `postgres` e `service_role` idem. Não foi preciso `grant select (category)`.
- `database.types.ts`: o MCP `generate_typescript_types` devolveu o arquivo inteiro; a única diferença para o versionado era
  `category` nos três blocos de `services` (Row/Insert/Update). Apliquei só essas 3 linhas (resultado idêntico ao gerado,
  preservando BOM e CRLF do arquivo), em vez de colar 45 KB.

## Passo 2 — domínio, formulário, action

- `Servico.categoria`, `COLUNAS_SERVICO` com `category`, `paraServico` com trim → `null`.
- Dialog: campo "Categoria (opcional)", `maxLength=40`, placeholder "Ex.: Alongamento", texto de ajuda; vem preenchido ao editar.
  Rótulo em texto fixo (não existe chave no dicionário keckleon).
- Action: `trim()`, vazio → `null`, `slice(0, 40)`.
- `servicos/page.tsx` usa `select("*")`: `category` já chega ao dialog; nada a mudar. Não mostrei chip na lista (opcional).
- Verificado no navegador (org demo de manicure, `/demo/start`): editar "Alongamento em gel" com categoria "Alongamento" gravou
  `Alongamento`; reabrir veio preenchido; trocar por espaços gravou `null` (conferido por SQL nas duas vezes).
  **Não** testei o fluxo de *criar* serviço novo pelo botão (a action é a mesma, o ramo `insert` só difere no `serviceData`, que leva `category`).

## Passo 3 — APIs (testadas no dev local :3002, org `admin`)

Para ter dado, defini `category = 'Alongamento'` em dois serviços da org `admin` (Alongamento e Manutenção) no banco real.
Isso é dado de teste na org-modelo; reverta se preferir (`update services set category = null where ...`).

| Superfície | Resultado |
|---|---|
| Pública `GET /api/public/v1/orgs/admin/catalogo` | `categoria: "Alongamento"` nos dois, `null` nos outros |
| v1 `GET /api/v1/services` (`ELIZA_TEST_API_KEY`) | `category` presente |
| Autoatendimento `GET /api/v1/autoatendimento/servicos` (ticket do `ticket-dev.mjs`) | `categoria` presente, header de versão continua `1` |
| `/marcar/admin` e `?servico=<id>` | 200 nos dois |

## Passo 4 — OpenAPI

- `GET /api/public/v1/openapi.json` válido (OpenAPI 3.1, 1 operação `obterCatalogoPublico`, respostas 200/304/404/429/500,
  `Retry-After` no 429, `security: []`).
- Swagger (`/api/v1/docs`) lista as três specs; a terceira abre com a operação e sem erro de console.
- Ajuste fora do texto do contrato: o exemplo genérico de `NOT_FOUND` falava em "Agendamento não encontrado"; sobrescrevi
  a mensagem do exemplo para "Organização não encontrada." dentro de `publica.ts`.
- CSP: mesma origem, não precisou mudar `CSP_DA_PAGINA`.
- Em produção a spec pública aparece sempre (não depende de `docsInternasLiberadas`), como o contrato pede.

## Passo 5 — script de verificação

- `node web/scripts/verificar-api-publica.mjs http://localhost:3002 admin http://localhost:3200` → 24 verificações, exit 0.
- Teste negativo: acrescentei `extra` ao Zod `ServicoPublico` e à rota; o script saiu com código 1 ("servicos[0] = id, nome, ..."
  com o campo `extra` listado). Revertido (`git status` limpo nesses arquivos) e o script voltou a passar.
- **429 não verificado** (de propósito, contrato §5). O código do 429 não foi tocado.

## Aceite (§8)

- [x] `services.category` com o check; `anon` lê; `database.types.ts` atualizado.
- [x] Editar com categoria e remover (vazio → `null`) no painel. Criar serviço novo pelo botão: não exercitado (ver passo 2).
- [x] As três APIs devolvem a categoria.
- [x] `/marcar/admin` e `?servico=<id>` respondem 200. (Só conferi o status HTTP; não abri o formulário no navegador para ver o serviço pré-selecionado.)
- [x] `openapi.json` válido e no Swagger.
- [x] Script passa e reprova com campo extra.
- [x] `tsc --noEmit` sem erro. O erro antigo de `public-booking-form.tsx:~319` **não aparece mais** nesta branch (tsc sai limpo).
  `eslint` nos arquivos tocados só acusa dois `no-explicit-any` já existentes (`create-service.ts:44`, `create-service-dialog.tsx:30`).
- [~] LP da Deborah — **parcial**. A porta :3200 já tinha um `next dev` da LP rodando (apontando para o Eliza :3001) e o Next
  recusa um segundo dev no mesmo diretório; não encerrei o processo de outra pessoa. Em vez do navegador, rodei o código real da LP
  (`src/lib/catalog-core.mjs`: `normalizeCatalog` + `groupServices`) sobre a resposta ao vivo de `localhost:3002` com
  `Origin: http://localhost:3200` (CORS ok): saíram 3 ilhas, e **"Alongamento" agrupa Alongamento + Manutenção**.
  Não vi a página renderizada. Para fechar: parar o dev da :3200 e subir com
  `NEXT_PUBLIC_ELIZA_API=http://localhost:3002 npm run dev` (a `web/.env.local` do worktree já tem `LP_PUBLIC_ORIGINS` com :3200 e :3201).

## Divergências e observações

- Contrato diz que `docs/API.md` tem "tabela de `Service`"; não tem. Acrescentei os campos na linha de `GET /services`.
  `API_AUTOATENDIMENTO.md` também só cita `GET /servicos` numa frase; idem.
- `web/.env.local` foi copiado do checkout principal e `LP_PUBLIC_ORIGINS` ganhou `http://localhost:3201` (arquivo não versionado).
- `supabase/migrations` fica na raiz do repo, não em `web/`.
- Dev do Eliza do worktree: `npm run dev -- --port 3002` ainda pode estar rodando em background; `dev.log` e `npm-install.log`
  na raiz do worktree não foram commitados.
- Lembrete de deploy (contrato §2.1): a migration já está no banco (é o mesmo projeto usado em dev), então o código desta branch
  pode ir para o deploy sem quebrar listagens.
