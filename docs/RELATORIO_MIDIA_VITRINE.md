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

## R1 — correções

Commit `fix(midia): limites de corpo e de pixels no upload e script de limpeza à prova de erro`. Contrato `01` §4, §5 e §7 atualizado para bater com o código (inclui a ordem nova das checagens, o limite conhecido da cota de 80 e as flags do script).

1. **Teto de corpo no upload (ALTO).** `lib/midia/corpo.ts` (sem `server-only`, testável isolado). A rota agora, logo depois do papel e antes de demo, plano, taxa e cota: exige `content-length` inteiro > 0 (ausente ou inválido → `422` "Envio sem tamanho declarado."), acima de 8,5 MB → `413 MEDIA_TOO_LARGE`, lê por stream com teto (`TransformStream` que conta bytes e dá erro ao estourar) e só então valida os campos. Corpo inválido não gasta cota. Evidência (script no scratchpad, `Request` reais):
   - `content-length` ausente, `abc`, `0`, `-5` → `null` (a rota responde 422); `12` → 12.
   - multipart válido de 1 KB com limite de 100 KB → lido (`alt` e `arquivo.size` corretos).
   - corpo de 1 MB com header mentindo `content-length: 500` → `CorpoGrandeError` (413).
   - chunked de 50 MB sem tamanho, limite de 100 KB → `CorpoGrandeError`, e o gerador parou em 196 608 bytes (o stream é cortado, não lido inteiro).
   - `text/plain` → `CorpoInvalidoError` (422).
   - Pela rota no dev, sem sessão a resposta é 401 (a sessão vem antes do corpo, de propósito); por isso o limitador foi testado isolado.
2. **Bomba de pixels (MÉDIO).** `LIMITE_PIXELS_ENTRADA = 2560 * 2560 * 1.25` (comentário cita o MV8). O `metadata()` lê só o cabeçalho (sem limite) e, acima do teto, → `FORMATO` "Foto grande demais. Envie pelo painel, que já reduz o tamanho."; o decode mantém `limitInputPixels` com o mesmo valor. Semáforo de 2 `processarFoto` por processo: o 3º recebe `OCUPADO` sem esperar, e a rota responde `429 RATE_LIMITED` com `Retry-After: 5` e "Outra foto está sendo processada. Tente em alguns segundos.". Evidência: PNG sólido 6300x6300 (131 509 bytes) → `FORMATO` "Foto grande demais..."; JPEG 1920x2560 passa; 3 chamadas simultâneas → `[ok, ok, OCUPADO]`, e a seguinte, depois de terminar, passa. Casos do 1.3 (orientação 6, 700x933, sem EXIF) refeitos antes: iguais.
3. **`limpar-midia.mjs`, caso (b) (MÉDIO).** Aborta sem apagar nada (saída 1) se há pastas candidatas a (b) e a consulta não reconheceu nenhuma, ou se os órfãos passam de 20% das pastas. O caso (b) só apaga com `--aplicar --confirmo-orfas`; sem a flag, lista e avisa. Evidência com mock local de PostgREST: consulta vazia com 5 pastas e `--aplicar --confirmo-orfas` → "ABORTADO ... nada foi apagado", exit 1, 5 pastas restantes; 1 órfã em 10 (10%): lista e avisa, `--aplicar` sem a flag não apaga (10 restantes), com a flag apaga 1; 3 órfãs em 10 (30%) → ABORTADO, exit 1, 10 restantes.
4. **Script não trava (BAIXO).** Erro no `DELETE` da linha, ou no `rm`, é registrado e o script segue para o próximo alvo; saída 1 só no fim. Evidência: mock devolvendo 500 no `DELETE` com 2 excluídas antigas → as duas pastas removidas, dois `ERRO: DELETE org_media -> 500`, "feito: 2 pasta(s), 0 linha(s) (com erros, veja acima)", exit 1.
5. **`MEDIA_DIR` em produção (BAIXO).** `mediaDir()` lança "MEDIA_DIR não configurado: as fotos sumiriam no próximo deploy" na chamada, com `NODE_ENV=production` e a variável vazia (a rota já converte em 500). Evidência: com `NODE_ENV=production` o módulo carrega e `urlsDaMidia` funciona (o `next build` não é afetado); `gravarVariantes` lança a mensagem.
6. **Documentação (sem código).** Cota de 80 não atômica registrada como limite conhecido no `01` §5, item 7 (na nova numeração; era o item 6).

