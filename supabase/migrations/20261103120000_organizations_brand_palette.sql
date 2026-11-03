-- Paleta de cor por organização. O nicho continua decidindo terminologia e a cor PADRÃO (theme-<nicho>);
-- `brand_palette` sobrepõe só a cor, a partir de uma lista fechada de paletas já validadas em contraste
-- (globals.css, `.palette-<id>`). Cor livre ficou de fora de propósito: cada paleta tem variante clara e
-- escura conferida, e um hex qualquer quebraria texto/botão em um dos modos.
-- null = cor do nicho (nenhuma organização existente muda).
alter table public.organizations
  add column if not exists brand_palette text;

alter table public.organizations
  drop constraint if exists organizations_brand_palette_check,
  add constraint organizations_brand_palette_check
    check (brand_palette is null or brand_palette in ('grafite', 'salvia', 'areia'));

comment on column public.organizations.brand_palette is
  'Paleta de cor escolhida pela organização (grafite, salvia, areia); null = cor padrão do nicho. Aplicada no painel e em /marcar.';

-- Não é dado sensível: /marcar (anon) e o painel (authenticated) precisam ler. A escrita fica com
-- owner/admin da própria org pela policy "Owners and admins update own org", como name e niche.
grant select (brand_palette) on public.organizations to anon, authenticated;
grant update (brand_palette) on public.organizations to authenticated;
