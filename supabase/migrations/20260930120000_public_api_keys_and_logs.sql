BEGIN;

-- ---------------------------------------------------------------------------
-- API REST pública (/api/v1): chaves por tenant e log de utilização.
--
-- api_keys
--   A chave em claro (`elz_live_...`) é mostrada UMA vez, na criação. Aqui só
--   ficam o prefixo (para o painel identificar a chave) e o SHA-256. A chave
--   tem 256 bits de entropia, então hash rápido basta (não é senha de humano).
--
-- api_request_logs
--   Uma linha por requisição autenticada, separada por tenant e por chave,
--   para auditoria. Não guarda body nem query string (podem ter dado
--   pessoal); guarda método, rota, status, latência, IP e user-agent.
--   organization_id/api_key_id sem FK em cascata: o log sobrevive à revogação
--   e à remoção da chave.
--
-- Escrita só por service role (a API). Admin/owner do tenant só LÊ o que é seu.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  key_prefix      text NOT NULL,
  key_hash        text NOT NULL UNIQUE,
  scopes          text[] NOT NULL DEFAULT ARRAY['read', 'write'],
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  revoked_at      timestamptz,
  last_used_at    timestamptz,
  CONSTRAINT api_keys_scopes_check CHECK (
    scopes <@ ARRAY['read', 'write'] AND cardinality(scopes) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org
  ON public.api_keys (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  api_key_id      uuid NOT NULL,
  key_prefix      text NOT NULL,
  request_id      text NOT NULL,
  method          text NOT NULL,
  path            text NOT NULL,
  status_code     integer NOT NULL,
  error_code      text,
  duration_ms     integer,
  ip              text,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_org
  ON public.api_request_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_key
  ON public.api_request_logs (api_key_id, created_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.api_request_logs FROM PUBLIC, anon, authenticated;

-- authenticated só lê, e sem a coluna key_hash.
GRANT SELECT (id, organization_id, name, key_prefix, scopes, created_by,
              created_at, expires_at, revoked_at, last_used_at)
  ON public.api_keys TO authenticated;
GRANT SELECT ON public.api_request_logs TO authenticated;

GRANT ALL ON public.api_keys TO service_role;
GRANT ALL ON public.api_request_logs TO service_role;

DROP POLICY IF EXISTS "Admins read api_keys" ON public.api_keys;
CREATE POLICY "Admins read api_keys" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['owner', 'admin'])
    )
  );

DROP POLICY IF EXISTS "Admins read api_request_logs" ON public.api_request_logs;
CREATE POLICY "Admins read api_request_logs" ON public.api_request_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['owner', 'admin'])
    )
  );

COMMIT;
