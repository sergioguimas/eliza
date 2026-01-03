-- Migration de Correção: Adiciona campos que faltaram no Schema original
-- Data: 03/01/2025

-- 1. Melhorias na Tabela de Clientes (Customers)
alter table public.customers 
add column if not exists active boolean default true,
add column if not exists gender text;

-- Adiciona índice para filtrar clientes ativos rapidamente
create index if not exists idx_customers_active on public.customers(active);


-- 2. Melhorias na Tabela de Serviços (Services)
-- Adiciona a cor para o calendário visual
alter table public.services 
add column if not exists color text default '#3b82f6';


-- 3. Melhorias na Tabela de Notas/Prontuários (Service Notes)
-- Adiciona suporte para o fluxo de Assinatura Digital e Travamento
alter table public.service_notes 
add column if not exists status text default 'draft' check (status in ('draft', 'signed')),
add column if not exists signed_at timestamptz;

-- Adiciona índice para listar por status
create index if not exists idx_service_notes_status on public.service_notes(status);

-- Adiciona campos de contato na tabela de Organizações (Clínica)
alter table public.organizations 
add column if not exists address text,
add column if not exists phone text,
add column if not exists email text;

-- Adiciona o CRM na tabela de Perfis (Médico)
alter table public.profiles
add column if not exists crm text;