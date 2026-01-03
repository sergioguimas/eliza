-- 1. Garante colunas na tabela de Perfis (Médico)
alter table public.profiles 
add column if not exists crm text;

-- 2. Garante colunas na tabela de Organizações (Clínica)
alter table public.organizations 
add column if not exists address text,
add column if not exists phone text,
add column if not exists email text,
add column if not exists evolution_api_url text,
add column if not exists evolution_api_key text;

-- 3. Trigger Essencial: Cria Perfil Automaticamente ao Cadastrar
-- Isso evita que o usuário fique "sem perfil" ao fazer login
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuário'),
    'staff'
  )
  on conflict (id) do nothing; -- Se já existir, não faz nada
  return new;
end;
$$ language plpgsql security definer;

-- Recria a trigger para garantir que está ativa
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();