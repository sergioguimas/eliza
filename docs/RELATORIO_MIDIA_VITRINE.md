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

## F1 — passo 1.3, correções do Opus (origem e pipeline)

- `POST /api/painel/midia` confere o header `Origin` antes de tocar na sessão: se vier e não for a origem do app (`NEXT_PUBLIC_APP_URL`; em dev, ou sem a variável, vale também a origem do próprio request), responde `403 FORBIDDEN`. Sem `Origin` (curl) segue. Evidência no dev: sem Origin → 401; `Origin: https://evil.example` → 403 `FORBIDDEN`; `Origin: http://localhost:3099` → 401 (passou a checagem, falta sessão).
- `processarFoto` monta `sharp(entrada).rotate().extract(...)` uma vez e usa `.clone()` para cada `resize` (uma decodificação do original por foto). Casos do 1.3 reconferidos com o mesmo script: JPEG 3000x4000 com EXIF → 960x1280 e 480x640 sem EXIF; orientação 6 → 960x1280; 700x933 → variante 960 com 700 px reais; GIF/SVG/txt → `FORMATO`; 1:1 → `RECORTE`; 3:4 de 300 px → `PEQUENA`.

## F1 — passo 1.4 (categorias e vitrine no domínio)

Commit `feat(midia): foto e ordem por categoria e vitrine no domínio`. `lib/domain/categorias.ts`, `lib/domain/vitrine.ts`, actions `app/actions/categorias.ts` e `vitrine.ts` (todas com `exigirGestorDaOrg` + `revalidatePath`).

Decisões do Opus aplicadas: mídia com `deleted_at` é `NOT_FOUND` em `definirFotoCategoria` e `adicionarItem`; limites da vitrine (24 ativos, 60 no total) = `DomainError("CONFLICT", msg, { motivo: "LIMITE_VITRINE" })`; nome exibido = o da linha da tabela, senão o primeiro `services.category` por título; desempate por `localeCompare(..., "pt-BR", { sensitivity: "base" })`.

Escolhas minhas (o contrato não fecha):
- `definirFotoCategoria` em categoria que nenhum serviço ativo usa → `NOT_FOUND`.
- Pôr foto em categoria sem linha cria a linha já na posição atual e dá `ordem` às demais sem linha (senão a categoria pularia para o topo, porque as com linha vêm antes das sem linha).
- `editarItem` reativando item com 24 ativos → o mesmo `CONFLICT`.
- Actions: `definirFotoDaCategoria`, `reordenarCategoriasAction`, `renomearCategoriaAction`, `adicionarItemVitrine`, `editarItemVitrine`, `reordenarVitrineAction`, `removerItemVitrine`; as de vitrine devolvem `{ success: true, resultado }`.

Evidência (script temporário no scratchpad, org `admin` de produção, serviços e fotos temporários, tudo apagado no fim: `org_media`, `vitrine_items` e `service_categories` com 0 linhas; `services` voltou aos 4 originais):

Aceite 02 §6:
- ✅ foto numa categoria + reordenar: `listarCategorias` devolveu `Zz Pedicure(0), Zz Gel(10, foto), Zz Alongamento(20), Zz Alongamentos(30)`; chave inexistente em `reordenarCategorias` → `VALIDATION_ERROR`.
- ✅ renomear A → B com B existente e com foto: serviços de A foram para B, vale a foto de B (`Zz Alongamentos`, 2 serviços, com foto). Renomear sem destino (Pedicure → Pedicures) manteve a ordem 0. Maiúscula/espaço (`zz gel `) foi unificada na mesma categoria. Foto mantida em renomeação sem destino: não testada com foto (só a ordem); a função só troca o `nome`.
- ✅ mídia que não é da org (uuid alheio) → `NOT_FOUND`. A FK cruzada por SQL **não foi verificada**: exigiria inserir foto em outra org real de produção; o 1.1 criou a FK composta.
- ✅ excluir a linha de `org_media` por SQL deixou a categoria sem foto, sem erro (FK `set null`).

Aceite 03 §5:
- ✅ 3 itens, reordenar, desativar 1 → pública devolve 2 na ordem nova (`Destaque 3`, `Destaque 1`).
- ✅ 25º ativo → `CONFLICT` "A vitrine já tem 24 fotos. Desative ou remova uma." (`LIMITE_VITRINE`); reativar com 24 ativos também.
- ✅ categoria "Zz Nao Existe" sai `null` na pública (vista na resposta HTTP).
- ✅ excluir da biblioteca a foto de um item → `CONFLICT` `EM_USO` (usos 1). A mensagem do domínio é "Essa foto está em uso (categoria ou vitrine)..."; a tela do 05 pode trocar por "usada na vitrine" quando o item for da vitrine.
- Também: item de org alheia (`editarItem`) → `NOT_FOUND`; remover duas vezes → `NOT_FOUND`.

