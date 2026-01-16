-- 1. Renomear a tabela 'medical_records' para 'service_records'
-- Isso generaliza "Prontuário" para "Registro de Atendimento"
ALTER TABLE IF EXISTS medical_records 
RENAME TO service_records;

-- 2. Atualizar as Policies de Segurança (RLS) que usavam o nome antigo
-- (Dropamos as antigas e criamos novas com o nome certo para evitar confusão)

DROP POLICY IF EXISTS "Criar/Editar prontuários da própria clínica" ON service_records;
DROP POLICY IF EXISTS "Ver prontuários da própria clínica" ON service_records;

CREATE POLICY "Manage org service records" ON service_records
    USING (organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    ));

-- 3. Renomear Foreign Keys (Opcional, mas bom para consistência)
ALTER TABLE service_records 
RENAME CONSTRAINT medical_records_customer_id_fkey TO service_records_customer_id_fkey;

ALTER TABLE service_records 
RENAME CONSTRAINT medical_records_organization_id_fkey TO service_records_organization_id_fkey;

ALTER TABLE service_records 
RENAME CONSTRAINT medical_records_professional_id_fkey TO service_records_professional_id_fkey;

ALTER TABLE service_records 
RENAME CONSTRAINT medical_records_signed_by_fkey TO service_records_signed_by_fkey;

ALTER TABLE service_records 
RENAME CONSTRAINT medical_records_pkey TO service_records_pkey;

-- 4. Criar Views ou Tabelas Virtuais (Opcional)
-- Se você tiver código legado que AINDA busca por 'medical_records',
-- isso evita que o sistema quebre enquanto você refatora o front.
-- CREATE VIEW medical_records AS SELECT * FROM service_records;