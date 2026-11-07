-- Agenda visível por N dias, por organização (contrato autoatendimento/11).
-- Vale para o atendente (API de Autoatendimento) e para a página pública /marcar.
-- 0 = agenda fechada: nenhum horário é mostrado e nada é marcado por esses canais.
-- Aditiva: o código antigo não lê a coluna, então pode ser aplicada antes do deploy.

alter table public.organization_settings
  add column if not exists agenda_visivel_dias integer not null default 60;

alter table public.organization_settings
  drop constraint if exists organization_settings_agenda_visivel_dias_check;

alter table public.organization_settings
  add constraint organization_settings_agenda_visivel_dias_check
  check (agenda_visivel_dias between 0 and 365);

comment on column public.organization_settings.agenda_visivel_dias is
  'Quantos dias à frente o atendente e o /marcar podem mostrar e marcar (0 = agenda fechada, só triagem). Contrato autoatendimento/11.';

comment on column public.autoatendimento_config.janela_maxima_dias is
  'OBSOLETO desde 2026-11-07: o Eliza não lê mais esta coluna; vale organization_settings.agenda_visivel_dias. Remover numa versão MAIOR.';
