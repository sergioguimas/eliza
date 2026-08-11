-- Endurece o acesso à tabela public.organizations.
--
-- Problema 1 (UPDATE): a policy "Users can update own org" só checava
-- `id = get_user_org_id()`. Qualquer membro autenticado da org (staff,
-- professional, admin) podia dar UPDATE em QUALQUER coluna — inclusive
-- `plan`, `subscription_status`, `stripe_customer_id`, `slug` e as
-- credenciais `evolution_api_url` / `evolution_api_key`. Ou seja: auto-upgrade
-- de plano e troca da chave da Evolution por usuário comum.
--
-- Problema 2 (INSERT): a policy "New users can create org" é WITH CHECK (true)
-- e o `createCompany` (app/actions/auth.ts) insere com o client do usuário.
-- Dava para criar uma org já com plan='enterprise' e se vincular a ela.
--
-- Problema 3 (SELECT anônimo): a policy "Public profiles are viewable by
-- everyone" é USING (true) e a página pública /marcar/[slug] fazia select('*').
-- Como a anon key é pública (vai no bundle do browser), qualquer pessoa na
-- internet conseguia ler `evolution_api_key` e `stripe_customer_id` de TODAS
-- as organizações via /rest/v1/organizations?select=*.
--
-- Estratégia: RLS resolve LINHA e PAPEL; privilégio de coluna resolve COLUNA
-- (policy de RLS não sabe restringir coluna). As colunas de billing e as
-- credenciais da Evolution ficam fora do alcance de qualquer client — só
-- service role escreve nelas (webhook do Stripe / painel /admin).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. UPDATE: só owner/admin da própria org
-- ---------------------------------------------------------------------------
-- Mesmo padrão de checagem de papel usado em "Admins manage invites".
-- O WITH CHECK impede que a linha seja movida para fora da org do usuário.

DROP POLICY IF EXISTS "Users can update own org" ON public.organizations;

CREATE POLICY "Owners and admins update own org" ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    (organizations.id = public.get_user_org_id())
    AND (EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))
    ))
  )
  WITH CHECK (
    (organizations.id = public.get_user_org_id())
    AND (EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['owner'::text, 'admin'::text])))
    ))
  );

-- ---------------------------------------------------------------------------
-- 2. UPDATE: quais colunas o client pode escrever
-- ---------------------------------------------------------------------------
-- Supabase concede ALL nas tabelas de `public` para anon/authenticated por
-- padrão; por isso é preciso revogar e reconceder coluna a coluna.
--
-- Liberadas (o app escreve de fato):
--   name, niche               -> updateSettings (app/actions/update-settings.ts)
--   whatsapp_instance_name    -> whatsapp-connect.ts (vincula/desvincula instância)
--   whatsapp_status           -> reservado para o fluxo de conexão
--
-- Bloqueadas (service role apenas):
--   plan, subscription_status, stripe_customer_id -> billing (webhook Stripe / /admin)
--   evolution_api_url, evolution_api_key          -> credenciais da instância
--   slug                                          -> identidade pública da org
--   id, created_at, updated_at                    -> imutáveis para o client

REVOKE UPDATE ON public.organizations FROM anon, authenticated;

GRANT UPDATE (
  name,
  niche,
  whatsapp_instance_name,
  whatsapp_status
) ON public.organizations TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. INSERT: só autenticado, e sem escolher o próprio plano
-- ---------------------------------------------------------------------------
-- A policy antiga não tinha cláusula TO, então valia inclusive para anon.

DROP POLICY IF EXISTS "New users can create org" ON public.organizations;

CREATE POLICY "Authenticated users can create org" ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

REVOKE INSERT ON public.organizations FROM anon, authenticated;

-- plan e subscription_status caem nos DEFAULTs da tabela ('free' / 'active').
GRANT INSERT (
  name,
  slug,
  niche
) ON public.organizations TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. SELECT anônimo: só o que a página pública de agendamento precisa
-- ---------------------------------------------------------------------------
-- A policy pública continua USING (true) — /marcar/[slug] precisa achar a org
-- pelo slug sem sessão, e usuários logados de OUTRA org também abrem essa
-- página. O que muda é o conjunto de colunas visível para o papel anon.

REVOKE SELECT ON public.organizations FROM anon;

GRANT SELECT (
  id,
  name,
  slug,
  niche,
  created_at
) ON public.organizations TO anon;

COMMIT;
