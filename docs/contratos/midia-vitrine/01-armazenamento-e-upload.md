# 01 — Biblioteca de fotos: armazenamento, processamento e upload

> **TO-BE** · Fase F1 · executor: Sonnet · revisão: Opus

## 1. AS-IS

- O Eliza não guarda nenhum arquivo: não usa Supabase Storage nem disco. As imagens do painel são estáticas, em `web/public`.
- O container `elisa-app` (`web/Dockerfile`, `node:20-alpine`) roda como **root** e não tem volume. Tudo o que
  for gravado dentro dele some no próximo `docker compose up --build`.
- `next` 16.0.8. O `sharp` não está declarado no `package.json`.
- `middleware.ts` já deixa `.webp` fora do matcher. A rota nova `/api/painel/*` **passa** pelo middleware,
  o que é desejado (renova a sessão).
- Quem é da org: `lib/painel-sessao.ts` → `organizacaoDaSessao()` devolve `{ organizationId, userId }`, sem o papel.

## 2. Tabela `org_media`

Migration única da F1 (junto com 02 e 03): `supabase/migrations/<timestamp>_midia_categorias_vitrine.sql`.

```sql
-- Biblioteca de fotos por organização (contrato midia-vitrine/01). Os BYTES ficam em disco
-- (MEDIA_DIR/<id>/{960,480}.webp); aqui só metadado. Escrita só pelo domínio com service role.
create table if not exists public.org_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alt text not null,
  cor text not null,
  largura integer not null,
  altura integer not null,
  bytes integer not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint org_media_alt_len check (char_length(btrim(alt)) between 3 and 200),
  constraint org_media_cor_hex check (cor ~ '^#[0-9a-f]{6}$'),
  constraint org_media_dim check (largura > 0 and altura > 0),
  constraint org_media_bytes check (bytes > 0),
  -- alvo da FK composta de service_categories e vitrine_items: impede apontar para foto de outra org
  constraint org_media_id_org_uk unique (id, organization_id)
);

comment on table public.org_media is
  'Biblioteca de fotos da org. Arquivos em MEDIA_DIR/<id>/{960,480}.webp (fora do banco). deleted_at = excluída da biblioteca; o disco é limpo 30 dias depois por web/scripts/limpar-midia.mjs.';
comment on column public.org_media.cor is 'Cor dominante (#rrggbb) calculada pelo servidor; fundo de ambiente nos sites.';
comment on column public.org_media.largura is 'Dimensões da variante grande (hoje sempre 960x1280).';
comment on column public.org_media.created_by is 'profiles.id de quem enviou (sem FK, como em schedule_blocks).';

create index if not exists org_media_org_ativas_idx
  on public.org_media (organization_id, created_at desc) where deleted_at is null;

alter table public.org_media enable row level security;
drop policy if exists "Org read org_media" on public.org_media;
create policy "Org read org_media" on public.org_media
  for select to authenticated using (organization_id = public.get_user_org_id());
revoke all on table public.org_media from public, anon, authenticated;
grant select on table public.org_media to authenticated;
```

Depois de aplicar: tipos regenerados (`web/utils/database.types.ts`, nunca à mão).

## 3. Disco

| Item | Valor |
|---|---|
| Variável | `MEDIA_DIR`. Padrão em dev: `<web>/.media` (no `.gitignore`; fora de `public/`). Produção: `/data/media` (volume, ver 06) |
| Variável | `MEDIA_PUBLIC_BASE`. Padrão: `${NEXT_PUBLIC_APP_URL}/media`. Sem barra no fim |
| Caminho | `<MEDIA_DIR>/<org_media.id>/960.webp` e `<MEDIA_DIR>/<org_media.id>/480.webp` |
| URL | `<MEDIA_PUBLIC_BASE>/<id>/960.webp` e `.../480.webp` |
| Imutável | Arquivo nunca é sobrescrito. Foto nova = uuid novo. Por isso o cache pode ser de 1 ano |

Módulo `web/lib/midia/armazenamento.ts` (`server-only`). É o **único** que toca no disco, para que a troca
futura por R2/S3 mexa só nele.

```ts
export const LARGURAS = [960, 480] as const
export function urlsDaMidia(id: string): { url: string; urlPequena: string }
export async function gravarVariantes(id: string, variantes: { largura: 960 | 480; dados: Buffer }[]): Promise<void>
export async function apagarDiretorio(id: string): Promise<void>   // só o script de limpeza e o rollback do upload usam
```