## F2 — painel (passos 2.1, 2.2 e 2.3)

Branch `feat/midia-vitrine`. Commits: 2.1 `53f2750`, 2.2 `4d1c288` (emendado para incluir a prévia do Opus), 2.3 (ver `git log`, "feat(vitrine)"). Nada de banco, nada de push.

### O que foi feito

- **2.1 MediaPicker** (`web/components/midia/`): `media-picker.tsx` (Dialog, abas "Minhas fotos" / "Enviar nova", grade 3 col no celular e 5 no desktop, variante 480, `loading="lazy"`, menu ⋯ com "Editar descrição" e "Excluir da biblioteca", contador "N de 80 fotos", rodapé "Usar esta foto"), `enviar-nova.tsx` (escolher, recorte, descrição, progresso), `recorte-foto.tsx` (único arquivo que importa `react-easy-crop`), `envio-foto.ts` (decodifica, reduz para 2560 px, XHR com `upload.onprogress`, mapa de erros). `react-easy-crop` fixado em **6.2.4** (sem `^`; a 6.2.5 tem um dia, escolhi a anterior).
- **2.2 Categorias e fotos** (`web/components/services/categorias-fotos.tsx`, ligada em `app/(app)/servicos/page.tsx`): seção colapsável (aberta se houver categoria sem foto), linha por categoria com miniatura 60 px, "Trocar foto", "Tirar foto", "Renomear", ↑/↓ otimistas com gravação 600 ms depois do último toque. A página só carrega e renderiza a seção para owner/admin.
- **2.3 Vitrine** (`web/app/(app)/vitrine/page.tsx`, `web/components/vitrine/vitrine-painel.tsx`, item de menu em `app-sidebar.tsx`): cabeçalho, contador "N de 24 no site", cartões com legenda inline (grava no blur/Enter, "Salvo"), select de categoria, interruptor "No site", ↑/↓, remover com confirmação, "Adicionar foto" → picker → diálogo de legenda (sugestão = descrição cortada em 60). Vazio com o texto do contrato. `professional`: `notFound()` na página (mesmo padrão de `/configuracoes/atendente`) e sem item de menu.

### Desvios do contrato e decisões menores

