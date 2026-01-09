-- 1. Cria a tabela de configurações se ela não existir
create table if not exists organization_settings (
  organization_id uuid references organizations(id) primary key,
  open_hours_start time default '08:00',
  open_hours_end time default '18:00',
  appointment_duration integer default 60,
  days_of_week integer[] default array[1, 2, 3, 4, 5], -- 1=Seg, 5=Sex
  
  -- Mensagens Personalizadas
  whatsapp_message_created text default 'Olá {name}, seu agendamento para {service} foi confirmado para {date} às {time}.',
  whatsapp_message_reminder text default 'Olá {name}, passando para lembrar do seu agendamento amanhã às {time}. Digite 1 para confirmar ou 2 para cancelar.',
  whatsapp_message_canceled text default 'Olá {name}, seu agendamento para {date} às {time} foi cancelado.',
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Habilita RLS (Segurança)
alter table organization_settings enable row level security;

-- 3. Cria políticas de segurança (Permite ler/editar se for da mesma organização)
create policy "Users can view settings of their own organization"
  on organization_settings for select
  using ( organization_id in (select organization_id from profiles where id = auth.uid()) );

create policy "Users can update settings of their own organization"
  on organization_settings for update
  using ( organization_id in (select organization_id from profiles where id = auth.uid()) );

create policy "Users can insert settings of their own organization"
  on organization_settings for insert
  with check ( organization_id in (select organization_id from profiles where id = auth.uid()) );

-- 4. Cria automaticamente uma linha de configuração para cada organização existente (para não ficar vazio)
insert into organization_settings (organization_id)
select id from organizations
on conflict (organization_id) do nothing;