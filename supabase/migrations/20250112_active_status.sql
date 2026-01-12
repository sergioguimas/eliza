-- 1. Status da Conta (Para bloquear inadimplentes)
ALTER TABLE organizations 
ADD COLUMN status text NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'suspended'));

-- 2. Tipo de Plano (Para limitar recursos depois)
ALTER TABLE organizations 
ADD COLUMN plan text NOT NULL DEFAULT 'basic' 
CHECK (plan IN ('basic', 'pro', 'ultimate'));

-- 3. Comentário para nós mesmos
COMMENT ON COLUMN organizations.status IS 'active = Acesso normal, suspended = Bloqueio total';