-- 1. Adiciona a coluna (se já rodou essa parte e deu certo, o banco vai apenas avisar, sem erro)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES profiles(id);

-- 2. CORREÇÃO DO BACKFILL:
-- "Para cada agendamento sem dono, procure um perfil que pertença à mesma organização e use o ID dele."
UPDATE appointments 
SET professional_id = (
  SELECT id 
  FROM profiles 
  WHERE profiles.organization_id = appointments.organization_id 
  LIMIT 1
)
WHERE professional_id IS NULL;

-- 3. Cria o índice para performance
CREATE INDEX IF NOT EXISTS idx_appointments_professional ON appointments(professional_id);