1. **Action nova `listarBibliotecaAction`** em `app/actions/midia.ts` (leitura: `exigirGestorDaOrg` + `listarBiblioteca`). O contrato não dava o caminho de leitura da biblioteca para o picker (a rota de upload é só POST). Ler ao abrir o seletor evita carregar até 80 fotos em toda visita a Serviços e mantém `usos` fresco. Único toque em backend; nenhuma regra mudou.
2. **As actions só devolvem `{ error: message }`: `detalhes.motivo` (`EM_USO`, `LIMITE_VITRINE`) não chega à tela.** Não mexi nas actions (F1 revisada). Tratamento: (a) a exclusão com `usos > 0` é barrada na própria tela, antes de chamar a action, dizendo onde a foto está ("na categoria X", "na vitrine"; se `usos` for maior que o que a tela conhece, acrescenta "em outro lugar (categoria ou vitrine)"); (b) o botão "Adicionar foto" desabilita a 24 ativos, com a explicação; (c) se mesmo assim a action recusar (corrida, ou reativar com 24 ligados), a mensagem do domínio ("Essa foto está em uso...", "A vitrine já tem 24 fotos. Desative ou remova uma.") vai no toast e o interruptor volta. Se o Opus quiser o `motivo` na tela, é uma linha em cada action (`{ error, motivo }`).
3. **Foto pequena bloqueia, não só avisa** (05 §1.4): o servidor recusa recorte com lado menor < 480 px (`PEQUENA`, 01 §4.4), então a tela mostra "Essa foto é pequena e vai ficar borrada no site..." e desabilita "Enviar" nesse caso, em vez de deixar enviar e tomar 422. A medida é a largura do recorte em pixels da imagem já reduzida (a que vai ao servidor).
4. **Redução no cliente** (decisão menor): sempre reencoda para JPEG 0,9 com lado maior ≤ 2560 px (resolve HEIC e orientação). Fundo branco antes de desenhar (PNG transparente não vira preto). Se passar de 8 MB, baixa a qualidade (0,8; 0,7) e, em último caso, o tamanho (×0,75, até 4 tentativas). Orientação EXIF aplicada por `createImageBitmap(..., { imageOrientation: "from-image" })`.
5. **Constantes duplicadas de propósito** (`envio-foto.ts`: 8 MB, 80 fotos, alt 3–200): importar `contracts/painel/midia.ts` traria o `zod` inteiro para o JS do painel, que hoje não o carrega. Limites e mensagens de `AltMidia` são os mesmos; o servidor segue decidindo. O limite de 24 da vitrine vem do servidor, como prop (`LIMITE_ITENS_ATIVOS`).
6. **429 com dois sentidos**: `Retry-After` < 60 s (o "outra foto sendo processada", 01 §4.1) vira "O servidor está ocupado. Tente de novo em alguns segundos."; ≥ 60 s (taxa de 30/hora) vira "Muitos envios seguidos. Tente de novo em X minutos." 415 (a rota não emite hoje) tem mensagem própria; 401 → "Sua sessão expirou..."; falha de rede → "Sem conexão...". Para `MEDIA_LIMIT_REACHED` e 422 vale a mensagem do envelope; com 80 fotos a aba "Enviar nova" já mostra o bloqueio antes.
7. **Menu**: "Vitrine" fica logo depois de Serviços no menu lateral (desktop). No celular a barra de baixo já tem 5 lugares (4 itens + "Mais"), então "Vitrine" entra no painel "Mais", primeiro da lista. Só owner/admin.
8. **↑/↓ em coluna** nas categorias (um sobre o outro, 44 px cada), para sobrar largura ao texto a 375 px; o contrato desenha lado a lado.
9. **Categoria sem foto**: a miniatura tracejada fica sem texto (60 px não comporta) e "Sem foto: o site usa a padrão" aparece ao lado, sob o nome.
10. A lógica de ordem com debounce está escrita duas vezes (categorias e vitrine), igual nos dois; deliberado para não mexer na seção já commitada. Vale extrair um hook se aparecer um terceiro uso. Sair da tela com a ordem pendente grava na hora (efeito de desmontagem).
12. **Prévia "Assim aparece no site" (acréscimo do Opus ao 2.1/2.2)**: o `MediaPicker` ganhou a prop `previaSite`, ligada só na foto de categoria. Mostra uma miniatura 4:3 (`object-fit: cover`, `object-position: 50% 40%`, a moldura da ilha da LP no celular), só CSS, sem lib e sem recorte novo: depois do recorte 3:4 (a região recortada é posicionada dentro da moldura, `components/midia/previa-site.tsx`) e ao selecionar uma foto da biblioteca (acima do rodapé). Legenda "Assim aparece no site". O recorte segue 3:4. A vitrine não usa. Não verificado visualmente (só tsc/lint).
11. `react-easy-crop` injeta o próprio CSS (`<style>` no `head`); o app não tem CSP, então funciona sem configuração.

### Aceite do 05 (§5) e evidência

