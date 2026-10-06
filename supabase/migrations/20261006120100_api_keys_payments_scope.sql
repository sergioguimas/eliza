BEGIN;

-- ---------------------------------------------------------------------------
-- Estender o escopo de chaves de API para incluir 'payments'.
--
-- Objetivo: o CHECK constraint api_keys_scopes_check passa a aceitar 'payments'
-- além de 'read' e 'write', conforme especificado em docs/contratos/api-v1/README.md §7.
--
-- Escopo 'payments' permite apenas POST /appointments/{id}/payment (baixa de
-- pagamento). Uma chave pode ter 'payments' sem 'write' (integração só de caixa).
--
-- Natureza: ADITIVA. Chaves existentes continuam com seus escopos atuais e não
-- ganham 'payments' automaticamente. A criação de novas chaves pode incluir o
-- novo escopo.
--
-- Dependência: Esta migration roda DEPOIS de 20260930120000_public_api_keys_and_logs.sql
-- que cria a tabela api_keys. Se a ordem for violada, postgres responde com
-- "table does not exist" (não usamos IF EXISTS para deixar claro o erro).
-- ---------------------------------------------------------------------------

ALTER TABLE public.api_keys
  DROP CONSTRAINT api_keys_scopes_check;

ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_scopes_check
    CHECK (scopes <@ ARRAY['read', 'write', 'payments'] AND cardinality(scopes) > 0);

COMMIT;

-- Verificação pós-aplicação (esperado: a definição contém 'payments'):
--
-- select pg_get_constraintdef(oid) from pg_constraint
-- where conname = 'api_keys_scopes_check' and conrelid = 'public.api_keys'::regclass;
