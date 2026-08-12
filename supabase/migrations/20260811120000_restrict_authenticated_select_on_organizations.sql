-- Fecha o vazamento de dados entre tenants em public.organizations no papel
-- `authenticated`. Complemento da 20260809160000_harden_organizations_access,
-- que endureceu INSERT/UPDATE e o SELECT do papel `anon`, mas deixou o SELECT
-- do papel `authenticated` em nível de TABELA (= todas as colunas).
--
-- O BURACO
-- --------
-- 1. `GRANT SELECT ON TABLE public.organizations TO authenticated` (sem lista
--    de colunas) libera TODAS as colunas para qualquer usuário logado.
-- 2. A policy "Public profiles are viewable by everyone" é `USING (true)` e não
--    tem cláusula TO, então vale também para `authenticated` — ou seja, libera
--    TODAS as linhas, não só a org do próprio usuário.
--
-- Coluna liberada + linha liberada = qualquer usuário autenticado de qualquer
-- tenant consegue, indo direto no REST do Supabase com a anon key (que é
-- pública, vai no bundle do browser) e o token da própria sessão:
--
--   GET /rest/v1/organizations
--       ?select=whatsapp_instance_name,stripe_customer_id,plan,subscription_status
--
-- ...e receber isso de TODOS os tenants. Não passa pelo app, então nenhuma
-- checagem de tela ajuda.
--
-- Urgência: a demo pública (getdemo/PLANO_DEMO_v2.md) entrega uma sessão
-- `authenticated` real a visitante anônimo. Sem esta migration, "meus clientes
-- se enxergam" vira "qualquer pessoa na internet enxerga".
--
-- POR QUE A CORREÇÃO É POR COLUNA, E NÃO POR POLICY
-- -------------------------------------------------
-- A tentação é restringir a policy `USING (true)` para valer só em `anon`.
-- Não dá: /marcar/[slug] usa o client de cookie (utils/supabase/server.ts), então
-- um usuário LOGADO que abre a página pública de agendamento de OUTRA org chega
-- no banco como `authenticated`, não como `anon`. Restringir a policy a `anon`
-- quebraria a página pública para todo mundo que está logado.
--
-- Como policy de RLS resolve LINHA e não sabe restringir COLUNA, a única trava
-- que funciona aqui é o privilégio de coluna: as linhas continuam todas
-- visíveis (a página pública precisa disso), mas o conjunto de colunas visível
-- para `authenticated` passa a ser o mesmo conjunto público que `anon` já tem.
--
-- Consequência de projeto: nenhuma coluna sensível pode ser lida pelo client do
-- usuário — nem para a própria org. Quem precisa delas (fluxo de conexão do
-- WhatsApp, webhook, billing, /admin) lê com service role no servidor.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. SELECT do `authenticated`: só as colunas públicas
-- ---------------------------------------------------------------------------
-- Mesmo conjunto que /marcar/[slug] consome. Verificado contra todos os selects
-- de organizations feitos com client de usuário:
--   id     -> layout, embed profiles->organizations, SettingsForm, /marcar
--   name   -> sidebar, dashboard, /print/*, handle-appointment-request, /marcar
--   slug   -> SettingsForm (campo do formulário), /marcar
--   niche  -> Keckleon (tema/dicionário), presente em quase toda página do app
--
-- Ficam FORA (service role apenas):
--   whatsapp_instance_name -> identidade do tenant no WhatsApp
--   whatsapp_status        -> idem
--   stripe_customer_id     -> billing
--   plan, subscription_status -> billing
--   is_demo, expires_at    -> controle da demo; visitante não pode se enxergar
--   created_at, updated_at -> nenhum consumidor autenticado

REVOKE SELECT ON TABLE public.organizations FROM authenticated;

GRANT SELECT (
  id,
  name,
  slug,
  niche
) ON TABLE public.organizations TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. UPDATE(whatsapp_instance_name): removido do client
-- ---------------------------------------------------------------------------
-- A 20260809160000 concedeu esta coluna porque app/actions/whatsapp-connect.ts
-- gravava o vínculo org -> instância com o client do usuário. O problema é que
-- a policy de UPDATE só checa "é a minha org", e o VALOR gravado é livre: dá
-- para apontar a própria org para a instância de OUTRO tenant e passar a
-- disparar mensagem pelo número de WhatsApp da outra empresa (o webhook de
-- entrada também casa org por essa coluna, então a conversa vai junto).
--
-- Não existe policy que resolva isso: RLS valida a LINHA, não o VALOR gravado.
-- O fluxo de conexão virou service role (whatsapp-connect.ts nesta mesma
-- mudança), com a checagem de papel owner/admin feita na server action.
--
-- whatsapp_status entra junto: nenhum código escreve nessa coluna; o grant
-- estava reservado para um fluxo que nunca chegou.

REVOKE UPDATE (
  whatsapp_instance_name,
  whatsapp_status
) ON TABLE public.organizations FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. Faxina dos grants default do Supabase (defesa em profundidade)
-- ---------------------------------------------------------------------------
-- O Supabase concede ALL nas tabelas de `public` para anon/authenticated. Sobrou
-- DELETE/TRUNCATE/TRIGGER/REFERENCES/MAINTAIN em organizations.
--
-- Hoje nada disso é explorável pelo REST: DELETE está barrado porque não existe
-- policy de DELETE, e TRUNCATE não tem verbo no PostgREST. Mas TRUNCATE ignora
-- RLS por definição, então o privilégio não deveria existir — e nenhum código
-- do app usa nenhum dos cinco (o /admin apaga com service role).
--
-- Se o Studio reclamar de `MAINTAIN` (privilégio novo, PG 18+), remova só essa
-- palavra da lista e rode de novo — as outras quatro são as que importam.

REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES, MAINTAIN
  ON TABLE public.organizations
  FROM anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rode depois do COMMIT, fora da transação)
-- ---------------------------------------------------------------------------
-- Deve listar exatamente id/name/slug/niche para authenticated,
-- e id/name/slug/niche/created_at para anon:
--
--   select grantee, column_name, privilege_type
--     from information_schema.column_privileges
--    where table_schema = 'public'
--      and table_name = 'organizations'
--      and grantee in ('anon', 'authenticated')
--    order by grantee, privilege_type, column_name;
--
-- E não deve sobrar nenhuma linha para anon/authenticated aqui (privilégio de
-- tabela inteira):
--
--   select grantee, privilege_type
--     from information_schema.table_privileges
--    where table_schema = 'public'
--      and table_name = 'organizations'
--      and grantee in ('anon', 'authenticated');
--
-- Teste de fumaça do vazamento, logado como usuário comum de um tenant:
--   GET /rest/v1/organizations?select=plan   -> deve dar 42501 permission denied
--   GET /rest/v1/organizations?select=id,name,slug,niche -> deve funcionar
