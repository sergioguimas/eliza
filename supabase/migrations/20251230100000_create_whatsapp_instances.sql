-- 1. Cria a tabela de instâncias do WhatsApp (Vinculada a Organizations)
create table if not exists public.whatsapp_instances (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- AQUI A MUDANÇA CRUCIAL:
  organization_id uuid not null references public.organizations(id) on delete cascade, 
  
  name text not null, -- slug da organization
  status text default 'pending', 
  qr_code text, 
  
  constraint whatsapp_instances_organization_id_key unique (organization_id)
);

-- 2. Habilita RLS
alter table public.whatsapp_instances enable row level security;

-- 3. Policies (Atualizadas para checar organization_id no profile)

create policy "Users can view their own whatsapp instance"
on public.whatsapp_instances for select
using (
  organization_id in (
    select organization_id from public.profiles 
    where id = auth.uid()
  )
);

create policy "Users can update their own whatsapp instance"
on public.whatsapp_instances for all
using (
  organization_id in (
    select organization_id from public.profiles 
    where id = auth.uid()
  )
);