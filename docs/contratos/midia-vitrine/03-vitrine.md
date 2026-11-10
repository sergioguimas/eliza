# 03 — Vitrine (destaques do trabalho)

> **TO-BE** · Fase F1 (banco + domínio) e F2 (tela) · executor: Sonnet · revisão: Opus

## 1. O que é

Uma lista **ordenada** de fotos da biblioteca, cada uma com legenda e, opcionalmente, a categoria que a
foto representa. É o "Trabalhos que saíram daqui" da LP da Deborah e, depois (MV14), um bloco do `/marcar`.
Recurso do Eliza para qualquer org, não da LP.

## 2. Migration (mesmo arquivo do 01)

```sql
create table if not exists public.vitrine_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  media_id uuid not null,
  legenda text not null,
  categoria text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint vitrine_items_legenda_len check (char_length(btrim(legenda)) between 1 and 60),
  constraint vitrine_items_categoria_len check (categoria is null or char_length(btrim(categoria)) between 1 and 40),
  constraint vitrine_items_ordem check (ordem between 0 and 9999),
  -- foto só da própria org; foto usada na vitrine não pode sumir (excluir da biblioteca é bloqueado no domínio)
  constraint vitrine_items_media_fk foreign key (media_id, organization_id)
    references public.org_media (id, organization_id) on delete restrict
);

comment on table public.vitrine_items is
  'Destaques ordenados da org (fotos da biblioteca org_media). categoria = texto como em services.category, ligado por lower(btrim()). Contrato midia-vitrine/03.';

create index if not exists vitrine_items_org_ordem_idx
  on public.vitrine_items (organization_id, ordem) where ativo;

alter table public.vitrine_items enable row level security;
drop policy if exists "Org read vitrine_items" on public.vitrine_items;
create policy "Org read vitrine_items" on public.vitrine_items
  for select to authenticated using (organization_id = public.get_user_org_id());
revoke all on table public.vitrine_items from public, anon, authenticated;
grant select on table public.vitrine_items to authenticated;
```

**Sem `service_id`:** o card da LP leva para a categoria, e a categoria é o que a dona entende. Ligação a
um serviço específico fica para quando surgir um pedido concreto (seria coluna nova, aditiva).

## 3. Regras

| Regra | Valor |
|---|---|
| Itens ativos por org | no máximo **24** (`LIMITE_VITRINE`). O 25º → `409 CONFLICT` "A vitrine já tem 24 fotos. Desative ou remova uma." |
| Itens no total (ativos + inativos) | no máximo 60 |
| Mesma foto em dois itens | permitido (legendas diferentes) |
| `categoria` | texto livre; a tela oferece só as categorias existentes (02 `listarCategorias`) ou "Nenhuma". Guardar `btrim` |
| Ordem | `ordem` crescente, depois `created_at`. Reordenar grava `índice * 10` |
| Remover item | apaga a linha (a foto continua na biblioteca) |

## 4. Domínio `web/lib/domain/vitrine.ts`

```ts
export type ItemVitrinePainel = {
  id: string; legenda: string; categoria: string | null; ordem: number; ativo: boolean; foto: MidiaPainel
}

listarVitrine(db, orgId): Promise<ItemVitrinePainel[]>                       // todos, na ordem
adicionarItem(db, orgId, { mediaId, legenda, categoria }): Promise<ItemVitrinePainel>  // entra no fim, ativo
editarItem(db, orgId, id, { legenda?, categoria?, ativo? }): Promise<void>
reordenarVitrine(db, orgId, idsNaOrdem: string[]): Promise<void>            // lista inteira
removerItem(db, orgId, id): Promise<void>
vitrinePublica(db, orgId, categoriasExistentes: Set<string>): Promise<ItemVitrinePublico[]>  // usada pela rota pública (04)
```

- Toda função confere que o item e a mídia são da org (`NOT_FOUND`, sem diferenciar).
- `vitrinePublica`: só `ativo = true`, mídia com `deleted_at is null`, no máximo 24, na ordem. Se a
  `categoria` do item não estiver entre as categorias dos serviços ativos, sai como `null` (categoria que
  não existe mais não vira link quebrado na LP).
- Excluir da biblioteca uma foto usada na vitrine é bloqueado em `excluirMidia` (01 §6, `usos > 0`).

Server actions finas em `web/app/actions/vitrine.ts`, com `revalidatePath("/vitrine")`.

## 5. Aceite do 03

- [ ] Adicionar 3 itens, reordenar, desativar 1: `vitrinePublica` devolve 2, na ordem nova.
- [ ] 25º item ativo → recusado com a mensagem do §3.
- [ ] Item com categoria "Pés" (que nenhum serviço ativo usa) sai com `categoria: null` na pública.
- [ ] Tentar excluir da biblioteca a foto de um item → recusado, e a tela diz "usada na vitrine".
