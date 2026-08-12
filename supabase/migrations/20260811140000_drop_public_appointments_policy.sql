-- Remove a leitura anônima de agendamentos.
--
-- A policy "Public select appointments" (`TO anon USING (status = 'pending')`)
-- existia por um motivo só: `getAvailableSlots` rodava com o client de cookie e,
-- na página pública /marcar, caía no papel `anon` — precisava enxergar algum
-- agendamento para calcular horário ocupado.
--
-- O efeito colateral era duplo:
--
--   Vazamento: qualquer pessoa com a anon key, sem login, lia os agendamentos
--   pendentes de TODOS os tenants (horário, profissional, serviço, preço) em
--   GET /rest/v1/appointments?status=eq.pending
--
--   Bug: o cálculo de slots só enxergava os 'pending'. Agendamento 'scheduled'
--   ou 'confirmed' era invisível, então horário ocupado aparecia como livre e
--   a reserva só falhava no final, na exclusion constraint
--   `appointments_professional_overlap_idx` ("este horário acabou de ser
--   ocupado").
--
-- `getAvailableSlots` passou a usar service role, validando o vínculo
-- profissional↔organização explicitamente. Com isso a policy virou dead code:
-- nenhum caminho anônimo lê `appointments`. As rotas públicas são /marcar
-- (agora service role, via server action), /convite (service role) e as telas
-- de auth; /print/* exige sessão.
--
-- ⚠️ ORDEM: só rode esta migration DEPOIS que o novo `get-available-slots.ts`
--    estiver em produção. Se rodar antes, a página pública passa a enxergar
--    ZERO agendamentos e oferece todos os horários como livres — todo mundo
--    esbarra na exclusion constraint na hora de confirmar.

BEGIN;

DROP POLICY IF EXISTS "Public select appointments" ON public.appointments;

-- Sobra a "Org access appointments" (FOR ALL, `organization_id =
-- get_user_org_id()`), que para anon resolve NULL e não devolve linha nenhuma.
-- O REVOKE é a segunda camada: sem privilégio, nem chega a avaliar policy.
REVOKE ALL ON TABLE public.appointments FROM anon;

COMMIT;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA (rode depois do COMMIT)
-- ---------------------------------------------------------------------------
-- Não deve sobrar policy de appointments alcançável por anon:
--
--   select policyname, roles, cmd, qual
--     from pg_policies
--    where schemaname = 'public' and tablename = 'appointments';
--
-- Teste de fumaça SEM login, só com a anon key:
--   GET /rest/v1/appointments?select=*  -> [] ou 42501, nunca dados
--
-- E na /marcar, com um profissional que tenha agendamento 'confirmed' no dia:
-- o horário dele NÃO pode mais aparecer na lista de livres.
