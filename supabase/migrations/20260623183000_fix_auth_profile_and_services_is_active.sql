-- 1. Padronizar services.active para services.is_active
alter table public.services
rename column active to is_active;

-- 2. Atualizar handle_new_user para suportar metadata multi-tenant
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
-- função corrigida
$$;

-- 3. Atualizar request_public_appointment para usar services.is_active
create or replace function public.request_public_appointment(...)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
-- função corrigida
$$;

-- 4. Recarregar schema
notify pgrst, 'reload schema';