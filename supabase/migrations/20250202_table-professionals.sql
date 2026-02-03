CREATE TABLE professionals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Vinculação com login
    name TEXT NOT NULL,
    license_number TEXT, -- Registro de Ordem (CRM, CRO, etc)
    specialty TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO professionals (id, organization_id, user_id, name, phone, is_active)
SELECT 
    id, 
    organization_id, 
    id as user_id, 
    full_name as name, 
    NULL as phone, -- Ajuste o telefone manualmente depois
    true
FROM profiles
WHERE role IN ('professional', 'owner', 'admin')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE professional_availability 
DROP CONSTRAINT IF EXISTS professional_availability_professional_id_fkey;

ALTER TABLE professional_availability
ADD CONSTRAINT professional_availability_professional_id_fkey 
FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE;

ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS appointments_professional_id_fkey;

ALTER TABLE appointments
ADD CONSTRAINT appointments_professional_id_fkey 
FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE SET NULL;

-- Criar política de leitura
CREATE POLICY "Usuários veem profissionais da mesma org"
ON professionals
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);