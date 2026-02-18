ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
-- Opcional: Adicionar um índice para manter as buscas rápidas
CREATE INDEX idx_customers_not_deleted ON customers (id) WHERE deleted_at IS NULL;