| Item | Estado | Evidência |
|---|---|---|
| `tsc --noEmit` sem erro novo | feito | `npx tsc --noEmit` em `web/`: saída vazia |
| `npm run lint` sem erro novo nos arquivos tocados | feito | arquivos novos (`components/midia/*`, `categorias-fotos.tsx`, `components/vitrine/*`, `app/(app)/vitrine`, actions de mídia) sem nenhum aviso. Em `servicos/page.tsx` (1 `any` no `.map`) e `app-sidebar.tsx` (8 problemas) os problemas são os mesmos de antes das mudanças (conferido com `git stash`) |
| `next build` passa | feito | `npx next build`: "Compiled successfully", 42/42 páginas, rota `/vitrine` na tabela |
| `react-easy-crop` ausente do JS inicial de `/servicos` (e de `/vitrine`) | feito (análise do build) | o código da biblioteca está só em `.next/static/chunks/1d5239b0c24a84de.js` (26 KB). Esse arquivo **não** consta na lista de chunks de `server/app/(app)/servicos/page_client-reference-manifest.js` (16 chunks iniciais, nenhum é ele; idem `/vitrine`). Só aparece em `react-loadable-manifest.json` (de `servicos` e `vitrine`) e dentro dos chunks do picker (`32fead04368d336b.js` em servicos, `edc386ae63b073ec.js` em vitrine) como `Promise.all(["static/chunks/1d5239b0c24a84de.js"].map(e.l))`, isto é, `import()` sob demanda, disparado só quando `<RecorteFoto/>` renderiza (depois de escolher a foto). `ssr: false` não pré-carrega |
| MediaPicker: recorte e envio a 375 px | parcial | num harness temporário sem login (removido), a 375 px: foto de 3200x2400 reduzida e aberta no recorte 3:4 com grade de terços e slider de zoom; "Enviar" dispara `POST /api/painel/midia` → 401 → "Sua sessão expirou. Entre novamente."; arquivo inválido (`.heic` falso) → "Não consegui abrir essa foto. Tente uma em JPG ou PNG." O envio real, o progresso e o HEIC de iPhone **não** foram exercitados |
| Voltar para a foto anterior pela aba "Minhas fotos" | não verificado (precisa login) | código: `listarBibliotecaAction` ao abrir, grade com seleção e "Usar esta foto" |
| Reordenar com 3 toques grava uma vez | não verificado (precisa login) | código: temporizador de 600 ms reiniciado a cada toque, uma chamada a `reordenarCategoriasAction` / `reordenarVitrineAction` |
| Renomear categoria e conferir os serviços | não verificado (precisa login) | código: `renomearCategoriaAction` + `revalidatePath("/servicos")` |
| Vitrine: adicionar, legenda, categoria, desativar, reordenar, remover | não verificado (precisa login) | código sobre as actions de `app/actions/vitrine.ts` |
| `professional`: sem seção, sem menu, actions recusam | parcial | seção só renderiza com `role` owner/admin (servidor); menu idem (`canManageOrg`); `/vitrine` → `notFound()`; as actions já recusam (F1, `exigirGestorDaOrg`). Falta ver no navegador logado |

### O que ficou sem verificação visual

Tudo que exige sessão: o picker aberto dentro de Serviços e da Vitrine (biblioteca, menu ⋯, editar/excluir), a seção "Categorias e fotos", a página Vitrine, o item de menu (desktop e "Mais" no celular) e qualquer envio que chegue ao servidor. Nada foi testado em aparelho real nem com foto HEIC.

### Roteiro de teste manual para o R2 (celular ou DevTools 375 px com toque, logado como owner/admin)

