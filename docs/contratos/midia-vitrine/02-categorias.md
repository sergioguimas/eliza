# 02 — Categorias com foto e ordem

> **TO-BE** · Fase F1 (banco + domínio) e F2 (tela) · executor: Sonnet · revisão: Opus
> Revê a decisão **P3** do contrato `api-publica` ("tabela só se surgir ordenação/ícone por categoria"): surgiu.

## 1. AS-IS

- `services.category text` (1–40 caracteres ou `null`), texto livre por serviço, editado em
  `create-service-dialog.tsx` → `upsertService`.
- Não há tabela de categorias. A LP agrupa por `categoria` e ordena pela lista fixa `SERVICE_ORDER` do `site.ts`.
- Org da Deborah (`deborah-pereira`) hoje: Alongamento, Nail Art Premium, Banho de Gel, Manicure e
  Pedicure, Blindagem, Reconstrução + Blindagem.

## 2. Modelo (MV4)

`services.category` **continua sendo a fonte** de qual categoria existe e de quais serviços estão nela.
`service_categories` guarda só o que é **da categoria**: foto e ordem. A ligação é pela **chave**
`lower(btrim(nome))`.

- Categoria que existe nos serviços e não tem linha na tabela = sem foto, ordem padrão. Nada quebra.
- Linha cuja chave nenhum serviço ativo usa = ignorada pelas leituras (sobra inofensiva). O domínio
  **não** apaga sozinho: se a dona reativar o serviço, a foto volta.
- A linha é criada sob demanda, quando a dona define foto ou ordem (upsert pela chave).

## 3. Migration (mesmo arquivo do 01)

```sql
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  chave text generated always as (lower(btrim(nome))) stored,
  ordem integer not null default 0,
  media_id uuid,
  updated_at timestamptz not null default now(),
  constraint service_categories_nome_len check (char_length(btrim(nome)) between 1 and 40),
  constraint service_categories_ordem check (ordem between 0 and 999),
  constraint service_categories_org_chave_uk unique (organization_id, chave),
  -- foto só da própria org; ao apagar a mídia (linha), a categoria fica sem foto
  constraint service_categories_media_fk foreign key (media_id, organization_id)
    references public.org_media (id, organization_id) on delete set null (media_id)
);

comment on table public.service_categories is
  'Metadado por categoria de serviço (foto e ordem). A categoria em si é services.category; ligação por chave = lower(btrim(nome)). Contrato midia-vitrine/02.';

alter table public.service_categories enable row level security;
drop policy if exists "Org read service_categories" on public.service_categories;
create policy "Org read service_categories" on public.service_categories
  for select to authenticated using (organization_id = public.get_user_org_id());
revoke all on table public.service_categories from public, anon, authenticated;
grant select on table public.service_categories to authenticated;
```

`on delete set null (media_id)` exige Postgres 15 ou superior. **Conferir** a versão do projeto
(`select version()`); se for menor, trocar por FK simples em `media_id` mais um trigger que valida a org,
e registrar no relatório.

### 3.1 Renomear categoria (função)

Renomear pelo formulário de cada serviço continua possível, mas deixa a foto para trás. Por isso a tela de
categorias (05) renomeia **todas de uma vez** por esta função, numa transação só:

```sql
create or replace function public.renomear_categoria(p_org uuid, p_de text, p_para text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_de text := lower(btrim(p_de));
  v_para_nome text := btrim(p_para);
  v_para text := lower(btrim(p_para));
begin
  if v_para_nome is null or char_length(v_para_nome) not between 1 and 40 then
    raise exception 'nome de categoria inválido' using errcode = '22023';
  end if;

  update public.services set category = v_para_nome
   where organization_id = p_org and lower(btrim(category)) = v_de;

  if v_de = v_para then
    -- só mudou maiúscula/espaço: atualiza o nome exibido
    update public.service_categories set nome = v_para_nome, updated_at = now()
     where organization_id = p_org and chave = v_de;
  elsif exists (select 1 from public.service_categories where organization_id = p_org and chave = v_para) then
    -- juntou com uma categoria que já existe: vale a foto/ordem do DESTINO
    delete from public.service_categories where organization_id = p_org and chave = v_de;
  else
    update public.service_categories set nome = v_para_nome, updated_at = now()
     where organization_id = p_org and chave = v_de;
  end if;
end $$;

revoke all on function public.renomear_categoria(uuid, text, text) from public, anon, authenticated;
grant execute on function public.renomear_categoria(uuid, text, text) to service_role;
```

## 4. Domínio `web/lib/domain/categorias.ts`

```ts
export type CategoriaPainel = {
  nome: string            // como aparece nos serviços (o primeiro encontrado, por título)
  chave: string
  servicos: number        // ativos com essa categoria
  ordem: number | null    // null = sem linha na tabela
  foto: MidiaPainel | null
}

listarCategorias(db, orgId): Promise<CategoriaPainel[]>          // já na ordem final (§5)
definirFotoCategoria(db, orgId, nome, mediaId | null): Promise<void>
reordenarCategorias(db, orgId, chavesNaOrdem: string[]): Promise<void>
renomearCategoria(db, orgId, de, para): Promise<void>            // chama a função do §3.1
categoriasPublicas(db, orgId, servicos: Servico[]): Promise<{ nome: string; foto: FotoPublica | null }[]>  // usada pela rota pública (04)
```

- `definirFotoCategoria`: a mídia tem de ser da org e ativa (`deleted_at is null`), senão `NOT_FOUND`.
  `null` tira a foto. Upsert pela chave, mantendo `ordem` se a linha já existir.
- `reordenarCategorias`: recebe a lista inteira de chaves exibidas na tela. Grava `ordem = índice * 10`
  (folga para mexer à mão) com upsert. Chave que não está em nenhum serviço ativo → `VALIDATION_ERROR`.
- `categoriasPublicas` recebe os serviços **já listados** pela rota pública (não consulta `services` de novo).

Server actions finas em `web/app/actions/categorias.ts`: `exigirGestorDaOrg` → domínio → `revalidatePath("/servicos")`.

## 5. Ordem final (fonte única, usada pelo painel e pela API pública)

1. Categorias **com** linha, por `ordem` crescente e depois por `nome`.
2. Categorias **sem** linha, por `nome` (`localeCompare(..., "pt-BR", { sensitivity: "base" })`).

Serviço sem categoria não é categoria: não entra em `categorias`. A LP o mostra como ilha própria, como já faz hoje.

## 6. Aceite do 02

- [ ] Org `admin` com 3 categorias: definir foto em uma, reordenar, e `listarCategorias` devolve na ordem nova.
- [ ] Renomear "Alongamento" → "Alongamentos" muda todos os serviços e mantém a foto.
- [ ] Renomear A → B, com B já existente com foto: os serviços de A vão para B e vale a foto de B.
- [ ] Mídia de outra org em `definirFotoCategoria` → `NOT_FOUND` (e a FK recusa mesmo por SQL direto).
- [ ] Excluir a linha de `org_media` (por SQL, para testar a FK) deixa a categoria sem foto, sem erro.
