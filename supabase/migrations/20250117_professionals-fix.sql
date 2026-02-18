-- Remove a FK antiga que aponta para profiles
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_professional_id_fkey;

-- Adiciona a FK correta apontando para professionals
ALTER TABLE appointments 
ADD CONSTRAINT appointments_professional_id_fkey 
FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;