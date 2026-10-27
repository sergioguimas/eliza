-- Horários fechados na agenda: intervalo em que um profissional não atende (folga, compromisso, almoço
-- fora do padrão). Ocupa a agenda como um agendamento ativo, mas NÃO é atendimento: sem cliente, sem
-- preço, sem lembrete, fora de financeiro e de relatórios. Por isso é tabela própria e não um
-- `appointments` com tipo (customer_id é NOT NULL e 17 pontos do código leem appointments).
--
-- Entra nos horários livres por `lib/domain/horarios.ts` (carregarDiaDeAgenda), a mesma fonte de
-- /marcar, API v1 e Autoatendimento. Nenhum contrato muda: o horário fechado aparece como `ocupado`.
--
-- Escrita só pelo domínio (service role), como `appointments` (D9): `authenticated` só LÊ a própria org.
-- Toda tabela nova precisa de REVOKE explícito: o default privileges do Supabase dá tudo a anon.
create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint schedule_blocks_range check (end_time > start_time),
  constraint schedule_blocks_reason_len check (reason is null or char_length(reason) <= 200)
);

comment on table public.schedule_blocks is
  'Horários fechados por profissional. Contam como ocupados nos horários livres; não são atendimento (sem cliente, preço, lembrete ou relatório). Escrita só pelo domínio com service role.';
comment on column public.schedule_blocks.created_by is 'profiles.id de quem fechou o horário (sem FK: o histórico sobrevive à troca de equipe).';

create index if not exists schedule_blocks_org_prof_time_idx
  on public.schedule_blocks (organization_id, professional_id, start_time, end_time);

alter table public.schedule_blocks enable row level security;

drop policy if exists "Org read schedule_blocks" on public.schedule_blocks;
create policy "Org read schedule_blocks" on public.schedule_blocks
  for select to authenticated
  using (organization_id = public.get_user_org_id());

revoke all on table public.schedule_blocks from public, anon, authenticated;
grant select on table public.schedule_blocks to authenticated;
