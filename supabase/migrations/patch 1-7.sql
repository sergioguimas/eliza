-- 1. Cria a tabela de templates de mensagem
create table if not exists message_templates (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references organizations(id) on delete cascade not null,
  type text not null, -- Identificador para o código (Ex: 'cancellation_response')
  name text not null, -- Nome amigável para você ver na tela (Ex: "Resposta ao Cancelar")
  content text not null, -- O texto da mensagem com variáveis
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Garante que só existe 1 modelo de cada tipo por clínica
  constraint unique_template_type_per_org unique (organization_id, type)
);

-- 2. Configura a Segurança (RLS)
alter table message_templates enable row level security;

-- Permite que usuários vejam/editem apenas templates da sua organização
create policy "Gerenciar templates da própria clínica"
  on message_templates for all
  using (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));

-- 3. Gatilho para atualizar a data de edição automaticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_message_templates_updated_at
before update on message_templates
for each row
execute procedure update_updated_at_column();

-- 4. INSERIR DADOS PADRÃO (Seed)
-- Isso vai criar o template inicial para todas as clínicas que já existem no banco
insert into message_templates (organization_id, type, name, content)
select 
  id as organization_id,
  'cancellation_response' as type,
  'Resposta Automática de Cancelamento' as name,
  'Poxa, que pena! 😕\n\nJá cancelei seu horário aqui.\n\nSe quiser remarcar para *amanhã*, tenho estes horários livres:\n\n{{horarios_livres}}\n\nResponda com o horário desejado ou me chame para ver outros dias!' as content
from organizations
on conflict (organization_id, type) do nothing;