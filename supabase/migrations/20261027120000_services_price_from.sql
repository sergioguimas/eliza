-- Preço "a partir de": o serviço tem um valor mínimo e o final depende do que o cliente pedir a mais.
-- `price` continua sendo o valor (agora o piso quando `price_from = true`). Default false: nenhum
-- serviço existente muda de comportamento.
alter table public.services
  add column if not exists price_from boolean not null default false;

comment on column public.services.price_from is
  'true = `price` é o valor mínimo ("a partir de"); o final é combinado no atendimento. Exibido em /marcar, no catálogo público e nas APIs.';

-- `description` já existia (API v1, Autoatendimento e catálogo público a expõem) mas o painel não a
-- editava. Passa a ser as observações do serviço, visíveis ao cliente final. Mesmo teto do contrato
-- público (500). Nenhuma linha atual tem descrição, então a constraint não rejeita dado existente.
alter table public.services
  drop constraint if exists services_description_len,
  add constraint services_description_len
    check (description is null or char_length(description) <= 500);

comment on column public.services.description is
  'Observações do serviço, exibidas ao cliente final (/marcar, catálogo público, APIs). Até 500 caracteres.';
