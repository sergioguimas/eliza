BEGIN;

-- ---------------------------------------------------------------------------
-- Envios automáticos do Eliza (lembrete, notificação...) pelo número da org.
-- Contrato: docs/contratos/autoatendimento/09-avisos-do-sistema.md (C23–C26).
--
-- O registro é gravado ANTES do envio, só para org com o add-on ativo. Quando
-- o eco `fromMe` volta pelo webhook, o texto casa com um registro dos últimos
-- 10 minutos e vai ao atendente como `aviso` (contexto, sem pausar) em vez de
-- intervenção da equipe. Guarda só o hash do texto, nunca o conteúdo.
--
-- Só o servidor (service role) lê e escreve: sem policy, sem grant ao client.
-- Limpeza oportunista (> 24 h) a cada registro da mesma org. Aditiva.
-- ---------------------------------------------------------------------------

CREATE TABLE public.autoatendimento_envios_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'lembrete', 'resumo_profissional', 'notificacao', 'resposta_automatica', 'escalonamento'
  )),
  texto_hash text NOT NULL CHECK (char_length(texto_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX autoatendimento_envios_sistema_busca
  ON public.autoatendimento_envios_sistema (organization_id, texto_hash, created_at DESC);

ALTER TABLE public.autoatendimento_envios_sistema ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.autoatendimento_envios_sistema FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.autoatendimento_envios_sistema TO service_role;

COMMIT;

-- Verificação pós-aplicação:
--
-- select has_table_privilege('authenticated','public.autoatendimento_envios_sistema','SELECT') as auth_le,
--        has_table_privilege('anon','public.autoatendimento_envios_sistema','SELECT') as anon_le,
--        has_table_privilege('service_role','public.autoatendimento_envios_sistema','INSERT') as servico_grava;
-- -- esperado: false, false, true
