BEGIN;

-- ---------------------------------------------------------------------------
-- Vazamento de dados pessoais via RPC (auditoria 2026-09-23).
--
-- `find_or_create_public_customer` e `request_public_appointment` são
-- SECURITY DEFINER (rodam como postgres, ignoram RLS) e o snapshot
-- schema_public.sql de 2026-08-15 mostra `GRANT ALL ... TO anon` e
-- `TO authenticated` nas duas — herdado do
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon` do Supabase.
-- Nenhuma migration posterior revogou.
--
-- Com a anon key (pública no browser) qualquer pessoa podia:
--   - chamar find_or_create_public_customer(org_id, nome, telefone) e receber
--     a linha inteira de `customers` do cliente com aquele telefone (CPF,
--     birth_date, address, email, notes). IDs de org são enumeráveis por anon.
--   - na mesma chamada, sobrescrever name/phone e preencher campos vazios do
--     cliente existente.
--   - chamar request_public_appointment e criar agendamentos `pending` sem o
--     rate limit de createPublicAppointment (app/actions/create-appointment.ts).
--
-- Nenhum código do app chama nenhuma das duas (grep em web/, getdemo/ e
-- supabase/ em 2026-09-23: só aparecem em utils/database.types.ts). Por isso
-- não há ordem de deploy: pode aplicar a qualquer momento.
--
-- Revoga de PUBLIC e também de anon/authenticated explicitamente: o grant
-- do Supabase é direto no papel, então revogar só de PUBLIC não bastaria.
-- service_role mantém EXECUTE. A chamada interna de
-- request_public_appointment → find_or_create_public_customer continua
-- funcionando, pois roda como o dono (postgres).
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.find_or_create_public_customer(
  uuid, text, text, text, text, date, text, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.request_public_appointment(
  uuid, uuid, uuid, timestamptz, text, text, text, text, date, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.find_or_create_public_customer(
  uuid, text, text, text, text, date, text, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.request_public_appointment(
  uuid, uuid, uuid, timestamptz, text, text, text, text, date, text, text, text, text
) TO service_role;

COMMIT;

-- Verificação pós-aplicação (esperado: false, false, true em cada linha):
--
-- select f, has_function_privilege('anon', f, 'execute')          as anon,
--           has_function_privilege('authenticated', f, 'execute') as authenticated,
--           has_function_privilege('service_role', f, 'execute')  as service_role
-- from unnest(array[
--   'public.find_or_create_public_customer(uuid,text,text,text,text,date,text,text,text)',
--   'public.request_public_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text,date,text,text,text,text)'
-- ]) as f;
