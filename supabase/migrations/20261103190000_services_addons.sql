-- Custos adicionais opcionais do serviço, ex.: "Unha quebrada", R$ 5 por unha. Cada item é
-- {"name": text, "price": number, "unit": text | null}; unit null = valor fixo. Só informam o
-- cliente: não entram no preço do agendamento. Default '[]': nenhum serviço existente muda.
-- A forma de cada item é validada em web/lib/adicionais.ts, na escrita e na leitura.
alter table public.services
  add column if not exists addons jsonb not null default '[]'::jsonb;

-- CASE porque o AND não garante a ordem: jsonb_array_length falha em valor que não é array.
alter table public.services
  drop constraint if exists services_addons_array,
  add constraint services_addons_array
    check (case when jsonb_typeof(addons) = 'array' then jsonb_array_length(addons) <= 10 else false end);

comment on column public.services.addons is
  'Custos adicionais opcionais: [{name, price, unit}]. Até 10. Exibidos no painel e nas APIs; não alteram o preço do agendamento.';