1. **Menu**: no desktop, "Vitrine" aparece logo depois de Serviços; no celular, em "Mais", "Vitrine" é o primeiro item. Resultado: abre `/vitrine`.
2. **Enviar e usar**: em Serviços, abra "Categorias e fotos" → "Trocar foto" de uma categoria → aba "Enviar nova" → "Escolher uma foto" (galeria) → a foto abre com grade de terços; ajuste com pinça e com o slider → escreva "Unhas amendoadas com francesinha" → "Enviar". Resultado: barra de progresso, o diálogo fecha sozinho e a miniatura da categoria mostra a foto nova. No iPhone, repita com uma foto HEIC.
3. **Foto pequena**: envie uma foto pequena (ex.: 400 px) ou dê muito zoom. Resultado: aviso "Essa foto é pequena e vai ficar borrada no site" e "Enviar" desabilitado.
4. **Descrição curta**: toque em "Enviar" sem descrever. Resultado: "Descreva a foto em pelo menos 3 caracteres."
5. **Voltar à foto anterior**: "Trocar foto" de novo → aba "Minhas fotos" (abre nela) → toque numa foto antiga (marca com visto) → "Usar esta foto". Resultado: a categoria volta à foto antiga. O contador mostra "N de 80 fotos".
6. **Excluir**: em "Minhas fotos", ⋯ numa foto **em uso** → "Excluir da biblioteca". Resultado: aviso "Essa foto está em uso" dizendo onde (categoria X / vitrine), sem excluir. Numa foto **sem uso**: pede confirmação ("A foto sai da biblioteca. Isso não pode ser desfeito pelo painel.") e some da grade. ⋯ → "Editar descrição" altera e salva.
7. **Reordenar com debounce**: com a aba Rede aberta, toque três vezes seguidas em ↓ na primeira categoria. Resultado: a linha desce 3 posições na hora e sai **uma** chamada (server action) cerca de 600 ms depois do último toque. Recarregue: a ordem permanece.
8. **Renomear**: "Renomear" numa categoria → o diálogo diz "Muda a categoria em todos os serviços dela." → salve. Resultado: ao editar um serviço dessa categoria, o nome novo aparece e a foto continua. Renomear para o nome de outra categoria existente mostra "Os serviços vão para a categoria X, que já existe, e vale a foto dela."
9. **Tirar foto**: "Tirar foto" numa categoria. Resultado: miniatura tracejada e "Sem foto: o site usa a padrão".
10. **Vitrine**: `/vitrine` vazia mostra "Sua vitrine está vazia..." → "Adicionar foto" → escolher → diálogo de legenda já preenchido com a descrição cortada em 60 → "Adicionar". Resultado: o cartão entra no fim, "1 de 24 no site". Edite a legenda e saia do campo (ou Enter): aparece "Salvo". Troque a categoria no select. Desligue "No site": o contador cai e a foto fica apagada. ↑/↓ reordenam (mesmo debounce). A lixeira pede "Sai da vitrine; a foto continua na biblioteca" e remove.
11. **Limite**: com 24 ligados, "Adicionar foto" fica desabilitado com a explicação e os interruptores desligados não ligam.
12. **professional**: entre como `professional`. Resultado: sem "Vitrine" no menu, sem a seção em Serviços, `/vitrine` dá 404, e uma chamada direta às actions devolve "Apenas administradores podem gerenciar fotos."
13. **Prévia**: ao trocar a foto de uma categoria, depois de recortar (e ao tocar numa foto da biblioteca) aparece "Assim aparece no site" com a foto numa moldura 4:3, mostrando só a faixa central (um pouco acima do meio). Ela deve bater com a ilha da LP no celular.
14. **Toque**: tudo acima com o polegar a 375 px: nenhum alvo menor que 44 px, nada depende de hover.

### Pendências

- Teste autenticado (R2) e em aparelho real, incluindo HEIC.
- Passo 2.4 (Haiku): conferir login de `professional` e reconfirmar o chunk.
- Decisão do Opus: expor `detalhes.motivo` nas actions (item 2) ou ficar com a mensagem.

## R2 — Revisão e teste com login (Opus, 2026-11-10)

Dev local (`localhost:3001`) com o login do Sérgio na org `admin`, a 375 px. Banco = produção; os 3 registros e os arquivos do teste foram apagados no fim (contagem final: 0 / 0 / 0 nas três tabelas).

