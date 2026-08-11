-- Tabela para horários recorrentes por profissional
CREATE TABLE professional_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo
    start_time TIME NOT NULL,
    break_start TIME,
    break_end TIME,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(professional_id, day_of_week) -- Garante apenas uma regra por dia por profissional
);

-- Adicionar RLS para segurança
ALTER TABLE professional_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professional can manage own availability" ON professional_availability
    FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Org can view all availabilities" ON professional_availability
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = professional_availability.professional_id 
            AND profiles.organization_id = get_user_org_id()
        )
    );

-- Separa a entidade de agenda/atendimento da identidade autenticada em profiles.
CREATE TABLE professionals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    license_number TEXT,
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
    id,
    full_name,
    NULL,
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

CREATE POLICY "Usuários veem profissionais da mesma org"
ON professionals
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
