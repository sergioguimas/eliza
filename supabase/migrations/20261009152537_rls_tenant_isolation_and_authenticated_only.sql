BEGIN;

-- ---------------------------------------------------------------------------
-- Rodada das policies `TO public` (auditoria de 2026-10-09), continuação do
-- 20261009151010.
--
-- 1) Vazamento e escrita ENTRE orgs em professionals / professional_availability.
--    O cadastro é aberto e o /setup faz de qualquer um owner da própria org,
--    então "owner" não é privilégio raro:
--    - "Admin total access or Professional self view" (SELECT) e
--      "Admin total update or Professional self update" (UPDATE) checavam
--      `role = 'owner'` SEM olhar a org: owner de qualquer org lia telefone,
--      registro e user_id dos profissionais de TODAS as orgs, e alterava
--      (renomear, desativar, até mover para a própria org pelo
--      organization_id, porque não havia WITH CHECK de org).
--    - "Admin manage all or Professional manage own availability" (ALL):
--      owner/admin de qualquer org criava, alterava e apagava expediente de
--      qualquer profissional de qualquer org.
--    - "Public professionals are viewable by everyone" era `TO public`: anon
--      só tem SELECT nas colunas públicas (20261006120000), mas authenticated
--      tem em phone/license_number/user_id, e lia os de todas as orgs.
--    Correção: o ramo de owner/admin passa a exigir a org do usuário, e as
--    leituras "públicas" de professionals e services ficam só para anon.
--    O app não depende de nada disso entre orgs: /marcar/[slug] lê
--    profissionais e serviços com service_role (lib/domain/catalogo), e as
--    telas logadas só usam os da própria org.
--
-- 2) `TO public` → `TO authenticated` nas policies por org. Todas dependem de
--    get_user_org_id() ou auth.uid(), que para anon são NULL, então anon nunca
--    viu linha nenhuma por elas: para anon não muda nada. O ganho é que anon
--    deixa de avaliar get_user_org_id(), e aí dá para revogar o EXECUTE dela
--    de anon (o que o 20261009151010 não pôde fazer).
--    Fica `TO public` de propósito só "Public profiles are viewable by
--    everyone" em organizations: /marcar/[slug] lê a org pelo slug com o
--    client de sessão, que pode ser anon ou um usuário logado de outra org, e
--    as colunas visíveis já são só as públicas (id, name, slug, niche).
-- ---------------------------------------------------------------------------

-- 1) professionals: owner só dentro da própria org.
ALTER POLICY "Admin total access or Professional self view" ON public.professionals
  TO authenticated
  USING (
    (
      organization_id = public.get_user_org_id()
      AND (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'owner'
    )
    OR user_id = auth.uid()
  );

ALTER POLICY "Admin total update or Professional self update" ON public.professionals
  TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    AND (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'owner'
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = public.get_user_org_id()
    AND (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'owner'
      OR user_id = auth.uid()
    )
  );

ALTER POLICY "Public professionals are viewable by everyone" ON public.professionals
  TO anon;

ALTER POLICY "Usuários veem profissionais da mesma org" ON public.professionals
  TO authenticated;

-- 1) professional_availability: owner/admin só nos profissionais da própria org.
ALTER POLICY "Admin manage all or Professional manage own availability"
  ON public.professional_availability
  USING (
    (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = ANY (ARRAY['owner', 'admin'])
      AND professional_id IN (
        SELECT pr.id FROM public.professionals pr
        WHERE pr.organization_id = public.get_user_org_id()
      )
    )
    OR professional_id IN (
      SELECT pr.id FROM public.professionals pr WHERE pr.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = ANY (ARRAY['owner', 'admin'])
      AND professional_id IN (
        SELECT pr.id FROM public.professionals pr
        WHERE pr.organization_id = public.get_user_org_id()
      )
    )
    OR professional_id IN (
      SELECT pr.id FROM public.professionals pr WHERE pr.user_id = auth.uid()
    )
  );

-- 1) services: catálogo público só para anon (logado vê o da própria org).
ALTER POLICY "Public services are viewable by everyone" ON public.services
  TO anon;

-- 2) Policies por org: public → authenticated. Expressões inalteradas.
ALTER POLICY "Org access customers"          ON public.customers            TO authenticated;
ALTER POLICY "Org access demo interactions"  ON public.demo_interactions    TO authenticated;
ALTER POLICY "Org access demo timeline"      ON public.demo_timeline_events TO authenticated;
ALTER POLICY "Org access estimates"          ON public.estimates            TO authenticated;
ALTER POLICY "Admins manage invites"         ON public.invitations          TO authenticated;
ALTER POLICY "Update org settings"           ON public.organization_settings TO authenticated;
ALTER POLICY "View org settings"             ON public.organization_settings TO authenticated;
ALTER POLICY "Users can view own org"        ON public.organizations        TO authenticated;
ALTER POLICY "View profiles in same org"     ON public.profiles             TO authenticated;
ALTER POLICY "Org access services"           ON public.services             TO authenticated;

-- 2) Nenhuma policy alcançável por anon chama mais get_user_org_id().
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_id() TO authenticated, service_role;

COMMIT;

-- Verificação pós-aplicação:
--
-- -- (a) nenhuma policy por org sobrou TO public; só a de organizations
-- select tablename, policyname, roles from pg_policies
-- where schemaname = 'public' and roles @> '{public}';
--
-- -- (b) anon sem EXECUTE em get_user_org_id, authenticated com
-- select has_function_privilege('anon', 'public.get_user_org_id()', 'execute'),
--        has_function_privilege('authenticated', 'public.get_user_org_id()', 'execute');
