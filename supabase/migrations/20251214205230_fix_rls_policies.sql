-- 1. Permitir que qualquer usuário autenticado crie um tenant (Sua Empresa)
create policy "Enable insert for authenticated users only"
on public.tenants for insert
to authenticated
with check (true);

-- 2. Permitir que o usuário veja seu próprio tenant
-- (A lógica é: Eu vejo o tenant se meu perfil apontar para ele)
create policy "Users can view own tenant"
on public.tenants for select
to authenticated
using ( id in (select tenant_id from public.profiles where id = auth.uid()) );

-- 3. Permitir que o usuário crie seu próprio perfil
create policy "Enable insert for users based on user_id"
on public.profiles for insert
to authenticated
with check ( auth.uid() = id );

-- 4. Permitir que o usuário veja seu próprio perfil
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( auth.uid() = id );

-- 5. Permitir atualização do próprio perfil
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ( auth.uid() = id );