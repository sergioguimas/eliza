BEGIN;

-- ---------------------------------------------------------------------------
-- Configuração do add-on de Autoatendimento (atendente por WhatsApp).
-- Contrato: docs/contratos/autoatendimento/01-configuracao.md (C6).
--
-- Uma linha por org. SEM linha = add-on desligado; o código nunca cria a
-- linha sozinho (na F0 liga-se pelo Studio).
--
-- Sem `status_inicial`: o agendamento do bot nasce SEMPRE `pending`, igual à
-- página pública (D8, docs/contratos/DECISOES_API.md). Não é configurável.
--
-- `on delete cascade`: remover uma org já falha por FK em sete tabelas; esta
-- não entra na lista.
--
-- `authenticated` só LÊ, e só a própria org. Ninguém escreve pelo client: a
-- trava de escrita é o grant, não a policy (mesmo padrão de organizations
-- desde 2026-08-11). Aditiva, sem ordem de deploy a respeitar.
-- ---------------------------------------------------------------------------

CREATE TABLE public.autoatendimento_config (
  organization_id uuid PRIMARY KEY
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  antecedencia_minima_minutos integer NOT NULL DEFAULT 120
    CHECK (antecedencia_minima_minutos BETWEEN 0 AND 10080),
  janela_maxima_dias integer NOT NULL DEFAULT 60
    CHECK (janela_maxima_dias BETWEEN 1 AND 365),
  max_agendamentos_ativos integer NOT NULL DEFAULT 3
    CHECK (max_agendamentos_ativos BETWEEN 1 AND 20),
  contato_humano_telefone text,
  instrucoes_atendimento text
    CHECK (char_length(instrucoes_atendimento) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autoatendimento_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.autoatendimento_config FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.autoatendimento_config TO authenticated;
GRANT ALL ON public.autoatendimento_config TO service_role;

CREATE POLICY "Org members read own autoatendimento config"
  ON public.autoatendimento_config
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id());

CREATE TRIGGER update_autoatendimento_config_updated_at
  BEFORE UPDATE ON public.autoatendimento_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- Verificação pós-aplicação:
--
-- select has_table_privilege('authenticated','public.autoatendimento_config','SELECT') as le,
--        has_table_privilege('authenticated','public.autoatendimento_config','UPDATE') as escreve,
--        has_table_privilege('anon','public.autoatendimento_config','SELECT') as anon_le;
-- -- esperado: true, false, false
