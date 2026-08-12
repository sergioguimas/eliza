BEGIN;

-- ---------------------------------------------------------------------------
-- Tenant demo: organizações efêmeras usadas pelo tour guiado público.
-- Um tenant demo é uma organização normal (mesmo RLS, mesmas actions) marcada
-- com is_demo e com prazo de validade. Todo o isolamento vem das policies que
-- já existem em organization_id = public.get_user_org_id().
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Um tenant demo sem prazo nunca seria coletado pelo cleanup e viraria lixo
-- permanente em produção.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_demo_requires_expiry,
  ADD CONSTRAINT organizations_demo_requires_expiry
    CHECK (is_demo = false OR expires_at IS NOT NULL);

-- Suporta a varredura do cleanup sem escanear a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_organizations_demo_expiry
  ON public.organizations (expires_at)
  WHERE is_demo = true;


-- ---------------------------------------------------------------------------
-- demo_interactions: telemetria do tour.
--
-- organization_id é ON DELETE SET NULL de propósito: o cleanup apaga o tenant
-- a cada 24h, mas as métricas de funil precisam sobreviver a isso. Por essa
-- razão o nicho fica desnormalizado aqui.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_interactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid,
  niche text,
  action text NOT NULL,
  step_number integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT demo_interactions_pkey PRIMARY KEY (id),
  CONSTRAINT demo_interactions_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE SET NULL,
  CONSTRAINT demo_interactions_action_check CHECK (
    action IN (
      'tour_started',
      'step_completed',
      'appointment_created',
      'appointment_completed',
      'return_scheduled',
      'record_added',
      'timeline_viewed',
      'whatsapp_opt_in',
      'whatsapp_sent',
      'tour_completed',
      'tour_abandoned',
      'lead_captured'
    )
  ),
  CONSTRAINT demo_interactions_step_number_check CHECK (
    step_number IS NULL OR (step_number BETWEEN 1 AND 8)
  )
);

CREATE INDEX IF NOT EXISTS idx_demo_interactions_org
  ON public.demo_interactions (organization_id);

CREATE INDEX IF NOT EXISTS idx_demo_interactions_funnel
  ON public.demo_interactions (created_at DESC, niche, action);


-- ---------------------------------------------------------------------------
-- demo_timeline_events: sequência simulada de avisos exibida no fast-forward.
-- Dado efêmero do tour — cascata junto com o tenant.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_timeline_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  appointment_id uuid,
  event_type text NOT NULL,
  simulated_time timestamptz NOT NULL,
  message_text text,
  response_text text,
  delivered_for_real boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT demo_timeline_events_pkey PRIMARY KEY (id),
  CONSTRAINT demo_timeline_events_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT demo_timeline_events_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id) ON DELETE CASCADE,
  CONSTRAINT demo_timeline_events_event_type_check CHECK (
    event_type IN (
      'appointment_created',
      'reminder_1h',
      'client_confirmed',
      'appointment_time'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_demo_timeline_events_org
  ON public.demo_timeline_events (organization_id, simulated_time);


-- ---------------------------------------------------------------------------
-- demo_leads: conversão do tour. Precisa sobreviver ao cleanup do tenant.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid,
  niche text,
  name text NOT NULL,
  contact text NOT NULL,
  source text NOT NULL DEFAULT 'demo_tour',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT demo_leads_pkey PRIMARY KEY (id),
  CONSTRAINT demo_leads_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_leads_created
  ON public.demo_leads (created_at DESC);


-- ---------------------------------------------------------------------------
-- demo_rate_limits: contadores de abuso.
--
-- Chave genérica para atender aos dois eixos:
--   'ip:<sha256>'    → quantos tenants demo um IP pode criar
--   'phone:<sha256>' → quantas mensagens um número pode receber por janela
--
-- Fica no Postgres porque não há Redis no stack e memória de processo não
-- sobrevive ao restart do container.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT demo_rate_limits_pkey PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_window
  ON public.demo_rate_limits (window_start);


-- ---------------------------------------------------------------------------
-- RLS
--
-- demo_interactions e demo_timeline_events seguem o padrão das tabelas de
-- tenant. demo_leads e demo_rate_limits ficam com RLS ligado e nenhuma policy:
-- isso nega tudo para anon/authenticated e deixa o acesso apenas para a
-- service role, que é quem escreve nelas.
-- ---------------------------------------------------------------------------

ALTER TABLE public.demo_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access demo interactions" ON public.demo_interactions;
CREATE POLICY "Org access demo interactions"
  ON public.demo_interactions
  USING (organization_id = public.get_user_org_id());

DROP POLICY IF EXISTS "Org access demo timeline" ON public.demo_timeline_events;
CREATE POLICY "Org access demo timeline"
  ON public.demo_timeline_events
  USING (organization_id = public.get_user_org_id());

COMMIT;
