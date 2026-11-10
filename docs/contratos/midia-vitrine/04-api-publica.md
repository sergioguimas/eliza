# 04 — Catálogo público: `categorias` e `vitrine`

> **TO-BE** · Fase F1 · executor: Sonnet (Haiku nos docs) · revisão: Opus
> Rota: `GET /api/public/v1/orgs/{slug}/catalogo` (contrato `api-publica`). Mudança **aditiva** (MV10).

## 1. AS-IS

Resposta: `{ data: { organizacao, servicos, atualizadoEm } }`, `.strict()` em tudo, `Cache-Control: public,
max-age=30, stale-while-revalidate=300`, ETag do conteúdo sem `atualizadoEm`, CORS por `LP_PUBLIC_ORIGINS`,
120/min por IP. Serviços por `listarServicosAtivos` (até 30).

## 2. Zod (acrescentar em `web/contracts/publico/catalogo.ts`)

```ts
export const LIMITE_CATEGORIAS_PUBLICAS = 30
export const LIMITE_VITRINE = 24

/** Foto 3:4 servida pelo Eliza. Arquivo imutável: pode ficar em cache por 1 ano. */
export const FotoPublica = z
  .object({
    /** Variante grande (hoje 960 px de largura). */
    url: z.url(),
    /** Variante pequena (480 px). Use as duas em `srcset`: `${urlPequena} 480w, ${url} 960w`. */
    urlPequena: z.url(),
    /** Dimensões da variante grande, para `width`/`height` do <img> (evita CLS). */
    largura: z.number().int().positive(),
    altura: z.number().int().positive(),
    /** Texto alternativo escrito pela dona. Sempre preenchido. */
    alt: z.string().min(3).max(200),
    /** Cor dominante da foto (#rrggbb), para fundo de ambiente. */
    cor: z.string().regex(/^#[0-9a-f]{6}$/),
  })
  .strict()

/** Categoria de serviço, na ordem definida pela dona no painel. */
export const CategoriaPublica = z
  .object({
    /** Igual ao `categoria` dos serviços (comparar com lower+trim). */
    nome: z.string().min(1).max(40),
    foto: FotoPublica.nullable(),
  })
  .strict()

export const ItemVitrinePublico = z
  .object({
    id: z.uuid(),
    legenda: z.string().min(1).max(60),
    /** Categoria que a foto representa; null = nenhuma (ou deixou de existir). */
    categoria: z.string().max(40).nullable(),
    foto: FotoPublica,
  })
  .strict()
```

`CatalogoPublico` ganha, **depois** de `servicos`:

```ts
    /** Na ordem de exibição. Só categorias usadas por serviços ativos. [] = nenhuma. */
    categorias: z.array(CategoriaPublica).max(LIMITE_CATEGORIAS_PUBLICAS),
    /** Destaques ativos, na ordem. [] = vitrine vazia. */
    vitrine: z.array(ItemVitrinePublico).max(LIMITE_VITRINE),
```

Os dois campos são **sempre presentes**. A ordem do array **é** a ordem de exibição (não há campo `ordem`).

## 3. Rota

- Depois de `listarServicosAtivos`, em paralelo (`Promise.all`): `categoriasPublicas(db, org.id, servicos)`
  (02 §4) e `vitrinePublica(db, org.id, chavesDasCategorias)` (03 §4). A org é a do slug, nunca outra.
- Mídia com `deleted_at` não aparece (a categoria sai com `foto: null`).
- O ETag continua sendo o hash do conteúdo sem `atualizadoEm`, agora com os campos novos. Trocar a foto
  muda o ETag, e a LP vê a mudança em no máximo 30 s (mais o `stale-while-revalidate`).
- Cache, CORS, taxa e erros: **sem mudança**.
- Custo: duas consultas pequenas a mais (índices por org). Medir no relatório o tempo da rota antes e
  depois no dev (`curl -w '%{time_total}'`, 10 chamadas, mediana). Alvo: menos de 40 ms a mais.

## 4. OpenAPI e docs

- `lib/openapi/publica.ts` é gerado do Zod: conferir que os campos novos aparecem com as descrições.
- `docs/API_PUBLICA.md`: tabela da resposta com `categorias` e `vitrine`, exemplo JSON atualizado, e a
  seção "Fotos": URLs imutáveis, `srcset` com as duas larguras, `width`/`height`, `alt` obrigatório no `<img>`,
  e o aviso de que o arquivo de uma foto excluída continua no ar por 30 dias e depois some (então o consumidor
  deve ter `onerror` com reserva). → **Haiku**, a partir deste arquivo.

## 5. Verificação `web/scripts/verificar-api-publica.mjs`

Atualizar a lista fechada **de propósito**:

1. `data` exatamente `organizacao, servicos, categorias, vitrine, atualizadoEm`.
2. Cada categoria exatamente `nome, foto`; `foto` null ou exatamente `url, urlPequena, largura, altura, alt, cor`.
3. Cada item da vitrine exatamente `id, legenda, categoria, foto`.
4. Todo `categoria.nome` aparece em pelo menos um `servicos[].categoria` (lower+trim).
5. Para **até 3** URLs de foto (as primeiras): `HEAD` → `200`, `content-type: image/webp`,
   `cache-control` contendo `immutable`, sem `set-cookie`.
6. Os checks antigos continuam.

## 6. O que não muda

- APIs v1 e de Autoatendimento (nem `foto`, nem `categorias`): fora (README).
- Limites, cabeçalhos, envelope e CORS da rota pública.

## 7. Aceite do 04

- [ ] Org sem fotos: `categorias` lista as categorias com `foto: null`, `vitrine: []`, e a LP atual (sem a F3) continua funcionando.
- [ ] Com foto e vitrine: a resposta passa no Zod, e o script passa contra o local.
- [ ] Trocar a foto de uma categoria muda o ETag; a chamada com o `If-None-Match` antigo devolve 200, não 304.
- [ ] Campo extra acrescentado à resposta de teste → o script reprova (testar e reverter).
- [ ] Tempo da rota medido antes e depois, registrado no relatório.
