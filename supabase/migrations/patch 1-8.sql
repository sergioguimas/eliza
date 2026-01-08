create type record_status as enum ('draft', 'signed');

create table if not exists medical_records (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade not null,
  professional_id uuid references profiles(id) on delete set null, -- Quem atendeu
  
  content text not null, -- O texto do prontuário (pode ser HTML ou texto puro)
  status record_status default 'draft', -- 'draft' (editável) ou 'signed' (travado)
  
  signed_at timestamptz, -- Data exata da assinatura
  signed_by uuid references profiles(id), -- Quem assinou
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Habilitar RLS (Segurança)
alter table medical_records enable row level security;

create policy "Ver prontuários da própria clínica"
  on medical_records for select
  using (organization_id in (select organization_id from profiles where id = auth.uid()));

create policy "Criar/Editar prontuários da própria clínica"
  on medical_records for all
  using (organization_id in (select organization_id from profiles where id = auth.uid()));