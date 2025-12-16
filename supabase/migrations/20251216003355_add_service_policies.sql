-- === 1. SERVIÇOS (SERVICES) ===
-- Permitir CRIAR serviços se o tenant_id for o mesmo do meu perfil
create policy "Enable insert for services"
on public.services for insert
to authenticated
with check (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

-- Permitir ATUALIZAR serviços
create policy "Enable update for services"
on public.services for update
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

-- Permitir DELETAR serviços
create policy "Enable delete for services"
on public.services for delete
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

-- === 2. CLIENTES (CUSTOMERS) ===
create policy "Enable read customers"
on public.customers for select
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

create policy "Enable insert customers"
on public.customers for insert
to authenticated
with check (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

create policy "Enable update customers"
on public.customers for update
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

-- === 3. AGENDAMENTOS (APPOINTMENTS) ===
create policy "Enable read appointments"
on public.appointments for select
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

create policy "Enable insert appointments"
on public.appointments for insert
to authenticated
with check (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);

create policy "Enable update appointments"
on public.appointments for update
to authenticated
using (
  tenant_id = (select tenant_id from public.profiles where id = auth.uid())
);