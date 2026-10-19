alter table public.services
  add column if not exists category text
  check (category is null or (char_length(btrim(category)) between 1 and 40));

comment on column public.services.category is
  'Agrupamento opcional exibido em sites/canais públicos (ex.: "Alongamento"). null = sem grupo.';
