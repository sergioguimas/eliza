BEGIN;

-- ---------------------------------------------------------------------------
-- Escalada de privilégio via PATCH em profiles (auditoria de 2026-10-09).
--
-- A policy "Update own profile" (UPDATE, `id = auth.uid()`, sem WITH CHECK)
-- e o GRANT UPDATE de authenticated em TODAS as colunas de profiles deixavam
-- qualquer usuário logado fazer
--   PATCH /rest/v1/profiles?id=eq.<eu>  {"role":"owner","organization_id":"<org alheia>"}
-- e virar dono de outra org: get_user_org_id() passa a devolver a org da
-- vítima e o RLS libera clientes, prontuários, convites e api_keys dela.
-- O cadastro é aberto (signUp em app/actions/auth.ts), então "usuário logado"
-- é qualquer pessoa. É o mesmo buraco que o 20261009150931 fechou no
-- handle_new_user, só que por outra porta.
--
-- Quem grava role/organization_id hoje (grep em web/ em 2026-10-09):
--   - app/actions/organization.ts (setup) e register-staff: service_role,
--     não passam por este grant.
--   - app/actions/auth.ts createCompany: client de sessão, mas é código
--     morto (nenhum import).
--   - app/actions/team-members.ts (remover membro / trocar papel): client de
--     sessão gravando o perfil de OUTRO usuário. A policy só deixa mexer na
--     própria linha, então isso já não funciona hoje: o UPDATE afeta 0 linhas
--     e a tela diz que deu certo. Depois desta migration passa a devolver erro
--     explícito ("permission denied"). A correção é mover essas duas escritas
--     para o servidor com service_role (as checagens de papel/org já estão no
--     código), em rodada própria.
--
-- O que fica: o usuário edita os próprios dados de exibição (nome, avatar,
-- bio, cor, registro profissional). Papel, org, email e id só pelo servidor.
-- INSERT sai também: nenhuma policy permite e o perfil nasce pelo trigger
-- handle_new_user (SECURITY DEFINER).
-- ---------------------------------------------------------------------------

-- Revogar o privilégio da tabela revoga também os de coluna.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;

GRANT UPDATE (full_name, avatar_url, bio, color, professional_license, updated_at)
  ON public.profiles TO authenticated;

-- Só authenticated, e o WITH CHECK impede trocar o próprio id.
ALTER POLICY "Update own profile" ON public.profiles
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMIT;

-- Verificação pós-aplicação. Esperado: false, false, true.
--
-- select has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
--        has_column_privilege('authenticated', 'public.profiles', 'organization_id', 'UPDATE'),
--        has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE');