| Passo | Resultado |
|---|---|
| Serviços › "Trocar foto" abre o seletor; sem biblioteca, cai em "Enviar nova" | ok |
| Recorte 3:4 com grade e zoom + prévia 4:3 "Assim aparece no site" | ok (também ao escolher da biblioteca) |
| Enviar sem descrição | ok: "Descreva a foto em pelo menos 3 caracteres." |
| Envio real | ok: `POST /api/painel/midia` → 201; barra de progresso e "Processando a foto…"; categoria ficou com a foto |
| Arquivo servido | ok: `960.webp` 960×1280 e `480.webp` 480×640, `image/webp`, `immutable` |
| Catálogo público | ok: `categorias[0].foto` com url/urlPequena/largura/altura/alt/cor |
| Menu "Mais" › Vitrine | ok |
| Excluir foto em uso | bloqueado, com aviso (genérico na Vitrine: "numa categoria ou na vitrine") |
| Adicionar à vitrine pela biblioteca, legenda pré-preenchida pelo alt | ok: "1 de 24 no site", interruptor e setas |
| "Tirar foto" da categoria | ok: catálogo volta a `foto: null` |
| Ponta a ponta com a LP local (`feat/fotos-eliza`) | ok: a ilha mostra a foto do painel sem rebuild e volta à local quando a foto sai. Corrigido na LP (`e612d31`) o cache que mostrava a versão velha na 1ª visita |

Observações:
- **Dev:** se `NEXT_PUBLIC_APP_URL` não estiver no `.env.local` e o dev subir fora da porta 3000, as URLs de foto apontam para `localhost:3000` (padrão) e não carregam. Em produção a variável existe. Para dev em outra porta: `MEDIA_PUBLIC_BASE=http://localhost:<porta>/media`.
- **Dev:** a LP local só lê o Eliza local se a origem dela estiver em `LP_PUBLIC_ORIGINS`.
- Ajuste pequeno pendente (não bloqueia): na página Vitrine o aviso de foto em uso não diz onde ela está; em Serviços ele diz.
- Não verificado: login de `professional` (passo 2.4; precisa de outra conta) e build Docker com `sharp` (vai no deploy, passo 5 do 06 §6).

## F4 — Deploy (2026-11-10)

Eliza 1.4.0 (tag `v1.4.0` em `2e946af`) e LP 1.1.0 (tag `v1.1.0` em `74930d9`) no ar.

| Passo | Resultado |
|---|---|
| Migrations | já aplicadas antes do deploy (agenda visível + mídia) |
| Pasta | `/opt/stacks/solasoftware/sola-media` (escolha do Sérgio; compose e docs ajustados no #69) |
| 1º build na VPS | **falhou** em `next/font/google`: o Google passou a devolver URLs `/l/font?kit=…&skey=…` para a VPS e o Turbopack do Next 16.0.8 não as resolve. Corrigido com a fonte no repo (`next/font/local`, #70); mesma prevenção na LP (debora-nails #2) |
| `/media/` | 404 do nginx (corpo padrão, sem versão, sem `x-powered-by`); o resto segue no Next. Domínio atrás do Cloudflare |
| Catálogo + `verificar-api-publica.mjs` | `categorias` (6) e `vitrine` presentes; 67 verificações ok |
| 1º envio | **403 "Origem não permitida"**: `NEXT_PUBLIC_APP_URL` não existia no `.env` de produção. Acrescentada e container recriado; daí 401 sem login com a origem certa e 403 com origem de fora |
| Envio real | foto da categoria "Nail Art Premium" na org `deborah-pereira`; `960.webp`/`480.webp` 200 `image/webp` `immutable`, `cf-cache-status: HIT` na 2ª chamada |
| LP | `npm run smoke -- https://deborahpereiranails.com.br --both` passou (aviso de `noindex`, que já existia); ilha Nail Art Premium mostra a foto do Eliza, 1 pedido ao catálogo por visita |

Falta: carga das outras 5 categorias e da vitrine (≥ 4 fotos para a galeria trocar), aceite com a Deborah,
login de `professional`, backup de `/opt/stacks/solasoftware/sola-media`.
