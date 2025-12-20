-- 1. Habilitar extensões
create extension if not exists "uuid-ossp";
create extension if not exists "btree_gist";

-- 2. Tabela de Tenants
create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  slug text unique not null,
  stripe_customer_id text,
  subscription_status text default 'active',
  whatsapp_config jsonb default '{}'::jsonb
);

-- 3. Tabela de Perfis
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  tenant_id uuid references public.tenants(id),
  full_name text,
  role text default 'staff' check (role in ('owner', 'admin', 'staff'))
);

-- 4. Tabela de Serviços
create table public.services (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) not null,
  title text not null,
  duration_minutes int not null default 30,
  price decimal(10,2) default 0.00,
  is_active boolean default true
);

-- 5. Tabela de Clientes
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) not null,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz default now()
);

-- 6. Tabela de Agendamentos
create table public.appointments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references public.tenants(id) not null,
  service_id uuid references public.services(id),
  customer_id uuid references public.customers(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'canceled', 'completed')),
  notes text,
  
  -- CONSTRAINT CORRIGIDA:
  -- Usamos 'tstzrange' (Time Stamp Time Zone Range) em vez de 'tsrange'
  exclude using gist (
    tenant_id with =,
    tstzrange(start_time, end_time) with &&
  )
);

-- INDEXES
create index idx_appointments_tenant_range on public.appointments (tenant_id, start_time, end_time);
create index idx_customers_phone on public.customers (phone);

-- RLS (Segurança)
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;

-- Função auxiliar para RLS
create or replace function public.get_my_tenant_id()
returns uuid as $$
  select tenant_id from public.profiles where id = auth.uid() limit 1;
$$ language sql security definer;

-- Policies Básicas (Exemplo)
create policy "Users can view services from their own tenant"
on public.services for select
using ( tenant_id = get_my_tenant_id() );