-- Fecha dois furos encontrados na varredura das tabelas com GRANT ALL para anon.
--
-- Contexto: o Supabase concede ALL em todas as tabelas de `public` para
-- anon/authenticated por padrão. Isso só é seguro porque o RLS barra depois.
-- Das 18 tabelas, 17 têm GRANT ALL para anon — e em duas delas o RLS não barra.
--
-- ===========================================================================
-- FURO 1 (CRÍTICO): public.expenses NÃO TEM RLS
-- ===========================================================================
-- `expenses` é a única tabela do schema sem `ENABLE ROW LEVEL SECURITY` e sem
-- nenhuma policy. Com GRANT ALL para anon, isso significa que qualquer pessoa
-- com a anon key — que é pública, vai no bundle do browser, SEM login — pode:
--
--   GET    /rest/v1/expenses            -> despesas de TODOS os tenants
--   POST   /rest/v1/expenses            -> criar despesa em qualquer org
--   PATCH  /rest/v1/expenses?id=eq.<id> -> alterar despesa de qualquer org
--   DELETE /rest/v1/expenses?id=eq.<id> -> apagar despesa de qualquer org
--
-- Não há segunda camada: as três server actions que tocam a tabela usam o
-- client do usuário e não checam org nenhuma —
--   create-expense.ts       -> organization_id vem do formData (o client escolhe)
--   get-financial-summary.ts-> organizationId vem por parâmetro, sem validar
--   update-expense-status.ts-> filtra só por .eq('id', expenseId)
-- Hoje quem segura essas três é nada. Depois desta migration, é o RLS.
--
-- ⚠️ ANTES DE RODAR, confira se existe despesa órfã — ela ficaria invisível
--    para o app depois do RLS (organization_id é NULLable nessa tabela):
--      select count(*) from public.expenses where organization_id is null;
--    Se vier > 0, decida o destino dessas linhas antes de aplicar.
--
-- ===========================================================================
-- FURO 2 (CRÍTICO): convites legíveis por qualquer um
-- ===========================================================================
-- A policy "Public read invite by code" é `FOR SELECT USING (true)` e não tem
-- cláusula TO — vale para anon. Com GRANT ALL, dá para fazer:
--
--   GET /rest/v1/invitations?select=code,role,organization_id,expires_at
--
-- ...e receber TODOS os convites vivos de TODOS os tenants. O código do convite
-- é um bearer token: `registerStaff` (app/actions/register-staff.ts) valida
-- apenas que o convite existe e não expirou. O check de e-mail é ignorado
-- porque `generateInvite` nunca grava `email` (fica NULL), e `used_count` é
-- incrementado mas nunca conferido. Logo: ler um código com role='admin' e
-- chamar o cadastro = entrar como admin no tenant alheio, sem login prévio.
--
-- A policy é DEAD CODE: os três acessos a `invitations` no app usam service
-- role (convite/[code]/page.tsx e register-staff.ts) ou são INSERT do admin
-- logado, coberto pela policy "Admins manage invites". Ninguém lê convite com
-- a anon key. Dropar não exige mudança de código.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. expenses: liga o RLS e isola por org
-- ---------------------------------------------------------------------------
-- Mesmo padrão das tabelas irmãs ("Org access customers", "Org access
-- estimates", "Org access appointments"): FOR ALL com get_user_org_id().
--
-- O WITH CHECK é o que impede o create-expense.ts de gravar numa org alheia
-- mesmo recebendo organization_id adulterado no formData.

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access expenses" ON public.expenses;

CREATE POLICY "Org access expenses" ON public.expenses
  FOR ALL
  TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

-- Nenhum fluxo anônimo toca despesas: a página pública /marcar não sabe que
-- essa tabela existe. Sem grant, nem chega a avaliar policy.
REVOKE ALL ON TABLE public.expenses FROM anon;

-- ---------------------------------------------------------------------------
-- 2. invitations: remove a leitura pública
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public read invite by code" ON public.invitations;

-- Sobra a "Admins manage invites" (FOR ALL, exige get_user_org_id() + papel
-- owner/admin), que é o que o generateInvite precisa. Leitura por código
-- continua funcionando: /convite/[code] lê com service role.
REVOKE ALL ON TABLE public.invitations FROM anon;

COMMIT;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rode depois do COMMIT)
-- ---------------------------------------------------------------------------
-- Nenhuma tabela de `public` sem RLS:
--
--   select relname
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
--   -- esperado: zero linhas
--
-- Nenhuma policy `USING (true)` sem restrição de papel além da de organizations
-- (essa é intencional, ver 20260811120000):
--
--   select tablename, policyname, roles, cmd, qual
--     from pg_policies
--    where schemaname = 'public' and qual = 'true';
--
-- Teste de fumaça, SEM login, só com a anon key:
--   GET /rest/v1/expenses     -> deve vir [] (ou 42501), nunca dados
--   GET /rest/v1/invitations  -> deve vir [] (ou 42501), nunca códigos
