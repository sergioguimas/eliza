-- Biblioteca de fotos, foto/ordem por categoria e vitrine (contrato docs/contratos/midia-vitrine, 01–03).
-- Os BYTES ficam em disco (MEDIA_DIR/<id>/{960,480}.webp, servidos por nginx em /media/); aqui só metadado.
-- Escrita só pelo domínio com service role, como schedule_blocks: authenticated só LÊ a própria org.
-- Toda tabela nova precisa de REVOKE explícito: o default privileges do Supabase dá tudo a anon.
-- Aditiva: o código antigo não lê nada daqui, então pode ser aplicada antes do deploy.

-- ---------------------------------------------------------------------------------------------
-- 01 — org_media
-- ---------------------------------------------------------------------------------------------
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
comment on column public.org_media.largura is 'Dimensões da variante grande (hoje até 960x1280).';
comment on column public.org_media.created_by is 'profiles.id de quem enviou (sem FK, como em schedule_blocks).';

create index if not exists org_media_org_ativas_idx
  on public.org_media (organization_id, created_at desc) where deleted_at is null;

alter table public.org_media enable row level security;
drop policy if exists "Org read org_media" on public.org_media;
create policy "Org read org_media" on public.org_media
  for select to authenticated using (organization_id = public.get_user_org_id());
revoke all on table public.org_media from public, anon, authenticated;
grant select on table public.org_media to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 02 — service_categories (a categoria em si continua sendo services.category; ligação por chave)
-- ---------------------------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------------------------
-- 03 — vitrine_items
-- ---------------------------------------------------------------------------------------------
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