`gravarVariantes`: grava em `<MEDIA_DIR>/<id>.tmp/`, faz `fsync` e depois `rename` para `<MEDIA_DIR>/<id>/`
(atômico no mesmo volume). O nginx nunca enxerga arquivo pela metade. `id` validado como uuid antes de
montar qualquer caminho.

## 4. Processamento (`web/lib/midia/processar.ts`, `server-only`)

Dependência nova: `sharp` declarado em `dependencies` (versão estável atual, exata). O build roda dentro do
`node:20-alpine`, então o `npm ci` instala o binário `linuxmusl` certo. **Conferir** no relatório que
`docker compose build` passa e que `sharp` carrega no container (`node -e "require('sharp')"`).

```ts
export type Recorte = { x: number; y: number; largura: number; altura: number } // frações 0..1 da imagem enviada
export async function processarFoto(entrada: Buffer, recorte: Recorte): Promise<{
  variantes: { largura: 960 | 480; altura: number; dados: Buffer }[]
  cor: string   // "#rrggbb"
  bytes: number // soma das variantes
}>
```

Passos, nesta ordem:

1. `sharp.concurrency(1)` no carregamento do módulo; `sharp(entrada, { limitInputPixels: 40_000_000, failOn: "error" })`.
2. `metadata()`: o formato tem de ser `jpeg`, `png` ou `webp`. Qualquer outro → erro `FORMATO`.
3. `.rotate()` (aplica a orientação do EXIF) antes do recorte.
4. Recorte em pixels a partir das frações (arredondar, limitar à imagem). A proporção pedida tem de ser
   3:4 com tolerância de 2%. Fora disso → erro `RECORTE`. O lado menor do recorte tem de ter **≥ 480 px**,
   senão → erro `PEQUENA` ("foto pequena demais para o site").
5. Para cada largura (960, 480): `resize(largura, largura * 4 / 3, { fit: "cover" })` → `.webp({ quality: 80, effort: 4 })`.
   Sem `withMetadata`: o sharp já descarta EXIF/GPS por padrão. **Não** ampliar: recorte com menos de 960 px
   de largura gera a variante "960" no tamanho real (`withoutEnlargement: true`), e `largura`/`altura` gravados
   são os reais.
6. `cor`: `stats().dominant` da variante 480 → hex minúsculo.

## 5. Rota de upload `POST /api/painel/midia`

`web/app/api/painel/midia/route.ts`, `runtime = "nodejs"`.

**Requisição:** `multipart/form-data`

| Campo | Regra |
|---|---|
| `arquivo` | Blob obrigatório, `size ≤ 8 MB` (8_388_608). `type` em `image/jpeg`, `image/png`, `image/webp`. O tipo declarado é só um filtro barato: quem decide é o passo 2 do §4 |
| `recorte` | JSON `{x,y,largura,altura}`, números finitos entre 0 e 1, `x+largura ≤ 1`, `y+altura ≤ 1` |
| `alt` | Texto obrigatório, `trim`, 3 a 200 caracteres |

Antes de ler o corpo: conferir `content-length` (se vier acima de 8,5 MB → 413 sem ler).

**Ordem das checagens:**

1. Sessão (`organizacaoDaSessao`). Sem sessão → `401 UNAUTHORIZED`.
2. Papel: helper novo `exigirGestorDaOrg()` em `lib/painel-sessao.ts`, que lê `profiles.role` do usuário e
   aceita só `owner` e `admin` → senão `403 FORBIDDEN`. **Os outros pontos de escrita deste contrato usam o
   mesmo helper.**
3. Org demo/suspensa: mesma regra que as outras escritas do painel usam (conferir e seguir; registrar qual).
4. Plano: `planoPermiteVitrine(plano)` em `lib/midia/planos.ts`, com `PLANOS_COM_VITRINE = "todos"` (MV12),
   no mesmo molde de `lib/api/planos.ts` → `403 PLAN_REQUIRED`.
5. Taxa: `consumeRateLimit` (`lib/demo/rate-limit.ts`), prefixo `midia`, chave = `organization_id`, 30/hora → `429 RATE_LIMITED` + `Retry-After`.
6. Cota: `count(*)` de `org_media` ativa da org ≥ 80 → `409 MEDIA_LIMIT_REACHED` (código **novo** no
   `ErrorCode`, aditivo) com a mensagem "A biblioteca chegou a 80 fotos. Exclua as que não usa mais."
