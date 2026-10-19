BEGIN;

-- ---------------------------------------------------------------------------
-- Escalada de privilégio no cadastro (achado da auditoria de 2026-10-09).
--
-- handle_new_user lia `role` e `organization_id` de raw_user_meta_data, que é
-- o `options.data` do signUp: quem escreve é o próprio usuário, com a anon
-- key, direto em /auth/v1/signup. Bastava mandar
--   { "role": "owner", "organization_id": "<uuid de outra org>" }
-- para nascer dono daquela org e, pelo RLS (get_user_org_id + papel), ler
-- clientes (CPF, endereço), prontuários, convites e api_keys dela. O id da
-- org não é segredo: a página pública /marcar/[slug] trabalha com ele.
--
-- Nenhum código do app manda esses campos (grep em web/ em 2026-10-09: o
-- signUp de app/actions/auth.ts e os admin.createUser de register-staff,
-- admin-create-tenant e demo/start só mandam full_name / is_demo). Papel e
-- org são definidos depois, pelo servidor com service_role. Nenhum usuário
-- em auth.users tinha role/organization_id no metadata na data da auditoria,
-- ou seja, não há sinal de que tenha sido explorado.
--
-- Agora todo perfil nasce `staff` e sem org. O ON CONFLICT também deixa de
-- reescrever role/organization_id, para um reinsert não rebaixar ninguém.
-- Não há ordem de deploy: o comportamento para o app é o mesmo de hoje.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    new.email
  );

  insert into public.profiles (
    id,
    full_name,
    email,
    role,
    organization_id
  )
  values (
    new.id,
    v_full_name,
    new.email,
    'staff',
    null
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$function$;

-- CREATE OR REPLACE preserva os grants, mas fica explícito caso esta
-- migration rode sem a 20261009151010.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

COMMIT;
