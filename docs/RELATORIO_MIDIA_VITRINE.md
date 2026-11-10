# Relatório — mídia e vitrine

## F1 — passo 1.1/1.2 (migration e tipos)

**Migration (1.1):** aplicada pelo Opus em 2026-11-10 no projeto Supabase `ttrzlxuqyrqxgbztfmwv`. Versão no banco `20261110000456`, arquivo `20261110120000_midia_categorias_vitrine.sql`. Postgres 17.6 (conferido por `select version()`, ≥ 15 OK para o `on delete set null (media_id)`). Não foi reaplicada neste passo.

**Tipos (1.2):** `web/utils/database.types.ts` regenerado com `generate_typescript_types`. O diff traz as tabelas `org_media`, `service_categories`, `vitrine_items` e a função `renomear_categoria`, além de ruídos sem efeito de schema: reordenação de colunas (`services.addons`, `organizations.brand_palette`), versão do gerador (`PostgrestVersion` 14.5 → 14.1) e formatação dos tipos auxiliares `Tables<>`/`Enums<>`.

**Privilégios (SQL, mesmo projeto):**

Consulta 1 — `information_schema.table_privileges` (anon/authenticated/public):

```
[{"table_name":"org_media","grantee":"authenticated","string_agg":"SELECT"},
 {"table_name":"service_categories","grantee":"authenticated","string_agg":"SELECT"},
 {"table_name":"vitrine_items","grantee":"authenticated","string_agg":"SELECT"}]
```

Resultado: OK. Só `authenticated` com `SELECT`; `anon` e `public` sem linhas.

Consulta 2 — execute de `renomear_categoria`:

```
[{"proname":"renomear_categoria","rolname":"authenticated","has_function_privilege":false},
 {"proname":"renomear_categoria","rolname":"anon","has_function_privilege":false},
 {"proname":"renomear_categoria","rolname":"service_role","has_function_privilege":true}]
```

Resultado: OK. Só `service_role` com execute.

Consulta 3 — RLS:

```
[{"relname":"org_media","relrowsecurity":true},
 {"relname":"service_categories","relrowsecurity":true},
 {"relname":"vitrine_items","relrowsecurity":true}]
```

Resultado: OK. RLS ligado nas três tabelas.

## F1 — passo 1.3 (biblioteca e upload)

Executor: Sonnet. Contrato: `docs/contratos/midia-vitrine/01-armazenamento-e-upload.md`.

### O que foi feito

- `sharp` 0.35.5 (exato) em `dependencies`; `npm install` atualizou o lock (antes só entrava como opcional do Next, em 0.34.5). Exige Node >= 20.9 (o `node:20-alpine` cobre).
- `lib/midia/armazenamento.ts`, `processar.ts`, `planos.ts`; `exigirGestorDaOrg()` em `lib/painel-sessao.ts`; `MEDIA_LIMIT_REACHED` (409) no envelope; `contracts/painel/midia.ts` + `index.ts`; `lib/domain/midia.ts`; `app/actions/midia.ts`; `POST /api/painel/midia`; `scripts/limpar-midia.mjs`.
- Org demo/suspensa (passo 3 da rota): mesma regra de `lib/api/autenticar-chave.ts` (`organizations.is_demo` ou `subscription_status = 'suspended'` → `ORGANIZATION_SUSPENDED` 403). Plano lido de `organizations.plan` na mesma consulta (não usei `plano-da-org.ts` para não fazer 2 idas ao banco).
- A rota usa `criarRota` (`lib/http/rota.ts`) com autenticador próprio (sessão, não API key): envelope, `X-Request-Id`, `Cache-Control: no-store` e conversão de `ApiError`/`DomainError` são os da v1.

### Desvios do contrato

1. `EM_USO`: `DomainError` só aceita códigos que existem em `ErrorCode`. Em vez de criar um código novo, `excluirMidia` lança `DomainError("CONFLICT", msg, { motivo: "EM_USO", usos })`. Para isso `CONFLICT` entrou em `CodigoDominio` (`lib/domain/erros.ts`, aditivo). A tela do 05 testa `detalhes.motivo === "EM_USO"`.
2. `processarFoto` devolve a mais `larguraReal` em cada variante: sem ampliar, a variante "960" de um recorte de 700 px tem 700 px de largura, e `org_media.largura` grava o valor real (contrato §4 passo 5). A assinatura do contrato continua válida.
3. `contracts/painel/midia.ts` tem, além do §5, `RecorteMidia`, `AltMidia`, `TAMANHO_MAXIMO_BYTES`, `TIPOS_ACEITOS`, `LIMITE_FOTOS_ATIVAS` (o seletor do 05 reaproveita). `domain/midia.ts` exporta também `contarFotosAtivas`; `armazenamento.ts` exporta `novoIdDeMidia`.
4. `lib/openapi/comum.ts`: `SIGNIFICADO_DO_CODIGO` é `Record<ErrorCode,...>`, então o `tsc` exigiu a entrada de `MEDIA_LIMIT_REACHED`. Isso muda a lista de códigos do OpenAPI gerado (sai um código a mais na tabela de erros).
5. Pedido do Opus: `armazenamento.ts` trata `MEDIA_DIR`/`MEDIA_PUBLIC_BASE` vazios ou só com espaços como ausentes e tira a barra final de `MEDIA_PUBLIC_BASE`.
6. Pedido do Opus: `COPY --from=builder /app/scripts ./scripts` no runner do `web/Dockerfile`, para o `limpar-midia.mjs` existir no container.
7. `limpar-midia.mjs` fala com o PostgREST por `fetch` (sem importar `@supabase/supabase-js`), para ficar Node puro.
8. Actions revalidam `/servicos` e `/vitrine` (rotas do 05; a segunda ainda não existe, `revalidatePath` não reclama).