7. Corpo inválido → `422 VALIDATION_ERROR` (com `details` por campo). Arquivo grande → `413 MEDIA_TOO_LARGE`.
8. `processarFoto`. Erros `FORMATO` / `RECORTE` / `PEQUENA` → `422 VALIDATION_ERROR` com mensagem em português para a tela.
9. `id = randomUUID()` → `gravarVariantes` → `insert` em `org_media` (service role). Se o insert falhar,
   `apagarDiretorio(id)` e `500 INTERNAL_ERROR`.

**Resposta 201** (envelope `apiSuccess`):

```ts
// web/contracts/painel/midia.ts
import { z } from "zod"
import { apiSuccess } from "../comum/envelope"

export const MidiaPainel = z.object({
  id: z.uuid(),
  url: z.url(),
  urlPequena: z.url(),
  largura: z.number().int().positive(),
  altura: z.number().int().positive(),
  alt: z.string().min(3).max(200),
  cor: z.string().regex(/^#[0-9a-f]{6}$/),
  criadaEm: z.iso.datetime(),
  /** Quantos lugares usam a foto (categorias + itens de vitrine). 0 = pode excluir. */
  usos: z.number().int().nonnegative(),
}).strict()

export const UploadMidiaResposta = apiSuccess(MidiaPainel).strict()
export type MidiaPainel = z.infer<typeof MidiaPainel>
```

Sem `Cache-Control` público (`no-store`). Log de erro com `request_id`, como nas rotas da API.

## 6. Domínio `web/lib/domain/midia.ts`

Todas recebem `db` (service role) e `orgId` vindo da sessão.

```ts
listarBiblioteca(db, orgId): Promise<MidiaPainel[]>        // ativas, mais novas primeiro, com `usos`
criarMidia(db, orgId, userId, dados): Promise<MidiaPainel>   // chamada pela rota do §5
editarAlt(db, orgId, id, alt): Promise<void>
excluirMidia(db, orgId, id): Promise<void>                  // lógica: deleted_at = now()
```

- `excluirMidia` com `usos > 0` → erro `EM_USO` (a tela explica onde a foto está sendo usada). Foto de
  outra org ou inexistente → `NOT_FOUND`, sem diferenciar.
- `usos` = categorias com `media_id = id` + itens de vitrine com `media_id = id` (ativos ou não).

Server actions finas em `web/app/actions/midia.ts` (`editarAltMidia`, `excluirMidia`): `exigirGestorDaOrg` → domínio → `revalidatePath`.

## 7. Limpeza do disco `web/scripts/limpar-midia.mjs`

Node puro, no estilo de `verificar-api-publica.mjs`. Roda **dentro** do container (`docker exec elisa-app node scripts/limpar-midia.mjs`).

- Sem argumento: só **lista**. Com `--aplicar`: apaga.
- Apaga `<MEDIA_DIR>/<id>/` quando (a) `org_media.deleted_at < now() - 30 dias`, ou (b) não existe linha
  com esse id (org apagada em cascata) **e** o diretório tem mais de 30 dias de `mtime`. Também apaga
  `*.tmp/` com mais de 1 hora.
- Depois de apagar os arquivos de (a), apaga a linha.
- Usa `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SUPABASE_URL` do ambiente.
- Sem cron neste contrato: rodar à mão uma vez por mês (anotado em `docs/DEPLOY.md`).

## 8. Aceite do 01

- [ ] Migration aplicada; `anon` sem nenhum privilégio em `org_media` (conferir em `information_schema.table_privileges`); tipos regenerados.
- [ ] Upload de JPEG de celular de 4 MB → 201; os dois `.webp` existem, sem EXIF (`exiftool` ou `sharp().metadata()` sem `exif`).
- [ ] PNG renomeado para `.jpg`, SVG, GIF e um `.txt` com `type` forjado → 422/413, nada gravado em disco.
- [ ] Recorte 1:1 → 422. Recorte de 300 px → 422 com "pequena demais".
- [ ] Usuário `professional` → 403. Sem sessão → 401.
- [ ] Insert que falha (forçar no dev) não deixa diretório órfão.
- [ ] `limpar-midia.mjs` lista sem apagar; com `--aplicar` remove só o que passou dos 30 dias.
