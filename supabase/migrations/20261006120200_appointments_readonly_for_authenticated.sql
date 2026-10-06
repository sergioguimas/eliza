BEGIN;

-- ---------------------------------------------------------------------------
-- Revogar escrita de usuários autenticados em agendamentos (D9).
--
-- Objetivo: Usuários logados (papel authenticated) passam a ter acesso
-- READ-ONLY em public.appointments. Toda operação de escrita (INSERT, UPDATE,
-- DELETE) passa a ser feita apenas por server actions usando service_role,
-- que chama o domínio de negócio (lib/domain/agendamentos.ts).
--
-- Motivação (auditoria §1, 00-dominio §8.3): A política anterior
-- "Org access appointments" (for ALL, organization_id = get_user_org_id())
-- permitia que qualquer membro da organização fizesse PATCH/DELETE direto via
-- REST API com o JWT da sessão (authenticated), contornando as validações do
-- domínio (máquina de status, horário ocupado, etc.). A máquina de status em
-- TypeScript é inútil se RLS deixar qualquer membro fazer qualquer transição.
--
-- Cenário bloqueado:
--   - PATCH /rest/v1/appointments?id=eq.abc → muda qualquer status
--   - DELETE /rest/v1/appointments?id=eq.abc → deleta agendamento
-- Ambos pelos próprios JWTs de membro da org, sem passar por domínio nem log.
--
-- Novo cenário: usuários logados leem apenas. Escrita só pelo painel (actions)
-- e pela API v1 (domain layer com service_role). A autorização de quem pode
-- escrever continua a mesma (qualquer membro da org), mas passa pela regra de
-- negócio.
--
-- ⚠️ ORDEM OBRIGATÓRIA E CRÍTICA: Código ANTES desta migration.
--    Os passos 1–6 do contrato 00-dominio DEVEM estar em PRODUÇÃO antes de
--    aplicar esta migration. Se você aplicá-la antes, TODA escrita do painel
--    quebra com 42501 (permission denied):
--      - actions/create-appointment.ts → erro
--      - actions/update-appointment.ts → erro
--      - actions/update-appointment-status.ts → erro
--      - actions/cancel-appointment.ts → erro
--      - webhook de confirmação por WhatsApp → erro
--    A regra é "código antes de migration que revoga" (00-dominio §3).
--
-- Estado conferido no catálogo em 2026-10-06: authenticated tem todos os
-- grants de tabela em appointments (a escrita hoje funciona por eles + a
-- policy ALL); anon não tem grant nenhum. appointment_logs tem RLS ligado e
-- NENHUMA policy, então já é fechada para anon/authenticated apesar dos
-- grants de tabela — o log é gravado só com service_role. Não mexemos nela.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Org access appointments" ON public.appointments;

CREATE POLICY "Org members read appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org_id());

REVOKE INSERT, UPDATE, DELETE ON public.appointments FROM anon, authenticated;

COMMIT;

-- Verificação pós-aplicação (esperado: false, false, false, true):
--
-- select
--   has_table_privilege('authenticated', 'public.appointments', 'INSERT')  as insert_allowed,
--   has_table_privilege('authenticated', 'public.appointments', 'UPDATE')  as update_allowed,
--   has_table_privilege('authenticated', 'public.appointments', 'DELETE')  as delete_allowed,
--   has_table_privilege('authenticated', 'public.appointments', 'SELECT')  as select_allowed;