## F1 — acréscimo: fotos no dev (desvio do 01 §3 e do 06 §4, decidido pelo Opus)

Commit `feat(midia): servir fotos no dev por rota e MEDIA_DIR fora de public`.
- Padrão de `MEDIA_DIR` em dev = `<web>/.media` (antes `public/media`), no `armazenamento.ts`, no `limpar-midia.mjs`, no `.gitignore` (`/.media/`) e no `.env.example`.
- `app/media/[id]/[arquivo]/route.ts` serve `/media/<uuid>/<960|480>.webp` só fora de produção (`NODE_ENV === "production"` → 404). Leitura via `lerVariante` em `armazenamento.ts` (o disco continua num módulo só). O matcher do `middleware.ts` já exclui `.webp`.
- Contratos 01 §3 e 06 §4 atualizados.
- Evidência: `960.webp` e `480.webp` → 200 `image/webp` com `cache-control: public, max-age=31536000, immutable`; `100.webp`, `..%2F/960.webp` e `nao-uuid/960.webp` → 404. O 404 de produção não foi exercitado (só o código).

## F1 — passo 1.5 (catálogo público)

Commit `feat(api-publica): categorias e vitrine no catálogo público`.
- Zod do §2 em `contracts/publico/catalogo.ts` (`FotoPublica`, `CategoriaPublica`, `ItemVitrinePublico`, `categorias` e `vitrine` depois de `servicos`, `.strict()`). O ETag agora inclui categorias e vitrine.
- Rota: `Promise.all` de três leituras (serviços, linhas de categoria com a foto embutida por join, itens de vitrine com a foto embutida). Desvio do §3 ("depois de `listarServicosAtivos`, em paralelo"): paralelizei também com os serviços, e `categoriasPublicas`/`vitrinePublica` ficaram divididas em `ler...` (consulta) e `montar...` (parte pura), com as funções do contrato como atalho. Motivo: a medição abaixo.
- OpenAPI pública: descrição, resumo do formato e exemplo atualizados (o schema sai do Zod, então os campos novos aparecem). `docs/API_PUBLICA.md` (Haiku) conferido e coerente com a implementação, sem alteração.
- `verificar-api-publica.mjs`: lista fechada com `categorias`/`vitrine`, `foto`, item de vitrine, nome de categoria presente em algum serviço, `HEAD` em até 3 fotos. Também corrigi um bug antigo: `adicionais` não estava na lista de campos do serviço, então o script já reprovava antes.

Tempo da rota (dev local, Supabase remoto; 3 aquecimentos + 10 chamadas, mediana; cada ida ao banco custa ~230 ms nesta máquina):
- antes (HEAD sem os campos novos): 692 a 810 ms
- depois, primeira versão (duas consultas extras em série depois dos serviços, 2 idas cada): ~950 ms
- depois, com join + `Promise.all` de tudo: 744 a 754 ms (com fotos, categoria com foto e 2 itens de vitrine), dentro do ruído e abaixo do alvo de +40 ms.

Aceite 04 §7:
- ✅ org sem fotos: `categorias: [{nome:"Alongamento", foto:null}]`, `vitrine: []` (medido antes das fixtures); o script passou (30 verificações).
- ✅ com foto e vitrine: o script passou contra o dev local, `node web/scripts/verificar-api-publica.mjs http://localhost:3099 admin http://localhost:3200` → "50 verificações passaram", incluindo os `HEAD` das fotos (200, `image/webp`, `immutable`, sem `set-cookie`).
- ✅ trocar a foto da categoria muda o ETag (`"67b7e850..."` → `"fb1619e1..."`) e `If-None-Match` antigo → 200.
- ✅ campo extra (proxy local acrescentando `extra` ao primeiro item da vitrine): o script reprovou com `FALHOU: vitrine[0] = id, legenda, categoria, foto  recebido: ["categoria","extra","foto","id","legenda"]`.
- ✅ tempo medido (acima).
- Compatibilidade com a LP antiga: pela natureza aditiva; a LP não foi testada.
