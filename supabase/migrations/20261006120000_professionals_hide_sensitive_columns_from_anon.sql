BEGIN;

-- ---------------------------------------------------------------------------
-- Revogar acesso de anon às colunas sensíveis de profissionais.
--
-- Objetivo: o papel anon (chave pública) deixa de conseguir ler
-- professionals.phone, professionals.license_number e professionals.user_id.
-- anon continua tendo acesso às demais colunas (id, name, specialty,
-- organization_id, is_active, created_at, updated_at) através de grants de
-- coluna explícitos.
--
-- Contexto: Na auditoria de 2026-10-06, constatou-se que a política
-- "Public professionals are viewable by everyone" libera is_active=true para
-- qualquer pessoa, e o grant de SELECT a nível de TABELA para anon permite
-- ler TODAS as colunas, de todos os tenants, via REST com a anon key
-- (que é pública). A página app/marcar/[slug]/page.tsx fazia select('*')
-- como anon; a etapa 1 do 00-dominio a troca por listarProfissionaisAtivos,
-- com colunas explícitas.
--
-- ⚠️ ORDEM OBRIGATÓRIA: Deploy do passo 1 do 00-dominio ANTES desta migration.
--    Se esta migration rode antes, a página pública e as queries da API
--    que ainda fazem select('*') quebram com 42501 (permission denied).
--    A regra é "código antes de migration que revoga" (00-dominio §3).
--
-- Técnica: Revogamos SELECT de TABELA (que era um catch-all) e damos GRANT
-- SELECT apenas nas colunas permitidas. A política RLS continua funcionando
-- porque ela é avaliada em nível de linha após a verificação de privilege.
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.professionals FROM anon;

GRANT SELECT (
  id, name, specialty, organization_id, is_active, created_at, updated_at
) ON public.professionals TO anon;

COMMIT;

-- Verificação pós-aplicação (esperado: phone=false, license=false, user_id=false, name=true, id=true):
--
-- select
--   has_column_privilege('anon', 'public.professionals', 'phone', 'SELECT')          as phone,
--   has_column_privilege('anon', 'public.professionals', 'license_number', 'SELECT') as license,
--   has_column_privilege('anon', 'public.professionals', 'user_id', 'SELECT')        as user_id,
--   has_column_privilege('anon', 'public.professionals', 'name', 'SELECT')           as name,
--   has_column_privilege('anon', 'public.professionals', 'id', 'SELECT')             as id;
--
-- E por REST, com a anon key: GET /rest/v1/professionals?select=phone -> 401/42501;
-- GET /rest/v1/professionals?select=id,name -> 200.
