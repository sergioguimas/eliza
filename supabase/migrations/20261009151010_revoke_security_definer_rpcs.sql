BEGIN;

-- ---------------------------------------------------------------------------
-- Funções SECURITY DEFINER expostas em /rest/v1/rpc (advisor de segurança,
-- 2026-10-09). Mesma origem do 20260923111405: o
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated`
-- do Supabase dá EXECUTE direto nos papéis, então revogar só de PUBLIC não
-- basta (foi o que aconteceu com consume_demo_rate_limit no 20260828120000:
-- o REVOKE FROM PUBLIC ficou lá e anon continuou executando).
--
-- Quem chama o quê (grep em web/ e supabase/ em 2026-10-09):
--   - consume_demo_rate_limit: só `supabaseAdmin.rpc` em lib/demo/rate-limit.ts
--     (service_role). Com a anon key, qualquer um incrementava qualquer chave
--     e travava a demonstração de outro IP, ou enchia demo_rate_limits.
--   - sign_service_record / finalize_service_record: ninguém. O app assina
--     prontuário por UPDATE direto em app/actions/service-records.ts, sob RLS.
--     As funções checam `professionals.user_id = auth.uid()` por dentro, então
--     anon não assinava nada (auth.uid() é NULL), mas as mensagens de erro
--     diferentes servem de oráculo de existência/status por id. Sem uso, sai
--     de anon e de authenticated. Se um dia o fluxo passar a ser pela RPC,
--     devolver EXECUTE só para authenticated (service_role não serve: dentro
--     dela auth.uid() é NULL e a checagem falha).
--   - handle_new_user, handle_new_organization (triggers) e rls_auto_enable
--     (event trigger): disparo de trigger não checa EXECUTE de quem fez o
--     INSERT/DDL, e o PostgREST nem consegue chamar função que retorna
--     trigger. Revogar é higiene, sem efeito no comportamento.
--
-- Fica DE FORA de propósito: get_user_org_id. É o helper das policies de RLS,
-- e várias são `TO public` (organizations, services, customers, profiles,
-- organization_settings...). A página pública /marcar/[slug] lê
-- `organizations` com o client de sessão, ou seja, como anon; sem EXECUTE a
-- leitura passaria a dar "permission denied for function" em vez de voltar
-- vazia. Para anon ela devolve NULL, e para authenticated a própria org, então
-- não há o que vazar. O advisor vai continuar apontando; tirar anon dela exige
-- antes trocar essas policies para `TO authenticated` (rodada própria).
--
-- service_role mantém EXECUTE em tudo. Não há ordem de deploy: nenhum código
-- depende dos grants que saem.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.consume_demo_rate_limit(text, bigint, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sign_service_record(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_service_record(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_demo_rate_limit(text, bigint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sign_service_record(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_service_record(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_organization() TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

-- search_path mutável (advisor): sem SET, a função resolve nomes pelo
-- search_path de quem chama. get_user_org_id é SECURITY DEFINER e é o que
-- importa; as duas de trigger vão junto pelo mesmo custo zero. '' é seguro
-- nas três: o corpo só usa nomes qualificados (public.profiles, auth.uid())
-- ou funções de pg_catalog (now, regexp_replace, nullif, coalesce), que é
-- sempre pesquisado implicitamente.
ALTER FUNCTION public.get_user_org_id() SET search_path = '';
ALTER FUNCTION public.normalize_customer_fields() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

COMMIT;

-- Verificação pós-aplicação. Esperado: anon=false e authenticated=false em
-- tudo, menos get_user_org_id (true, true); service_role=true em tudo.
--
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'execute')          as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        has_function_privilege('service_role', p.oid, 'execute')  as service_role,
--        p.proconfig
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('consume_demo_rate_limit','sign_service_record',
--     'finalize_service_record','handle_new_user','handle_new_organization',
--     'rls_auto_enable','get_user_org_id','normalize_customer_fields',
--     'update_updated_at_column')
-- order by 1;
