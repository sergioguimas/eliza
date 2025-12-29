-- 1. Permitir que usuários vejam a organização que está vinculada no perfil deles
create policy "Users can view own organization"
on public.organizations for select
using (
  id in (
    select organization_id from public.profiles
    where id = auth.uid()
  )
);

-- 2. Permitir que o DONO atualize os dados da própria organização
create policy "Owners can update own organization"
on public.organizations for update
using (
  id in (
    select organization_id from public.profiles
    where id = auth.uid()
    and role = 'owner'
  )
);