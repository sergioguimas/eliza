-- Liga o chat da página pública por org, independente do WhatsApp (contrato 08 §1).
alter table public.autoatendimento_config
  add column canal_web boolean not null default false;