### Aceite do 01 (§8)

- Migration aplicada, `anon` sem privilégio, tipos regenerados: ✅ (passo 1.1/1.2, evidência acima neste relatório).
- JPEG grande → dois `.webp`, sem EXIF: ✅ no módulo (não pela rota). Script temporário chamando `processarFoto` + `gravarVariantes` com JPEG 3000x4000 com EXIF `Copyright`: entrada `exif: true`; saída `[960x1280, 480x640]`, `exif: false`, `format: webp`; diretório criado com `480.webp` e `960.webp`. Upload autenticado pela rota: **não verificado, precisa de sessão** (sem credencial de teste no projeto; só há API keys em `.env.local`).
- PNG com extensão trocada passa (decide o conteúdo: PNG real é aceito, ok); GIF, SVG e texto: ✅ `FORMATO` em `processarFoto` (422 na rota; nada chega ao disco porque `gravarVariantes` só roda depois). O filtro de `type` e o 413 da rota: **não verificado, precisa de sessão** (código lido).
- Recorte 1:1 → `RECORTE`; recorte 3:4 de 300 px → `PEQUENA` ("Foto pequena demais para o site"): ✅ no módulo. Foto 700x933 → 960 sai com 700 px reais (sem ampliar), 480 normal: ✅. EXIF Orientation 6 respeitada: ✅.
- `professional` → 403: **não verificado, precisa de sessão** (helper lido: só `owner`/`admin`). Sem sessão → 401: ✅ `curl -X POST localhost:3099/api/painel/midia` → `401 {"error":{"code":"UNAUTHORIZED",...,"request_id":...}}`, `x-request-id` e `cache-control: no-store` presentes.
- Insert que falha não deixa diretório órfão: **não verificado ponta a ponta** (a rota chama `apagarDiretorio(id)` no `catch` do `criarMidia`; `apagarDiretorio` testado: remove a pasta e a `.tmp`). `gravarVariantes` com id inválido (`../x`) → erro, nada gravado.
- Domínio contra o Supabase de produção (org `admin`, service role): `criarMidia` ✅, alt curto → `VALIDATION_ERROR`, `listarBiblioteca` ✅ com `usos`, `editarAlt` ✅, `editarAlt`/`excluirMidia` com outra org → `NOT_FOUND`, excluir em uso (categoria temporária) → `CONFLICT {motivo:"EM_USO",usos:1}`, excluir livre ✅, excluir de novo → `NOT_FOUND`. Tudo apagado no fim: `org_media` da org `admin` com 0 linhas, categoria temporária removida.
- `limpar-midia.mjs`: ✅ sem argumento só lista (3 alvos: órfã > 30 d, `.tmp` > 1 h, excluída > 30 d) e nada some; com `--aplicar` apaga exatamente esses 3 e a linha da excluída antiga; ficam a excluída recente, órfã nova, `.tmp` novo, ativa e pasta de nome não-uuid. Linhas de teste removidas.
- `npx tsc --noEmit` em `web/`: sem erros (nenhum pré-existente). `npm test`: 33 passam.
- `docker compose build` + `node -e "require('sharp')"` no container: **não verificado, sem Docker nesta máquina; fica para o R1.** Localmente (win32) `require('sharp')` carrega a 0.35.5.

### Pendências

- Upload autenticado pela rota (201, 403 de `professional`, 413, 422 por campo, rate limit, cota de 80, rollback) pelo navegador no R1.
- `docker compose build` no R1.
- Corrida conhecida: entre o `excluirMidia` e uma atribuição concorrente de categoria/vitrine, uma foto pode ser excluída logicamente já referenciada. O 1.4 deve recusar `media_id` de foto com `deleted_at` preenchido.
- Em dev, o Next não serve arquivos novos de `public/media` criados em runtime de forma confiável; o nginx do 06 resolve em produção.
