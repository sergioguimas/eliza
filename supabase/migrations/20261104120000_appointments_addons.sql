-- Adicionais escolhidos no agendamento. `appointments.price` passa a ser o total (serviço + adicionais),
-- então esta coluna é só a cópia do que foi escolhido: [{id, name, price, unit, quantity}], com `price`
-- sendo o valor unitário da época. Mudar o catálogo depois não altera agendamento já feito.
-- Contrato: docs/contratos/adicionais/README.md
alter table public.appointments
  add column if not exists addons jsonb not null default '[]'::jsonb;

-- CASE porque o AND não garante a ordem: jsonb_array_length falha em valor que não é array.
alter table public.appointments
  drop constraint if exists appointments_addons_array,
  add constraint appointments_addons_array
    check (case when jsonb_typeof(addons) = 'array' then jsonb_array_length(addons) <= 10 else false end);

comment on column public.appointments.addons is
  'Cópia dos adicionais escolhidos: [{id, name, price, unit, quantity}]. price é o valor unitário da época. appointments.price já inclui a soma.';

-- Cada adicional do catálogo ganha um id estável, a referência usada ao agendar. Idempotente: rodar de
-- novo depois do deploy, porque o código antigo descarta o id ao salvar um serviço.
update public.services s
set addons = (
  select coalesce(jsonb_agg(
    case when item ? 'id' then item else item || jsonb_build_object('id', gen_random_uuid()) end
    order by ordem
  ), '[]'::jsonb)
  from jsonb_array_elements(s.addons) with ordinality as t(item, ordem)
)
where exists (select 1 from jsonb_array_elements(s.addons) as e(item) where not e.item ? 'id');

comment on column public.services.addons is
  'Custos adicionais opcionais: [{id, name, price, unit}]. Até 10. Escolhidos no agendamento, somam ao appointments.price.';
